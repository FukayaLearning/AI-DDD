import assert from "node:assert/strict";
import { Order } from "../../src/domain/entities/order/order.ts";
import { Money, addMoney, createMoney, multiplyMoney } from "../../src/domain/value_objects/shared/money.ts";
import { Quantity } from "../../src/domain/value_objects/order/quantity.ts";
import {
  CustomerId,
  OrderId,
  ProductId,
} from "../../src/domain/value_objects/shared/identifiers.ts";

const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

function line(productId, quantity, unitAmount, currency = "JPY") {
  return {
    productId: ProductId.create(productId).value,
    quantity: Quantity.create(quantity).value,
    unitPrice: Money.create(unitAmount, currency).value,
  };
}

function draftOrder(id = "ORD-1") {
  return Order.create(
    OrderId.create(id).value,
    CustomerId.create("CUST-1").value,
    [line("PROD-1", 2, 500)]
  ).value;
}

test("UT-ORD-001 OrderId validates non-empty trimmed value", () => {
  assert.equal(OrderId.create(" ").ok, false);
  const oid = OrderId.create(" ORD-1 ");
  assert.equal(oid.ok, true);
  assert.equal(oid.value.value, "ORD-1");
});

test("UT-ORD-002 CustomerId validates non-empty trimmed value", () => {
  assert.equal(CustomerId.create("").ok, false);
  assert.equal(CustomerId.create(" CUST-1 ").ok, true);
});

test("UT-ORD-003 ProductId validates non-empty trimmed value", () => {
  assert.equal(ProductId.create("").ok, false);
  assert.equal(ProductId.create(" PROD-1 ").ok, true);
});

test("UT-ORD-004 Quantity enforces integer boundary 1..100", () => {
  assert.equal(Quantity.create(1.5).ok, false);
  assert.equal(Quantity.create(0).ok, false);
  assert.equal(Quantity.create(101).ok, false);
  assert.equal(Quantity.create(1).ok, true);
  assert.equal(Quantity.create(100).ok, true);
});

test("UT-ORD-005 Money enforces non-negative integer minor units", () => {
  assert.equal(Money.create(10.5, "JPY").ok, false);
  assert.equal(Money.create(-1, "JPY").ok, false);
  assert.equal(Money.create(0, "JPY").ok, true);
  assert.equal(Money.create(500, "JPY").ok, true);
  assert.equal(Money.create(5, "USD").ok, true);
  assert.equal(Money.create(5, "EUR").ok, false);
});

test("UT-ORD-006 Money arithmetic enforces same currency", () => {
  const jpy = Money.create(500, "JPY").value;
  const usd = Money.create(5, "USD").value;
  const qty2 = Quantity.create(2).value;
  const sub = multiplyMoney(jpy, qty2);
  assert.equal(sub.ok, true);
  assert.equal(sub.value.amount, 1000);
  assert.equal(addMoney(jpy, usd).ok, false);
  const sum = addMoney(jpy, sub.value);
  assert.equal(sum.ok, true);
  assert.equal(sum.value.amount, 1500);
});

test("UT-ORD-007 Order.create rejects empty order lines", () => {
  assert.equal(
    Order.create(OrderId.create("ORD-1").value, CustomerId.create("CUST-1").value, []).error.code,
    "EMPTY_ORDER_LINES"
  );
});

test("UT-ORD-008 Order.create rejects more than 5 lines", () => {
  const lines = ["P1", "P2", "P3", "P4", "P5", "P6"].map((id) => line(id, 2, 500));
  assert.equal(
    Order.create(OrderId.create("ORD-1").value, CustomerId.create("CUST-1").value, lines).error.code,
    "TOO_MANY_ORDER_LINES"
  );
});

test("UT-ORD-009 Order.create rejects duplicate ProductId", () => {
  assert.equal(
    Order.create(OrderId.create("ORD-1").value, CustomerId.create("CUST-1").value, [
      line("PROD-1", 2, 500),
      line("PROD-1", 2, 500),
    ]).error.code,
    "DUPLICATE_PRODUCT"
  );
});

test("UT-ORD-010 Order.create rejects mismatched currencies", () => {
  assert.equal(
    Order.create(OrderId.create("ORD-1").value, CustomerId.create("CUST-1").value, [
      line("PROD-1", 2, 500, "JPY"),
      line("PROD-2", 2, 5, "USD"),
    ]).error.code,
    "CURRENCY_MISMATCH"
  );
});

