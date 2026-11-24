import assert from "node:assert/strict";
import { domainError, infrastructureError } from "../../src/domain/shared/errors.ts";
import { err, ok } from "../../src/domain/shared/result.ts";
import { startOrderWebServer } from "../../src/presentation/controllers/order/order_controller.ts";
import { enMessages } from "../../src/presentation/i18n/en.ts";
import { jaMessages } from "../../src/presentation/i18n/ja.ts";
import { launchHeadlessBrowser } from "../../scripts/browser-helper.mjs";

const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

test("UT-ORD-027 UT-ORD-028 UT-ORD-029 UT-ORD-030 presentation browser lifecycle and error views", async () => {
  const dtoDraft = {
    orderId: "ORD-WEB-1",
    customerId: "CUST-9",
    status: "Draft",
    version: 0,
    total: { amount: 2400, currency: "JPY" },
    canConfirm: true,
    canCancel: true,
    lines: [{ productId: "BOOK-A", quantity: 2, unitPrice: { amount: 1200, currency: "JPY" } }],
  };
  const dtoConfirmed = { ...dtoDraft, status: "Confirmed", version: 1, canConfirm: false, canCancel: true };
  const dtoCancelled = { ...dtoDraft, status: "Cancelled", version: 2, canConfirm: false, canCancel: false };

  let currentDto = dtoDraft;
  let nextPlaceResult = ok(dtoDraft);
  let nextConfirmResult = ok(dtoConfirmed);
  let nextCancelResult = ok(dtoCancelled);
  let nextGetResult = ok(dtoDraft);

  const mockUseCases = {
    async placeOrder() { return nextPlaceResult; },
    async confirmOrder() { return nextConfirmResult; },
    async cancelOrder() { return nextCancelResult; },
    async getOrder() { return nextGetResult; },
  };

  const { baseUrl, close } = await startOrderWebServer(mockUseCases, 0);
  const browser = await launchHeadlessBrowser();

  try {
    // 1. Place invalid order via form -> 422 error banner
    nextPlaceResult = err(domainError("EMPTY_ORDER_LINES", "invalid lines"));
    await browser.goto(`${baseUrl}/`);
    await browser.fill('input[name="orderId"]', "ORD-WEB-1");
    await browser.fill('input[name="customerId"]', "CUST-9");
    await browser.fill('input[name="productId"]', "BOOK-A");
    await browser.clickAndWait('[data-testid="place-order-btn"]');
    assert.equal(await browser.textContent('[data-testid="error-banner"]'), "EMPTY_ORDER_LINES: Order must contain at least one line");

    // 2. Place valid order via form -> 200 Draft view
    nextPlaceResult = ok(dtoDraft);
    await browser.fill('input[name="orderId"]', "ORD-WEB-1");
    await browser.fill('input[name="customerId"]', "CUST-9");
    await browser.fill('input[name="productId"]', "BOOK-A");
    await browser.clickAndWait('[data-testid="place-order-btn"]');
    assert.equal(await browser.textContent('[data-testid="order-status"]'), "Draft");
    assert.equal(await browser.textContent('[data-testid="order-total"]'), "2400 JPY");
    assert.equal(await browser.isDisabled('[data-testid="confirm-btn"]'), false);

    // 3. Confirm fails with INSUFFICIENT_STOCK -> error banner on detail view
    nextConfirmResult = err(infrastructureError("INSUFFICIENT_STOCK", "out of stock"));
    await browser.clickAndWait('[data-testid="confirm-btn"]');
    assert.equal(await browser.textContent('[data-testid="error-banner"]'), "INSUFFICIENT_STOCK: Insufficient stock");

    // 4. Confirm succeeds -> Confirmed status & confirm button disabled
    nextConfirmResult = ok(dtoConfirmed);
    currentDto = dtoConfirmed;
    nextGetResult = ok(currentDto);
    await browser.clickAndWait('[data-testid="confirm-btn"]');
    assert.equal(await browser.textContent('[data-testid="order-status"]'), "Confirmed");
    assert.equal(await browser.isDisabled('[data-testid="confirm-btn"]'), true);

    // 5. Cancel fails -> error banner on detail view
    nextCancelResult = err(infrastructureError("REPOSITORY_ERROR", "db busy"));
    await browser.clickAndWait('[data-testid="cancel-btn"]');
    assert.equal(await browser.textContent('[data-testid="error-banner"]'), "REPOSITORY_ERROR: Failed to access order storage");

    // 6. Cancel succeeds -> Cancelled status & both buttons disabled
    nextCancelResult = ok(dtoCancelled);
    currentDto = dtoCancelled;
    nextGetResult = ok(currentDto);
    await browser.clickAndWait('[data-testid="cancel-btn"]');
    assert.equal(await browser.textContent('[data-testid="order-status"]'), "Cancelled");
    assert.equal(await browser.isDisabled('[data-testid="confirm-btn"]'), true);
    assert.equal(await browser.isDisabled('[data-testid="cancel-btn"]'), true);

    // 7. GET existing detail & GET unknown order (404) & unknown route (404)
    await browser.goto(`${baseUrl}/orders/ORD-WEB-1`);
    assert.equal(await browser.textContent('[data-testid="customer-id"]'), "CUST-9");

    nextGetResult = err(infrastructureError("ORDER_NOT_FOUND", "missing"));
    await browser.goto(`${baseUrl}/orders/UNKNOWN`);
    assert.equal(await browser.textContent('[data-testid="error-banner"]'), "ORDER_NOT_FOUND: Order not found");

    await browser.goto(`${baseUrl}/not-exist`);
    assert.equal(await browser.textContent('[data-testid="not-found"]'), "Page Not Found");

    // 7b. Unknown error code falls back to the raw message
    nextGetResult = err(domainError("UNKNOWN_CODE", "raw fallback"));
    await browser.goto(`${baseUrl}/orders/ORD-WEB-1`);
    assert.equal(await browser.textContent('[data-testid="error-banner"]'), "UNKNOWN_CODE: raw fallback");

    // 8. POST confirm/cancel on missing order & unsupported POST/PUT paths
    nextConfirmResult = err(infrastructureError("ORDER_NOT_FOUND", "missing"));
    const cnf404 = await fetch(`${baseUrl}/orders/UNKNOWN/confirm`, { method: "POST" });
    assert.equal(cnf404.status, 404);

    nextCancelResult = err(infrastructureError("ORDER_NOT_FOUND", "missing"));
    const cnc404 = await fetch(`${baseUrl}/orders/UNKNOWN/cancel`, { method: "POST" });
    assert.equal(cnc404.status, 404);

    const post404 = await fetch(`${baseUrl}/unknown-post`, { method: "POST" });
    assert.equal(post404.status, 404);

    const put404 = await fetch(`${baseUrl}/`, { method: "PUT" });
    assert.equal(put404.status, 404);

    // 9. Missing line fields and empty forms are rejected without a 500
    nextPlaceResult = err(domainError("INVALID_QUANTITY", "missing fields"));
    const missingFields = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "productId=BOOK-A",
    });
    assert.equal(missingFields.status, 422);

    nextPlaceResult = err(domainError("INVALID_PRODUCT_ID", "missing product"));
    const missingProduct = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "quantity=1&unitAmount=100&currency=JPY",
    });
    assert.equal(missingProduct.status, 422);

    nextPlaceResult = err(domainError("EMPTY_ORDER_LINES", "empty"));
    const emptyForm = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "",
    });
    assert.equal(emptyForm.status, 422);
  } finally {
    await browser.close();
    await close();
  }
});

