import assert from "node:assert/strict";
import { Order } from "../../src/domain/order.ts";
import {
  addMoney,
  createCustomerId,
  createMoney,
  createOrderId,
  createProductId,
  createQuantity,
  multiplyMoney,
} from "../../src/domain/value_objects.ts";

export async function run() {
  assert.equal(createOrderId(" ").ok, false);
  const oid = createOrderId(" ORD-1 ");
  assert.equal(oid.ok, true);
  assert.equal(oid.value.value, "ORD-1");

  assert.equal(createCustomerId("").ok, false);
  const cid = createCustomerId(" CUST-1 ");
  assert.equal(cid.ok, true);

  assert.equal(createProductId("").ok, false);
  const pid1 = createProductId(" PROD-1 ");
  const pid2 = createProductId(" PROD-2 ");
  assert.equal(pid1.ok && pid2.ok, true);

  assert.equal(createQuantity(1.5).ok, false);
  assert.equal(createQuantity(0).ok, false);
  assert.equal(createQuantity(101).ok, false);
  const qty2 = createQuantity(2);
  assert.equal(qty2.ok, true);

  assert.equal(createMoney(10.5, "JPY").ok, false);
  assert.equal(createMoney(-1, "JPY").ok, false);
  const jpy = createMoney(500, "JPY");
  const usd = createMoney(5, "USD");
  assert.equal(jpy.ok && usd.ok, true);

  const sub = multiplyMoney(jpy.value, qty2.value);
  assert.equal(sub.amount, 1000);
  assert.equal(addMoney(jpy.value, usd.value).ok, false);
  const sum = addMoney(jpy.value, sub);
  assert.equal(sum.ok, true);
  assert.equal(sum.value.amount, 1500);

  // Aggregate invariants
  assert.equal(Order.create(oid.value, cid.value, []).error.code, "EMPTY_ORDER_LINES");

  const sixLines = ["P1", "P2", "P3", "P4", "P5", "P6"].map((id) => ({
    productId: (createProductId(id)).value,
    quantity: qty2.value,
    unitPrice: jpy.value,
  }));
  assert.equal(Order.create(oid.value, cid.value, sixLines).error.code, "TOO_MANY_ORDER_LINES");

  assert.equal(
    Order.create(oid.value, cid.value, [
      { productId: pid1.value, quantity: qty2.value, unitPrice: jpy.value },
      { productId: pid1.value, quantity: qty2.value, unitPrice: jpy.value },
    ]).error.code,
    "DUPLICATE_PRODUCT"
  );

  assert.equal(
    Order.create(oid.value, cid.value, [
      { productId: pid1.value, quantity: qty2.value, unitPrice: jpy.value },
      { productId: pid2.value, quantity: qty2.value, unitPrice: usd.value },
    ]).error.code,
    "CURRENCY_MISMATCH"
  );

  const orderRes = Order.create(oid.value, cid.value, [
    { productId: pid1.value, quantity: qty2.value, unitPrice: jpy.value },
  ]);
  assert.equal(orderRes.ok, true);
  assert.equal(orderRes.value.totalAmount().amount, 1000);

  const confirmedRes = orderRes.value.confirm();
  assert.equal(confirmedRes.ok, true);
  assert.equal(confirmedRes.value.status, "Confirmed");
  assert.equal(confirmedRes.value.events[0].type, "OrderConfirmedEvent");
  assert.equal(confirmedRes.value.confirm().error.code, "INVALID_ORDER_STATE");

  const cancelledRes = confirmedRes.value.cancel();
  assert.equal(cancelledRes.ok, true);
  assert.equal(cancelledRes.value.status, "Cancelled");
  assert.equal(cancelledRes.value.events[1].type, "OrderCancelledEvent");
  assert.equal(cancelledRes.value.cancel().error.code, "INVALID_ORDER_STATE");
}
