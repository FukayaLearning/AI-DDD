import assert from "node:assert/strict";
import { OrderApplicationService } from "../../src/application/order_service.ts";
import { domainError } from "../../src/domain/errors.ts";
import { err, ok } from "../../src/domain/result.ts";

function makeInMemoryRepo(failSave = false) {
  const map = new Map();
  return {
    async save(order) {
      if (failSave) return err(domainError("REPOSITORY_ERROR", "db down"));
      map.set(order.id.value, order);
      return ok(undefined);
    },
    async findById(orderId) {
      const found = map.get(orderId.value);
      if (!found) return err(domainError("ORDER_NOT_FOUND", "not found"));
      return ok(found);
    },
  };
}

export async function run() {
  const okInv = { async reserveStock() { return ok(undefined); } };
  const okPay = { async charge() { return ok(undefined); } };

  // PlaceOrder scenarios
  const repo = makeInMemoryRepo();
  const svc = new OrderApplicationService(repo, okInv, okPay);

  assert.equal((await svc.placeOrder({ orderId: "", customerId: "C1", lines: [] })).error.code, "INVALID_ORDER_ID");
  assert.equal((await svc.placeOrder({ orderId: "O1", customerId: "", lines: [] })).error.code, "INVALID_CUSTOMER_ID");
  assert.equal(
    (await svc.placeOrder({ orderId: "O1", customerId: "C1", lines: [{ productId: "", quantity: 1, unitAmount: 10, currency: "JPY" }] })).error.code,
    "INVALID_PRODUCT_ID"
  );
  assert.equal(
    (await svc.placeOrder({ orderId: "O1", customerId: "C1", lines: [{ productId: "P1", quantity: 0, unitAmount: 10, currency: "JPY" }] })).error.code,
    "INVALID_QUANTITY"
  );
  assert.equal(
    (await svc.placeOrder({ orderId: "O1", customerId: "C1", lines: [{ productId: "P1", quantity: 1, unitAmount: -1, currency: "JPY" }] })).error.code,
    "INVALID_MONEY_AMOUNT"
  );
  assert.equal((await svc.placeOrder({ orderId: "O1", customerId: "C1", lines: [] })).error.code, "EMPTY_ORDER_LINES");

  const failRepoSvc = new OrderApplicationService(makeInMemoryRepo(true), okInv, okPay);
  assert.equal(
    (await failRepoSvc.placeOrder({ orderId: "O1", customerId: "C1", lines: [{ productId: "P1", quantity: 1, unitAmount: 100, currency: "JPY" }] })).error.code,
    "REPOSITORY_ERROR"
  );

  const placed = await svc.placeOrder({
    orderId: "ORD-1",
    customerId: "CUST-1",
    lines: [{ productId: "P1", quantity: 2, unitAmount: 500, currency: "JPY" }],
  });
  assert.equal(placed.ok, true);
  assert.equal(placed.value.status, "Draft");
  assert.equal(placed.value.total.amount, 1000);

  // GetOrder scenarios
  assert.equal((await svc.getOrder("")).error.code, "INVALID_ORDER_ID");
  assert.equal((await svc.getOrder("NO-SUCH")).error.code, "ORDER_NOT_FOUND");
  assert.equal((await svc.getOrder("ORD-1")).value.orderId, "ORD-1");

  // ConfirmOrder scenarios
  assert.equal((await svc.confirmOrder("")).error.code, "INVALID_ORDER_ID");
  assert.equal((await svc.confirmOrder("NO-SUCH")).error.code, "ORDER_NOT_FOUND");

  const stockFailSvc = new OrderApplicationService(
    repo,
    { async reserveStock() { return err(domainError("INSUFFICIENT_STOCK", "no stock")); } },
    okPay
  );
  assert.equal((await stockFailSvc.confirmOrder("ORD-1")).error.code, "INSUFFICIENT_STOCK");

  const payFailSvc = new OrderApplicationService(
    repo,
    okInv,
    { async charge() { return err(domainError("PAYMENT_DECLINED", "declined")); } }
  );
  assert.equal((await payFailSvc.confirmOrder("ORD-1")).error.code, "PAYMENT_DECLINED");

  // Confirm save fail branch
  let toggleFail = false;
  const toggleRepo = {
    async save(o) {
      if (toggleFail) return err(domainError("REPOSITORY_ERROR", "save fail"));
      return repo.save(o);
    },
    findById: repo.findById,
  };
  const toggleSvc = new OrderApplicationService(toggleRepo, okInv, okPay);
  toggleFail = true;
  assert.equal((await toggleSvc.confirmOrder("ORD-1")).error.code, "REPOSITORY_ERROR");
  toggleFail = false;

  const confirmed = await svc.confirmOrder("ORD-1");
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.value.status, "Confirmed");
  assert.equal((await svc.confirmOrder("ORD-1")).error.code, "INVALID_ORDER_STATE");

  // CancelOrder scenarios
  assert.equal((await svc.cancelOrder("")).error.code, "INVALID_ORDER_ID");
  assert.equal((await svc.cancelOrder("NO-SUCH")).error.code, "ORDER_NOT_FOUND");

  toggleFail = true;
  assert.equal((await toggleSvc.cancelOrder("ORD-1")).error.code, "REPOSITORY_ERROR");
  toggleFail = false;

  const cancelled = await svc.cancelOrder("ORD-1");
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.value.status, "Cancelled");
  assert.equal((await svc.cancelOrder("ORD-1")).error.code, "INVALID_ORDER_STATE");
}