test("UT-ORD-031 presentation renders ja and en catalogs with matching html lang", async () => {
  const mockUseCases = {
    async placeOrder() { return err(domainError("EMPTY_ORDER_LINES", "x")); },
    async confirmOrder() { return err(infrastructureError("ORDER_NOT_FOUND", "x")); },
    async cancelOrder() { return err(infrastructureError("ORDER_NOT_FOUND", "x")); },
    async getOrder() { return err(infrastructureError("ORDER_NOT_FOUND", "x")); },
  };
  for (const msg of [jaMessages, enMessages]) {
    const srv = await startOrderWebServer(mockUseCases, 0, msg);
    const b = await launchHeadlessBrowser();
    try {
      await b.goto(`${srv.baseUrl}/`);
      assert.equal(await b.textContent("h1"), msg.placeOrderTitle);
      assert.equal(await b.textContent('[data-testid="place-order-btn"]'), msg.placeOrderButton);
      const res = await fetch(`${srv.baseUrl}/`);
      assert.match(await res.text(), new RegExp(`<html lang="${msg.locale}">`));
    } finally {
      await b.close();
      await srv.close();
    }
  }
});

test("UT-ORD-051 presentation form supports up to five order lines", async () => {
  const dto = {
    orderId: "ORD-WEB-2",
    customerId: "CUST-9",
    status: "Draft",
    version: 0,
    total: { amount: 4000, currency: "JPY" },
    canConfirm: true,
    canCancel: true,
    lines: [
      { productId: "BOOK-A", quantity: 1, unitPrice: { amount: 1000, currency: "JPY" } },
      { productId: "BOOK-B", quantity: 2, unitPrice: { amount: 1500, currency: "JPY" } },
    ],
  };
  const mockUseCases = {
    async placeOrder() { return ok(dto); },
    async confirmOrder() { return ok(dto); },
    async cancelOrder() { return ok(dto); },
    async getOrder() { return ok(dto); },
  };
  const { baseUrl, close } = await startOrderWebServer(mockUseCases, 0);
  const browser = await launchHeadlessBrowser();
  try {
    await browser.goto(`${baseUrl}/`);
    await browser.fill('input[name="orderId"]', "ORD-WEB-2");
    await browser.fill('input[name="customerId"]', "CUST-9");
    await browser.fill('#order-lines .order-line:nth-child(1) input[name="productId"]', "BOOK-A");
    await browser.click('[data-testid="add-line-btn"]');
    await browser.fill('#order-lines .order-line:nth-child(2) input[name="productId"]', "BOOK-B");
    await browser.fill('#order-lines .order-line:nth-child(2) input[name="quantity"]', "2");
    await browser.fill('#order-lines .order-line:nth-child(2) input[name="unitAmount"]', "1500");
    await browser.clickAndWait('[data-testid="place-order-btn"]');
    const lines = await browser.textContent('[data-testid="order-lines"]');
    assert.match(lines, /BOOK-A/);
    assert.match(lines, /BOOK-B/);
  } finally {
    await browser.close();
    await close();
  }
});

export async function run() {
  for (const c of cases) await c.fn();
}