test("UT-ORD-011 Order.create computes totalAmount for valid lines", () => {
  const order = draftOrder();
  const total = order.totalAmount();
  assert.equal(total.ok, true);
  assert.equal(total.value.amount, 1000);
});

test("UT-ORD-012 Order.confirm transitions Draft to Confirmed and rejects non-Draft", () => {
  const order = draftOrder();
  const confirmedRes = order.confirm();
  assert.equal(confirmedRes.ok, true);
  assert.equal(confirmedRes.value.status, "Confirmed");
  assert.equal(confirmedRes.value.canConfirm(), false);
  assert.equal(confirmedRes.value.canCancel(), true);
  const events = confirmedRes.value.pullEvents();
  assert.equal(events[0].type, "OrderConfirmedEvent");
  assert.equal(confirmedRes.value.confirm().error.code, "INVALID_ORDER_STATE");
});

test("UT-ORD-013 Order.cancel transitions to Cancelled and rejects Cancelled", () => {
  const confirmed = draftOrder().confirm().value;
  confirmed.clearEvents();
  const cancelledRes = confirmed.cancel();
  assert.equal(cancelledRes.ok, true);
  assert.equal(cancelledRes.value.status, "Cancelled");
  assert.equal(cancelledRes.value.canConfirm(), false);
  assert.equal(cancelledRes.value.canCancel(), false);
  const events = cancelledRes.value.pullEvents();
  assert.equal(events[0].type, "OrderCancelledEvent");
  assert.equal(cancelledRes.value.cancel().error.code, "INVALID_ORDER_STATE");
});

test("UT-ORD-032 value objects reject direct invalid construction", () => {
  assert.throws(() => new OrderId(""), /OrderId must not be empty/);
  assert.throws(() => new CustomerId(""), /CustomerId must not be empty/);
  assert.throws(() => new ProductId(""), /ProductId must not be empty/);
  assert.throws(() => new Quantity(0), /Quantity must be an integer/);
  assert.throws(() => new Money(-1, "JPY"), /Money amount must be a non-negative integer/);
  assert.throws(() => new Money(1, "EUR"), /Unsupported currency/);
});

test("UT-ORD-033 create and reconstitute are separate paths", () => {
  const oid = OrderId.create("ORD-1").value;
  const cid = CustomerId.create("CUST-1").value;
  const lines = [line("PROD-1", 2, 500)];
  const created = Order.create(oid, cid, lines).value;
  assert.equal(created.status, "Draft");
  assert.equal(created.version, 0);

  const confirmed = Order.reconstitute(oid, cid, lines, "Confirmed", 1);
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.value.status, "Confirmed");
  assert.equal(confirmed.value.version, 1);
  assert.equal(confirmed.value.pullEvents().length, 0);

  assert.equal(Order.reconstitute(oid, cid, [], "Draft", 0).error.code, "EMPTY_ORDER_LINES");
  assert.equal(Order.reconstitute(oid, cid, lines, "Draft", -1).error.code, "INVALID_ORDER_STATE");
  assert.equal(Order.reconstitute(oid, cid, lines, "Unknown", 0).error.code, "INVALID_ORDER_STATE");
});

test("UT-ORD-034 entity equality uses OrderId, not all attributes", () => {
  const draft = draftOrder("ORD-SAME");
  const confirmed = Order.reconstitute(
    OrderId.create("ORD-SAME").value,
    CustomerId.create("CUST-1").value,
    [line("PROD-1", 2, 500)],
    "Confirmed",
    1
  ).value;
  const other = draftOrder("ORD-OTHER");
  assert.equal(draft.equals(confirmed), true);
  assert.equal(draft.equals(other), false);
});

test("UT-ORD-035 domain events are pulled and cleared from the aggregate", () => {
  const confirmed = draftOrder().confirm().value;
  assert.equal(confirmed.pullEvents().length, 1);
  assert.equal(confirmed.pullEvents().length, 0);
  confirmed.clearEvents();
  assert.equal(confirmed.pullEvents().length, 0);
});

