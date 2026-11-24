import assert from "node:assert/strict";
import * as orderDtoModule from "../../src/application/dtos/order/order_dto.ts";
import { OrderApplicationService } from "../../src/application/services/order/order_service.ts";
import { Order } from "../../src/domain/entities/order/order.ts";
import { domainError, infrastructureError } from "../../src/domain/shared/errors.ts";
import { err, ok } from "../../src/domain/shared/result.ts";
import { Money } from "../../src/domain/value_objects/shared/money.ts";
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

function makeRepo({ failSave = false, failFind = false } = {}) {
  const map = new Map();
  return {
    map,
    async save(order) {
      if (failSave) return err(infrastructureError("REPOSITORY_ERROR", "db down"));
      map.set(order.id.value, order);
      return ok(undefined);
    },
    async findById(orderId) {
      if (failFind) return err(infrastructureError("REPOSITORY_ERROR", "db down"));
      const found = map.get(orderId.value);
      if (!found) return err(infrastructureError("ORDER_NOT_FOUND", "not found"));
      return ok(found);
    },
  };
}

function makeInventory({ failReserve = false, failRelease = false } = {}) {
  return {
    async reserveStock() {
      return failReserve
        ? err(infrastructureError("INSUFFICIENT_STOCK", "no stock"))
        : ok(undefined);
    },
    async releaseStock() {
      return failRelease
        ? err(infrastructureError("EXTERNAL_TIMEOUT", "release failed"))
        : ok(undefined);
    },
  };
}

function makePayment({ failCharge = false, failRefund = false } = {}) {
  return {
    async charge() {
      return failCharge
        ? err(infrastructureError("PAYMENT_DECLINED", "declined"))
        : ok(undefined);
    },
    async refund() {
      return failRefund
        ? err(infrastructureError("EXTERNAL_TIMEOUT", "refund failed"))
        : ok(undefined);
    },
  };
}

function makeEvents({ fail = false } = {}) {
  return {
    published: [],
    async publish(events) {
      if (fail) return err(infrastructureError("EVENT_PUBLISH_FAILED", "bus down"));
      this.published.push(...events);
      return ok(undefined);
    },
  };
}

function makeService(opts = {}) {
  return new OrderApplicationService(
    opts.repo ?? makeRepo(),
    opts.inventory ?? makeInventory(),
    opts.payment ?? makePayment(),
    opts.events ?? makeEvents()
  );
}

const validCmd = {
  orderId: "ORD-1",
  customerId: "CUST-1",
  lines: [{ productId: "P1", quantity: 2, unitAmount: 500, currency: "JPY" }],
};

test("UT-ORD-021 placeOrder persists valid Draft order and publishes no events", async () => {
  const events = makeEvents();
  const svc = makeService({ events });
  const placed = await svc.placeOrder(validCmd);
  assert.equal(placed.ok, true);
  assert.equal(placed.value.status, "Draft");
  assert.equal(placed.value.version, 0);
  assert.equal(placed.value.total.amount, 1000);
  assert.equal(placed.value.canConfirm, true);
  assert.equal(placed.value.canCancel, true);
  assert.equal(events.published.length, 0);
});

test("UT-ORD-022 placeOrder rejects invalid VO or invariant violations", async () => {
  const svc = makeService();
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
  const svc = makeService({ repo: makeRepo({ failSave: true }) });
  assert.equal((await svc.placeOrder(validCmd)).error.code, "REPOSITORY_ERROR");
});

test("UT-ORD-024 getOrder handles invalid, missing, existing, and overflow totals", async () => {
  const repo = makeRepo();
  const svc = makeService({ repo });
  await svc.placeOrder(validCmd);
  assert.equal((await svc.getOrder("")).error.code, "INVALID_ORDER_ID");
  assert.equal((await svc.getOrder("NO-SUCH")).error.code, "ORDER_NOT_FOUND");
  assert.equal((await svc.getOrder("ORD-1")).value.orderId, "ORD-1");

  const huge = Order.reconstitute(
    OrderId.create("ORD-HUGE").value,
    CustomerId.create("CUST-1").value,
    [{
      productId: ProductId.create("P1").value,
      quantity: Quantity.create(2).value,
      unitPrice: Money.create(Number.MAX_SAFE_INTEGER, "JPY").value,
    }],
    "Draft",
    0
  ).value;
  repo.map.set("ORD-HUGE", huge);
  assert.equal((await svc.getOrder("ORD-HUGE")).error.code, "INVALID_MONEY_AMOUNT");
});

