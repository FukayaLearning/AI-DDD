import assert from "node:assert/strict";
import { Order } from "../../src/domain/order.ts";
import {
  createCustomerId,
  createMoney,
  createOrderId,
  createProductId,
  createQuantity,
} from "../../src/domain/value_objects.ts";
import {
  InventoryGateway,
  PaymentGateway,
} from "../../src/infrastructure/acl/external_gateways.ts";
import { DriverOrderRepository } from "../../src/infrastructure/repository/driver_order_repository.ts";
import {
  fromOrderRecord,
  toOrderRecord,
} from "../../src/infrastructure/repository/order_mapper.ts";

export async function run() {
  const oid = createOrderId("ORD-100").value;
  const cid = createCustomerId("CUST-1").value;
  const pid = createProductId("PROD-1").value;
  const qty = createQuantity(3).value;
  const price = createMoney(200, "JPY").value;
  const order = Order.create(oid, cid, [{ productId: pid, quantity: qty, unitPrice: price }]).value;

  const rec = toOrderRecord(order);
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

  // Repository with mock KV driver
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
  assert.equal((await repo.findById(oid)).ok, true);
  assert.equal((await repo.findById(createOrderId("NONE").value)).error.code, "ORDER_NOT_FOUND");

  const brokenSaveRepo = new DriverOrderRepository({
    async put() { throw new Error("disk full"); },
    async get() { throw new Error("disk error"); },
  });
  assert.equal((await brokenSaveRepo.save(order)).error.code, "REPOSITORY_ERROR");
  assert.equal((await brokenSaveRepo.findById(oid)).error.code, "REPOSITORY_ERROR");

  const corruptJsonRepo = new DriverOrderRepository({
    async put() {},
    async get() { return "{bad-json"; },
  });
  assert.equal((await corruptJsonRepo.findById(oid)).error.code, "REPOSITORY_ERROR");

  // ACL gateways with mock HTTP driver
  const invOk = new InventoryGateway({ async postJson() { return { status: 200, bodyText: "{}" }; } }, "http://inv");
  assert.equal((await invOk.reserveStock(oid, order.lines)).ok, true);

  const invShort = new InventoryGateway({ async postJson() { return { status: 409, bodyText: "{}" }; } }, "http://inv");
  assert.equal((await invShort.reserveStock(oid, order.lines)).error.code, "INSUFFICIENT_STOCK");

  const inv500 = new InventoryGateway({ async postJson() { return { status: 500, bodyText: "{}" }; } }, "http://inv");
  assert.equal((await inv500.reserveStock(oid, order.lines)).error.code, "EXTERNAL_TIMEOUT");

  const invTimeout = new InventoryGateway({ async postJson() { throw new Error("ETIMEDOUT"); } }, "http://inv");
  assert.equal((await invTimeout.reserveStock(oid, order.lines)).error.code, "EXTERNAL_TIMEOUT");

  const payOk = new PaymentGateway({ async postJson() { return { status: 200, bodyText: "{}" }; } }, "http://pay");
  assert.equal((await payOk.charge(oid, order.totalAmount())).ok, true);

  const payDeclined = new PaymentGateway({ async postJson() { return { status: 402, bodyText: "{}" }; } }, "http://pay");
  assert.equal((await payDeclined.charge(oid, order.totalAmount())).error.code, "PAYMENT_DECLINED");

  const pay500 = new PaymentGateway({ async postJson() { return { status: 503, bodyText: "{}" }; } }, "http://pay");
  assert.equal((await pay500.charge(oid, order.totalAmount())).error.code, "EXTERNAL_TIMEOUT");

  const payTimeout = new PaymentGateway({ async postJson() { throw new Error("ETIMEDOUT"); } }, "http://pay");
  assert.equal((await payTimeout.charge(oid, order.totalAmount())).error.code, "EXTERNAL_TIMEOUT");
}