test("UT-ORD-036 canConfirm and canCancel reflect state transitions", () => {
  const draft = draftOrder();
  assert.equal(draft.canConfirm(), true);
  assert.equal(draft.canCancel(), true);
  const confirmed = draft.confirm().value;
  assert.equal(confirmed.canConfirm(), false);
  assert.equal(confirmed.canCancel(), true);
  const cancelled = confirmed.cancel().value;
  assert.equal(cancelled.canConfirm(), false);
  assert.equal(cancelled.canCancel(), false);
});

test("UT-ORD-037 OrderLine with forged value objects is rejected", () => {
  const oid = OrderId.create("ORD-1").value;
  const cid = CustomerId.create("CUST-1").value;
  const forged = [{ productId: { value: "P1" }, quantity: { value: 1 }, unitPrice: { amount: 1, currency: "JPY" } }];
  assert.equal(Order.create(oid, cid, forged).error.code, "INVALID_PRODUCT_ID");
});

test("UT-ORD-039 OrderLine with forged Quantity or Money is rejected", () => {
  const oid = OrderId.create("ORD-1").value;
  const cid = CustomerId.create("CUST-1").value;
  const goodProduct = ProductId.create("P1").value;
  const goodMoney = Money.create(100, "JPY").value;
  assert.equal(
    Order.create(oid, cid, [{ productId: goodProduct, quantity: { value: 1 }, unitPrice: goodMoney }]).error.code,
    "INVALID_QUANTITY"
  );
  assert.equal(
    Order.create(oid, cid, [{ productId: goodProduct, quantity: Quantity.create(1).value, unitPrice: { amount: 1, currency: "JPY" } }]).error.code,
    "INVALID_MONEY_AMOUNT"
  );
});

test("UT-ORD-052 totalAmount reports overflow while summing lines", () => {
  const half = Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1;
  const order = Order.create(
    OrderId.create("ORD-SUM").value,
    CustomerId.create("CUST-1").value,
    [
      { productId: ProductId.create("P1").value, quantity: Quantity.create(1).value, unitPrice: Money.create(half, "JPY").value },
      { productId: ProductId.create("P2").value, quantity: Quantity.create(1).value, unitPrice: Money.create(half, "JPY").value },
    ]
  ).value;
  assert.equal(order.totalAmount().error.code, "INVALID_MONEY_AMOUNT");
});

test("UT-ORD-063 confirm reports an overflow in the total amount", () => {
  const half = Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1;
  const order = Order.create(
    OrderId.create("ORD-CONFIRM-OVERFLOW").value,
    CustomerId.create("CUST-1").value,
    [
      { productId: ProductId.create("P1").value, quantity: Quantity.create(1).value, unitPrice: Money.create(half, "JPY").value },
      { productId: ProductId.create("P2").value, quantity: Quantity.create(1).value, unitPrice: Money.create(half, "JPY").value },
    ]
  ).value;
  assert.equal(order.confirm().error.code, "INVALID_MONEY_AMOUNT");
});

test("UT-ORD-053 value objects compare by attribute value", () => {
  assert.equal(OrderId.create("A").value.equals(OrderId.create("A").value), true);
  assert.equal(OrderId.create("A").value.equals(OrderId.create("B").value), false);
  assert.equal(CustomerId.create("A").value.equals(CustomerId.create("A").value), true);
  assert.equal(ProductId.create("A").value.equals(ProductId.create("A").value), true);
  assert.equal(Quantity.create(1).value.equals(Quantity.create(1).value), true);
  assert.equal(Quantity.create(1).value.equals(Quantity.create(2).value), false);
  assert.equal(Money.create(1, "JPY").value.equals(Money.create(1, "JPY").value), true);
  assert.equal(Money.create(1, "JPY").value.equals(Money.create(1, "USD").value), false);
});

test("UT-ORD-054 createMoney delegates to the Money value object", () => {
  assert.equal(createMoney(10, "JPY").ok, true);
  assert.equal(createMoney(-1, "JPY").error.code, "INVALID_MONEY_AMOUNT");
});

test("UT-ORD-038 Money arithmetic rejects unsafe integer overflow", () => {
  const max = Money.create(Number.MAX_SAFE_INTEGER, "JPY").value;
  assert.equal(max.add(Money.create(1, "JPY").value).error.code, "INVALID_MONEY_AMOUNT");
  assert.equal(max.multiply(Quantity.create(2).value).error.code, "INVALID_MONEY_AMOUNT");
});

export async function run() {
  for (const c of cases) await c.fn();
}