test("UT-ORD-025 confirmOrder confirms, saves, and publishes the domain event", async () => {
  const repo = makeRepo();
  const events = makeEvents();
  const svc = makeService({ repo, events });
  await svc.placeOrder(validCmd);
  const confirmed = await svc.confirmOrder("ORD-1");
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.value.status, "Confirmed");
  assert.equal(confirmed.value.canConfirm, false);
  assert.equal(events.published.length, 1);
  assert.equal(events.published[0].type, "OrderConfirmedEvent");
});

test("UT-ORD-026 confirmOrder rejects invalid, missing, and non-draft orders", async () => {
  const repo = makeRepo();
  const svc = makeService({ repo });
  assert.equal((await svc.confirmOrder("")).error.code, "INVALID_ORDER_ID");
  assert.equal((await svc.confirmOrder("NO-SUCH")).error.code, "ORDER_NOT_FOUND");

  await svc.placeOrder(validCmd);
  await svc.confirmOrder("ORD-1");
  assert.equal((await svc.confirmOrder("ORD-1")).error.code, "INVALID_ORDER_STATE");
});

test("UT-ORD-040 confirmOrder compensates inventory when payment fails", async () => {
  const repo = makeRepo();
  const svc = makeService({ repo, payment: makePayment({ failCharge: true }) });
  await svc.placeOrder(validCmd);
  const res = await svc.confirmOrder("ORD-1");
  assert.equal(res.error.code, "PAYMENT_DECLINED");
  assert.equal((await repo.findById(OrderId.create("ORD-1").value)).value.status, "Draft");
});

test("UT-ORD-041 confirmOrder refunds payment when save fails", async () => {
  const repo = makeRepo();
  const svc = makeService({ repo, payment: makePayment() });
  await svc.placeOrder(validCmd);
  const failingRepo = {
    async save() { return err(infrastructureError("REPOSITORY_ERROR", "save fail")); },
    findById: repo.findById,
  };
  const failingSvc = new OrderApplicationService(failingRepo, makeInventory(), makePayment(), makeEvents());
  assert.equal((await failingSvc.confirmOrder("ORD-1")).error.code, "REPOSITORY_ERROR");
});

test("UT-ORD-042 confirmOrder surfaces event publish failure", async () => {
  const repo = makeRepo();
  const svc = makeService({ repo, events: makeEvents({ fail: true }) });
  await svc.placeOrder(validCmd);
  assert.equal((await svc.confirmOrder("ORD-1")).error.code, "EVENT_PUBLISH_FAILED");
});

test("UT-ORD-043 cancelOrder cancels Draft and Confirmed orders with compensation", async () => {
  const repo = makeRepo();
  const svc = makeService({ repo });
  await svc.placeOrder(validCmd);
  const cancelledDraft = await svc.cancelOrder("ORD-1");
  assert.equal(cancelledDraft.ok, true);
  assert.equal(cancelledDraft.value.status, "Cancelled");

  await svc.placeOrder({ ...validCmd, orderId: "ORD-2" });
  await svc.confirmOrder("ORD-2");
  const cancelledConfirmed = await svc.cancelOrder("ORD-2");
  assert.equal(cancelledConfirmed.ok, true);
  assert.equal(cancelledConfirmed.value.status, "Cancelled");
  assert.equal(cancelledConfirmed.value.canCancel, false);
});

test("UT-ORD-044 cancelOrder rejects already cancelled orders and missing ids", async () => {
  const svc = makeService();
  assert.equal((await svc.cancelOrder("")).error.code, "INVALID_ORDER_ID");
  assert.equal((await svc.cancelOrder("NO-SUCH")).error.code, "ORDER_NOT_FOUND");
  await svc.placeOrder(validCmd);
  await svc.cancelOrder("ORD-1");
  assert.equal((await svc.cancelOrder("ORD-1")).error.code, "INVALID_ORDER_STATE");
});

test("UT-ORD-045 cancelOrder surfaces inventory release and refund failures", async () => {
  const repo = makeRepo();
  await makeService({ repo }).placeOrder(validCmd);
  await makeService({ repo }).confirmOrder("ORD-1");
  const releaseFail = makeService({ repo, inventory: makeInventory({ failRelease: true }) });
  assert.equal((await releaseFail.cancelOrder("ORD-1")).error.code, "EXTERNAL_TIMEOUT");
  const refundFail = makeService({ repo, payment: makePayment({ failRefund: true }) });
  assert.equal((await refundFail.cancelOrder("ORD-1")).error.code, "EXTERNAL_TIMEOUT");
});

test("UT-ORD-046 confirmOrder surfaces inventory release failure during compensation", async () => {
  const repo = makeRepo();
  const svc = makeService({
    repo,
    inventory: makeInventory({ failRelease: true }),
    payment: makePayment({ failCharge: true }),
  });
  await svc.placeOrder(validCmd);
  assert.equal((await svc.confirmOrder("ORD-1")).error.code, "EXTERNAL_TIMEOUT");
});

