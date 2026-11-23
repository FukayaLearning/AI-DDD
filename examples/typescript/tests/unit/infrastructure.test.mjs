import assert from "node:assert/strict";
import { Order } from "../../src/domain/entities/order/order.ts";
import { createMoney } from "../../src/domain/value_objects/shared/money.ts";
import { createQuantity } from "../../src/domain/value_objects/order/quantity.ts";
import {
  createCustomerId,
  createOrderId,
  createProductId,
} from "../../src/domain/value_objects/shared/identifiers.ts";
import { InventoryGateway } from "../../src/infrastructure/gateways/inventory/inventory_gateway.ts";
import { PaymentGateway } from "../../src/infrastructure/gateways/payment/payment_gateway.ts";
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
  const oid = createOrderId("ORD-100").value;
  const cid = createCustomerId("CUST-1").value;
  const pid = createProductId("PROD-1").value;
  const qty = createQuantity(3).value;
  const price = createMoney(200, "JPY").value;
  return Order.create(oid, cid, [{ productId: pid, quantity: qty, unitPrice: price }]).value;
}

test("UT-ORD-014 order_mapper roundtrip and validation errors", () => {
  const rec = toOrderRecord(sampleOrder());
  assert.equal(fromOrderRecord(rec).ok, true);
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
});

test("UT-ORD-015 DriverOrderRepository save, findById, and ORDER_NOT_FOUND", async () => {
  const order = sampleOrder();
  const store = new Map();
  const mockKv = {
    async put(k, v) { store.set(k, v); },
    async get(k) {
      if (!store.has(k)) {
        const e = new Error("ENOENT");
        e.code = "ENOENT";
        throw e;
      }
      return store.get(k);
    },
  };
  const repo = new DriverOrderRepository(mockKv);
  assert.equal((await repo.save(order)).ok, true);
  assert.equal((await repo.findById(order.id)).ok, true);
  assert.equal((await repo.findById(createOrderId("NONE").value)).error.code, "ORDER_NOT_FOUND");
});

test("UT-ORD-016 DriverOrderRepository driver failure and corrupted JSON", async () => {
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
  assert.equal((await corruptJsonRepo.findById(order.id)).error.code, "REPOSITORY_ERROR");
});

test("UT-ORD-017 InventoryGateway handles 200 and 409", async () => {
  const order = sampleOrder();
  const invOk = new InventoryGateway({ async postJson() { return { status: 200, bodyText: "{}" }; } }, "http://inv");
  assert.equal((await invOk.reserveStock(order.id, order.lines)).ok, true);

  const invShort = new InventoryGateway({ async postJson() { return { status: 409, bodyText: "{}" }; } }, "http://inv");
  assert.equal((await invShort.reserveStock(order.id, order.lines)).error.code, "INSUFFICIENT_STOCK");
});

test("UT-ORD-018 InventoryGateway handles 500 and timeout", async () => {
  const order = sampleOrder();
  const inv500 = new InventoryGateway({ async postJson() { return { status: 500, bodyText: "{}" }; } }, "http://inv");
  assert.equal((await inv500.reserveStock(order.id, order.lines)).error.code, "EXTERNAL_TIMEOUT");

  const invTimeout = new InventoryGateway({ async postJson() { throw new Error("ETIMEDOUT"); } }, "http://inv");
  assert.equal((await invTimeout.reserveStock(order.id, order.lines)).error.code, "EXTERNAL_TIMEOUT");
});

test("UT-ORD-019 PaymentGateway handles 200 and 402", async () => {
  const order = sampleOrder();
  const payOk = new PaymentGateway({ async postJson() { return { status: 200, bodyText: "{}" }; } }, "http://pay");
  assert.equal((await payOk.charge(order.id, order.totalAmount())).ok, true);

  const payDeclined = new PaymentGateway({ async postJson() { return { status: 402, bodyText: "{}" }; } }, "http://pay");
  assert.equal((await payDeclined.charge(order.id, order.totalAmount())).error.code, "PAYMENT_DECLINED");
});

test("UT-ORD-020 PaymentGateway handles 503 and timeout", async () => {
  const order = sampleOrder();
  const pay500 = new PaymentGateway({ async postJson() { return { status: 503, bodyText: "{}" }; } }, "http://pay");
  assert.equal((await pay500.charge(order.id, order.totalAmount())).error.code, "EXTERNAL_TIMEOUT");

  const payTimeout = new PaymentGateway({ async postJson() { throw new Error("ETIMEDOUT"); } }, "http://pay");
  assert.equal((await payTimeout.charge(order.id, order.totalAmount())).error.code, "EXTERNAL_TIMEOUT");
});

export async function run() {
  for (const c of cases) await c.fn();
}
