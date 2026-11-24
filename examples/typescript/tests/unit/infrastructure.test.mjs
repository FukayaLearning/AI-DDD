import assert from "node:assert/strict";
import { Order } from "../../src/domain/entities/order/order.ts";
import { Money } from "../../src/domain/value_objects/shared/money.ts";
import { Quantity } from "../../src/domain/value_objects/order/quantity.ts";
import {
  CustomerId,
  OrderId,
  ProductId,
} from "../../src/domain/value_objects/shared/identifiers.ts";
import { InventoryGateway } from "../../src/infrastructure/gateways/inventory/inventory_gateway.ts";
import { PaymentGateway } from "../../src/infrastructure/gateways/payment/payment_gateway.ts";
import { LoggingEventPublisher } from "../../src/infrastructure/gateways/events/logging_event_publisher.ts";
import { DriverOrderRepository } from "../../src/infrastructure/repositories/order/driver_order_repository.ts";
import {
  fromOrderRecord,
  toOrderRecord,
} from "../../src/infrastructure/mappers/order/order_mapper.ts";

const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

function sampleOrder() {
  return Order.create(
    OrderId.create("ORD-100").value,
    CustomerId.create("CUST-1").value,
    [{
      productId: ProductId.create("PROD-1").value,
      quantity: Quantity.create(3).value,
      unitPrice: Money.create(200, "JPY").value,
    }]
  ).value;
}

function memoryKv(initial = new Map()) {
  return {
    store: initial,
    async put(k, v) { this.store.set(k, v); },
    async get(k) {
      if (!this.store.has(k)) {
        const e = new Error("ENOENT");
        e.code = "ENOENT";
        throw e;
      }
      return this.store.get(k);
    },
  };
}

test("UT-ORD-014 order_mapper roundtrip, version migration, and validation errors", () => {
  const order = sampleOrder();
  const rec = toOrderRecord(order);
  assert.equal(rec.version, 0);
  assert.equal("events" in rec, false);
  assert.equal(fromOrderRecord(rec).ok, true);

  const legacy = { ...rec };
  delete legacy.version;
  assert.equal(fromOrderRecord(legacy).ok, true);

  assert.equal(fromOrderRecord({ ...rec, id: "" }).error.code, "REPOSITORY_ERROR");
  assert.equal(fromOrderRecord({ ...rec, customerId: "" }).error.code, "REPOSITORY_ERROR");
  assert.equal(
    fromOrderRecord({ ...rec, lines: [{ productId: "", quantity: 1, unitAmount: 100, currency: "JPY" }] }).error.code,
    "REPOSITORY_ERROR"
  );
  assert.equal(
    fromOrderRecord({ ...rec, lines: [{ productId: "P1", quantity: 0, unitAmount: 100, currency: "JPY" }] }).error.code,
    "REPOSITORY_ERROR"
  );
  assert.equal(
    fromOrderRecord({ ...rec, lines: [{ productId: "P1", quantity: 1, unitAmount: -5, currency: "JPY" }] }).error.code,
    "REPOSITORY_ERROR"
  );
  assert.equal(fromOrderRecord({ ...rec, lines: [] }).error.code, "REPOSITORY_ERROR");
  assert.equal(fromOrderRecord({ ...rec, version: -1 }).error.code, "REPOSITORY_ERROR");
  assert.equal(fromOrderRecord({ ...rec, status: "Unknown" }).error.code, "REPOSITORY_ERROR");
});

test("UT-ORD-015 DriverOrderRepository saves with version increment and finds by id", async () => {
  const order = sampleOrder();
  const kv = memoryKv();
  const repo = new DriverOrderRepository(kv);
  assert.equal((await repo.save(order)).ok, true);
  const stored = JSON.parse(kv.store.get("ORD-100"));
  assert.equal(stored.version, 1);
  const found = await repo.findById(order.id);
  assert.equal(found.ok, true);
  assert.equal(found.value.version, 1);
  assert.equal((await repo.findById(OrderId.create("NONE").value)).error.code, "ORDER_NOT_FOUND");
});

test("UT-ORD-016 DriverOrderRepository handles driver failures and corrupted JSON", async () => {
  const order = sampleOrder();
  const brokenSaveRepo = new DriverOrderRepository({
    async put() { throw new Error("disk full"); },
    async get() { throw new Error("disk error"); },
  });
  assert.equal((await brokenSaveRepo.save(order)).error.code, "REPOSITORY_ERROR");
  assert.equal((await brokenSaveRepo.findById(order.id)).error.code, "REPOSITORY_ERROR");

  const corruptJsonRepo = new DriverOrderRepository({
    async put() {},
    async get() { return "{bad-json"; },
  });
  assert.equal((await corruptJsonRepo.save(order)).error.code, "REPOSITORY_ERROR");
  assert.equal((await corruptJsonRepo.findById(order.id)).error.code, "REPOSITORY_ERROR");
});

test("UT-ORD-017 InventoryGateway reserve handles 200 and 409", async () => {
  const order = sampleOrder();
  const items = [{ productId: "PROD-1", quantity: 3 }];
  const invOk = new InventoryGateway({ async postJson() { return { status: 200, bodyText: "{}" }; } }, "http://inv/reserve");
  assert.equal((await invOk.reserveStock(order.id, items)).ok, true);

  const invShort = new InventoryGateway({ async postJson() { return { status: 409, bodyText: "{}" }; } }, "http://inv/reserve");
  assert.equal((await invShort.reserveStock(order.id, items)).error.code, "INSUFFICIENT_STOCK");
});