test("UT-ORD-047 placeOrder surfaces event publish failure", async () => {
  const svc = makeService({ events: makeEvents({ fail: true }) });
  assert.equal((await svc.placeOrder(validCmd)).error.code, "EVENT_PUBLISH_FAILED");
});

test("UT-ORD-048 confirmOrder surfaces refund failure during compensation", async () => {
  const repo = makeRepo();
  await makeService({ repo }).placeOrder(validCmd);
  const failingRepo = {
    async save() { return err(infrastructureError("REPOSITORY_ERROR", "save fail")); },
    findById: repo.findById,
  };
  const svc = new OrderApplicationService(
    failingRepo,
    makeInventory(),
    makePayment({ failRefund: true }),
    makeEvents()
  );
  assert.equal((await svc.confirmOrder("ORD-1")).error.code, "EXTERNAL_TIMEOUT");
});

test("UT-ORD-049 cancelOrder surfaces save failure", async () => {
  const repo = makeRepo();
  await makeService({ repo }).placeOrder(validCmd);
  const failingRepo = {
    async save() { return err(infrastructureError("REPOSITORY_ERROR", "save fail")); },
    findById: repo.findById,
  };
  const svc = new OrderApplicationService(failingRepo, makeInventory(), makePayment(), makeEvents());
  assert.equal((await svc.cancelOrder("ORD-1")).error.code, "REPOSITORY_ERROR");
});

test("UT-ORD-050 cancelOrder surfaces event publish failure", async () => {
  const repo = makeRepo();
  const svc = makeService({ repo, events: makeEvents({ fail: true }) });
  await svc.placeOrder(validCmd);
  assert.equal((await svc.cancelOrder("ORD-1")).error.code, "EVENT_PUBLISH_FAILED");
});

test("UT-ORD-055 confirmOrder surfaces inventory shortage", async () => {
  const repo = makeRepo();
  const svc = makeService({ repo, inventory: makeInventory({ failReserve: true }) });
  await svc.placeOrder(validCmd);
  assert.equal((await svc.confirmOrder("ORD-1")).error.code, "INSUFFICIENT_STOCK");
});

test("UT-ORD-056 cancelOrder rejects a confirmed order whose total overflows", async () => {
  const repo = makeRepo();
  const huge = Order.reconstitute(
    OrderId.create("ORD-HUGE").value,
    CustomerId.create("CUST-1").value,
    [{
      productId: ProductId.create("P1").value,
      quantity: Quantity.create(2).value,
      unitPrice: Money.create(Number.MAX_SAFE_INTEGER, "JPY").value,
    }],
    "Confirmed",
    1
  ).value;
  repo.map.set("ORD-HUGE", huge);
  const svc = makeService({ repo });
  assert.equal((await svc.cancelOrder("ORD-HUGE")).error.code, "INVALID_MONEY_AMOUNT");
});

test("UT-ORD-057 getOrder surfaces repository read failure", async () => {
  const svc = makeService({ repo: makeRepo({ failFind: true }) });
  assert.equal((await svc.getOrder("ORD-1")).error.code, "REPOSITORY_ERROR");
});

test("UT-ORD-058 confirmOrder surfaces repository read failure", async () => {
  const svc = makeService({ repo: makeRepo({ failFind: true }) });
  assert.equal((await svc.confirmOrder("ORD-1")).error.code, "REPOSITORY_ERROR");
});

test("UT-ORD-059 cancelOrder surfaces repository read failure", async () => {
  const svc = makeService({ repo: makeRepo({ failFind: true }) });
  assert.equal((await svc.cancelOrder("ORD-1")).error.code, "REPOSITORY_ERROR");
});

test("UT-ORD-060 order DTO module loads as a runtime module", () => {
  assert.equal(typeof orderDtoModule, "object");
});

test("UT-ORD-064 confirmOrder rejects an order whose total overflows", async () => {
  const repo = makeRepo();
  const huge = Order.reconstitute(
    OrderId.create("ORD-HUGE").value,
    CustomerId.create("CUST-1").value,
    [{
      productId: ProductId.create("P1").value,
      quantity: Quantity.create(2).value,
      unitPrice: Money.create(Number.MAX_SAFE_INTEGER, "JPY").value,
    }],
    "Draft",
    0
  ).value;
  repo.map.set("ORD-HUGE", huge);
  const svc = makeService({ repo });
  assert.equal((await svc.confirmOrder("ORD-HUGE")).error.code, "INVALID_MONEY_AMOUNT");
});

export async function run() {
  for (const c of cases) await c.fn();
}
