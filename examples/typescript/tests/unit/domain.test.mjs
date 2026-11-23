import assert from "node:assert/strict";
import { Order } from "../../src/domain/entities/order/order.ts";
import { addMoney, createMoney, multiplyMoney } from "../../src/domain/value_objects/shared/money.ts";
import { createQuantity } from "../../src/domain/value_objects/order/quantity.ts";
import {
  createCustomerId,
  createOrderId,
  createProductId,
} from "../../src/domain/value_objects/shared/identifiers.ts";

const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

test("UT-ORD-001 OrderId validates non-empty trimmed value", () => {
  assert.equal(createOrderId(" ").ok, false);
  const oid = createOrderId(" ORD-1 ");
  assert.equal(oid.ok, true);
  assert.equal(oid.value.value, "ORD-1");
});

test("UT-ORD-002 CustomerId validates non-empty trimmed value", () => {
  assert.equal(createCustomerId("").ok, false);
  const cid = createCustomerId(" CUST-1 ");
  assert.equal(cid.ok, true);
});

test("UT-ORD-003 ProductId validates non-empty trimmed value", () => {
  assert.equal(createProductId("").ok, false);
  assert.equal(createProductId(" PROD-1 ").ok, true);
});

test("UT-ORD-004 Quantity enforces integer boundary 1..100", () => {
  assert.equal(createQuantity(1.5).ok, false);
  assert.equal(createQuantity(0).ok, false);
  assert.equal(createQuantity(101).ok, false);
  assert.equal(createQuantity(1).ok, true);
  assert.equal(createQuantity(100).ok, true);
});

test("UT-ORD-005 Money enforces non-negative integer minor units", () => {
  assert.equal(createMoney(10.5, "JPY").ok, false);
  assert.equal(createMoney(-1, "JPY").ok, false);
  assert.equal(createMoney(0, "JPY").ok, true);
  assert.equal(createMoney(500, "JPY").ok, true);
  assert.equal(createMoney(5, "USD").ok, true);
});

test("UT-ORD-006 Money arithmetic enforces same currency", () => {
  const jpy = createMoney(500, "JPY").value;
  const usd = createMoney(5, "USD").value;
  const qty2 = createQuantity(2).value;
  const sub = multiplyMoney(jpy, qty2);
  assert.equal(sub.amount, 1000);
  assert.equal(addMoney(jpy, usd).ok, false);
  const sum = addMoney(jpy, sub);
  assert.equal(sum.ok, true);
  assert.equal(sum.value.amount, 1500);
});

test("UT-ORD-007 Order.create rejects empty order lines", () => {
  const oid = createOrderId("ORD-1").value;
  const cid = createCustomerId("CUST-1").value;
  assert.equal(Order.create(oid, cid, []).error.code, "EMPTY_ORDER_LINES");
});

test("UT-ORD-008 Order.create rejects more than 5 lines", () => {
  const oid = createOrderId("ORD-1").value;
  const cid = createCustomerId("CUST-1").value;
  const qty2 = createQuantity(2).value;
  const jpy = createMoney(500, "JPY").value;
  const sixLines = ["P1", "P2", "P3", "P4", "P5", "P6"].map((id) => ({
    productId: createProductId(id).value,
    quantity: qty2,
    unitPrice: jpy,
  }));
  assert.equal(Order.create(oid, cid, sixLines).error.code, "TOO_MANY_ORDER_LINES");
});

test("UT-ORD-009 Order.create rejects duplicate ProductId", () => {
  const oid = createOrderId("ORD-1").value;
  const cid = createCustomerId("CUST-1").value;
  const pid1 = createProductId("PROD-1").value;
  const qty2 = createQuantity(2).value;
  const jpy = createMoney(500, "JPY").value;
  assert.equal(
    Order.create(oid, cid, [
      { productId: pid1, quantity: qty2, unitPrice: jpy },
      { productId: pid1, quantity: qty2, unitPrice: jpy },
    ]).error.code,
    "DUPLICATE_PRODUCT"
  );
});

test("UT-ORD-010 Order.create rejects mismatched currencies", () => {
  const oid = createOrderId("ORD-1").value;
  const cid = createCustomerId("CUST-1").value;
  const pid1 = createProductId("PROD-1").value;
  const pid2 = createProductId("PROD-2").value;
  const qty2 = createQuantity(2).value;
  const jpy = createMoney(500, "JPY").value;
  const usd = createMoney(5, "USD").value;
  assert.equal(
    Order.create(oid, cid, [
      { productId: pid1, quantity: qty2, unitPrice: jpy },
      { productId: pid2, quantity: qty2, unitPrice: usd },
    ]).error.code,
    "CURRENCY_MISMATCH"
  );
});

test("UT-ORD-011 Order.create computes totalAmount for valid lines", () => {
  const oid = createOrderId("ORD-1").value;
  const cid = createCustomerId("CUST-1").value;
  const pid1 = createProductId("PROD-1").value;
  const qty2 = createQuantity(2).value;
  const jpy = createMoney(500, "JPY").value;
  const orderRes = Order.create(oid, cid, [{ productId: pid1, quantity: qty2, unitPrice: jpy }]);
  assert.equal(orderRes.ok, true);
  assert.equal(orderRes.value.totalAmount().amount, 1000);
});

test("UT-ORD-012 Order.confirm transitions Draft to Confirmed and rejects non-Draft", () => {
  const oid = createOrderId("ORD-1").value;
  const cid = createCustomerId("CUST-1").value;
  const pid1 = createProductId("PROD-1").value;
  const order = Order.create(oid, cid, [
    { productId: pid1, quantity: createQuantity(2).value, unitPrice: createMoney(500, "JPY").value },
  ]).value;
  const confirmedRes = order.confirm();
  assert.equal(confirmedRes.ok, true);
  assert.equal(confirmedRes.value.status, "Confirmed");
  assert.equal(confirmedRes.value.events[0].type, "OrderConfirmedEvent");
  assert.equal(confirmedRes.value.confirm().error.code, "INVALID_ORDER_STATE");
});

test("UT-ORD-013 Order.cancel transitions to Cancelled and rejects Cancelled", () => {
  const oid = createOrderId("ORD-1").value;
  const cid = createCustomerId("CUST-1").value;
  const pid1 = createProductId("PROD-1").value;
  const confirmed = Order.create(oid, cid, [
    { productId: pid1, quantity: createQuantity(2).value, unitPrice: createMoney(500, "JPY").value },
  ]).value.confirm().value;
  const cancelledRes = confirmed.cancel();
  assert.equal(cancelledRes.ok, true);
  assert.equal(cancelledRes.value.status, "Cancelled");
  assert.equal(cancelledRes.value.events[1].type, "OrderCancelledEvent");
  assert.equal(cancelledRes.value.cancel().error.code, "INVALID_ORDER_STATE");
});

export async function run() {
  for (const c of cases) await c.fn();
}