test("UT-ORD-018 InventoryGateway reserve handles 500 and timeout", async () => {
  const order = sampleOrder();
  const items = [{ productId: "PROD-1", quantity: 3 }];
  const inv500 = new InventoryGateway({ async postJson() { return { status: 500, bodyText: "{}" }; } }, "http://inv/reserve");
  assert.equal((await inv500.reserveStock(order.id, items)).error.code, "EXTERNAL_TIMEOUT");

  const invTimeout = new InventoryGateway({ async postJson() { throw new Error("ETIMEDOUT"); } }, "http://inv/reserve");
  assert.equal((await invTimeout.reserveStock(order.id, items)).error.code, "EXTERNAL_TIMEOUT");
});

test("UT-ORD-019 PaymentGateway charge handles 200 and 402", async () => {
  const order = sampleOrder();
  const total = order.totalAmount().value;
  const payOk = new PaymentGateway({ async postJson() { return { status: 200, bodyText: "{}" }; } }, "http://pay/charge");
  assert.equal((await payOk.charge(order.id, total)).ok, true);

  const payDeclined = new PaymentGateway({ async postJson() { return { status: 402, bodyText: "{}" }; } }, "http://pay/charge");
  assert.equal((await payDeclined.charge(order.id, total)).error.code, "PAYMENT_DECLINED");
});

test("UT-ORD-020 PaymentGateway charge handles 503 and timeout", async () => {
  const order = sampleOrder();
  const total = order.totalAmount().value;
  const pay500 = new PaymentGateway({ async postJson() { return { status: 503, bodyText: "{}" }; } }, "http://pay/charge");
  assert.equal((await pay500.charge(order.id, total)).error.code, "EXTERNAL_TIMEOUT");

  const payTimeout = new PaymentGateway({ async postJson() { throw new Error("ETIMEDOUT"); } }, "http://pay/charge");
  assert.equal((await payTimeout.charge(order.id, total)).error.code, "EXTERNAL_TIMEOUT");
});

test("UT-ORD-061 InventoryGateway release handles 200, failure, and timeout", async () => {
  const order = sampleOrder();
  const items = [{ productId: "PROD-1", quantity: 3 }];
  const releaseOk = new InventoryGateway({ async postJson() { return { status: 200, bodyText: "{}" }; } }, "http://inv/reserve");
  assert.equal((await releaseOk.releaseStock(order.id, items)).ok, true);

  const releaseFail = new InventoryGateway({ async postJson() { return { status: 500, bodyText: "{}" }; } }, "http://inv/reserve");
  assert.equal((await releaseFail.releaseStock(order.id, items)).error.code, "EXTERNAL_TIMEOUT");

  const releaseTimeout = new InventoryGateway({ async postJson() { throw new Error("ETIMEDOUT"); } }, "http://inv/reserve");
  assert.equal((await releaseTimeout.releaseStock(order.id, items)).error.code, "EXTERNAL_TIMEOUT");
});

test("UT-ORD-062 PaymentGateway refund handles 200, failure, and timeout", async () => {
  const order = sampleOrder();
  const total = order.totalAmount().value;
  const refundOk = new PaymentGateway({ async postJson() { return { status: 200, bodyText: "{}" }; } }, "http://pay/charge");
  assert.equal((await refundOk.refund(order.id, total)).ok, true);

  const refundFail = new PaymentGateway({ async postJson() { return { status: 500, bodyText: "{}" }; } }, "http://pay/charge");
  assert.equal((await refundFail.refund(order.id, total)).error.code, "EXTERNAL_TIMEOUT");

  const refundTimeout = new PaymentGateway({ async postJson() { throw new Error("ETIMEDOUT"); } }, "http://pay/charge");
  assert.equal((await refundTimeout.refund(order.id, total)).error.code, "EXTERNAL_TIMEOUT");
});

test("UT-ORD-065 LoggingEventPublisher publishes pulled events", async () => {
  const order = sampleOrder();
  const confirmed = order.confirm().value;
  const events = confirmed.pullEvents();
  const original = console.log;
  const lines = [];
  console.log = (line) => lines.push(line);
  try {
    const publisher = new LoggingEventPublisher();
    assert.equal((await publisher.publish(events)).ok, true);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /DOMAIN_EVENT/);
    assert.equal((await publisher.publish([])).ok, true);
  } finally {
    console.log = original;
  }
});

test("UT-ORD-067 DriverOrderRepository treats legacy records without version as version 0", async () => {
  const order = sampleOrder();
  const legacy = toOrderRecord(order);
  delete legacy.version;
  const kv = memoryKv(new Map([["ORD-100", JSON.stringify(legacy)]]));
  const repo = new DriverOrderRepository(kv);
  assert.equal((await repo.save(order)).ok, true);
  assert.equal(JSON.parse(kv.store.get("ORD-100")).version, 1);
});

test("UT-ORD-068 DriverOrderRepository reports put failure after a new-key lookup", async () => {
  const order = sampleOrder();
  const repo = new DriverOrderRepository({
    async get() {
      const e = new Error("ENOENT");
      e.code = "ENOENT";
      throw e;
    },
    async put() { throw new Error("disk full"); },
  });
  assert.equal((await repo.save(order)).error.code, "REPOSITORY_ERROR");
});

test("UT-ORD-066 DriverOrderRepository rejects stale versions", async () => {
  const order = sampleOrder();
  const kv = memoryKv();
  const repo = new DriverOrderRepository(kv);
  assert.equal((await repo.save(order)).ok, true);
  const stale = Order.reconstitute(
    order.id,
    order.customerId,
    order.lines,
    "Draft",
    0
  ).value;
  assert.equal((await repo.save(stale)).error.code, "CONFLICT");
});

export async function run() {
  for (const c of cases) await c.fn();
}
