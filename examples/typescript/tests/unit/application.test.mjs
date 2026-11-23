import assert from "node:assert/strict";
import * as orderDtoModule from "../../src/application/dtos/order/order_dto.ts";
import { OrderApplicationService } from "../../src/application/services/order/order_service.ts";
import { domainError } from "../../src/domain/shared/errors.ts";
import { err, ok } from "../../src/domain/shared/result.ts";

const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

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

const okInv = { async reserveStock() { return ok(undefined); } };
const okPay = { async charge() { return ok(undefined); } };

test("UT-ORD-021 placeOrder persists valid Draft order", async () => {
  const svc = new OrderApplicationService(makeInMemoryRepo(), okInv, okPay);
  const placed = await svc.placeOrder({
    orderId: "ORD-1",
    customerId: "CUST-1",
    lines: [{ productId: "P1", quantity: 2, unitAmount: 500, currency: "JPY" }],
  });
  assert.equal(placed.ok, true);
  assert.equal(placed.value.status, "Draft");
  assert.equal(placed.value.total.amount, 1000);
});

test("UT-ORD-022 placeOrder rejects invalid VO or invariant violations", async () => {
  const svc = new OrderApplicationService(makeInMemoryRepo(), okInv, okPay);
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
});

test("UT-ORD-023 placeOrder surfaces repository error", async () => {
  const failRepoSvc = new OrderApplicationService(makeInMemoryRepo(true), okInv, okPay);
  assert.equal(
    (await failRepoSvc.placeOrder({ orderId: "O1", customerId: "C1", lines: [{ productId: "P1", quantity: 1, unitAmount: 100, currency: "JPY" }] })).error.code,
    "REPOSITORY_ERROR"
  );
});

test("UT-ORD-024 getOrder handles invalid, missing, and existing orders", async () => {
  const svc = new OrderApplicationService(makeInMemoryRepo(), okInv, okPay);
  await svc.placeOrder({
    orderId: "ORD-1",
    customerId: "CUST-1",
    lines: [{ productId: "P1", quantity: 2, unitAmount: 500, currency: "JPY" }],
  });
  assert.equal((await svc.getOrder("")).error.code, "INVALID_ORDER_ID");
  assert.equal((await svc.getOrder("NO-SUCH")).error.code, "ORDER_NOT_FOUND");
  assert.equal((await svc.getOrder("ORD-1")).value.orderId, "ORD-1");
});

test("UT-ORD-025 confirmOrder covers normal, missing, stock/payment/save failures, and non-draft", async () => {
  const repo = makeInMemoryRepo();
  const svc = new OrderApplicationService(repo, okInv, okPay);
  await svc.placeOrder({
    orderId: "ORD-1",
    customerId: "CUST-1",
    lines: [{ productId: "P1", quantity: 2, unitAmount: 500, currency: "JPY" }],
  });

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

  const saveFailRepo = {
    async save() { return err(domainError("REPOSITORY_ERROR", "save fail")); },
    findById: repo.findById,
  };
  assert.equal((await new OrderApplicationService(saveFailRepo, okInv, okPay).confirmOrder("ORD-1")).error.code, "REPOSITORY_ERROR");

  const confirmed = await svc.confirmOrder("ORD-1");
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.value.status, "Confirmed");
  assert.equal((await svc.confirmOrder("ORD-1")).error.code, "INVALID_ORDER_STATE");
});

test("UT-ORD-026 cancelOrder covers normal, missing, save fail, and already cancelled", async () => {
  const repo = makeInMemoryRepo();
  const svc = new OrderApplicationService(repo, okInv, okPay);
  await svc.placeOrder({
    orderId: "ORD-1",
    customerId: "CUST-1",
    lines: [{ productId: "P1", quantity: 2, unitAmount: 500, currency: "JPY" }],
  });

  assert.equal((await svc.cancelOrder("")).error.code, "INVALID_ORDER_ID");
  assert.equal((await svc.cancelOrder("NO-SUCH")).error.code, "ORDER_NOT_FOUND");

  const saveFailRepo = {
    async save() { return err(domainError("REPOSITORY_ERROR", "save fail")); },
    findById: repo.findById,
  };
  assert.equal((await new OrderApplicationService(saveFailRepo, okInv, okPay).cancelOrder("ORD-1")).error.code, "REPOSITORY_ERROR");

  const cancelled = await svc.cancelOrder("ORD-1");
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.value.status, "Cancelled");
  assert.equal((await svc.cancelOrder("ORD-1")).error.code, "INVALID_ORDER_STATE");
});

export async function run() {
  for (const c of cases) await c.fn();
}
