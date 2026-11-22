import http from "node:http";
import type { OrderSummaryDto, OrderUseCases } from "../../../application/order/commands/order_service.ts";
import type { DomainError } from "../../../domain/shared/errors.ts";
import type { Currency } from "../../../domain/shared/value_objects.ts";
import { enMessages, type OrderMessages } from "../i18n/en.ts";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function localizeError(messages: OrderMessages, error: DomainError): string {
  return messages.errorMessages[error.code] ?? error.message;
}

function layout(locale: string, title: string, content: string): string {
  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body><main>${content}</main></body>
</html>`;
}

export function renderCreateOrderPage(error: DomainError | null, messages: OrderMessages = enMessages): string {
  const banner = error
    ? `<div data-testid="error-banner">${escapeHtml(error.code)}: ${escapeHtml(localizeError(messages, error))}</div>`
    : "";
  return layout(
    messages.locale,
    messages.placeOrderTitle,
    `<h1>${escapeHtml(messages.placeOrderTitle)}</h1>
${banner}
<form method="POST" action="/orders">
  <input name="orderId" placeholder="Order ID" />
  <input name="customerId" placeholder="Customer ID" />
  <input name="productId" placeholder="Product ID" />
  <input name="quantity" type="number" value="1" />
  <input name="unitAmount" type="number" value="1000" />
  <select name="currency"><option value="JPY">JPY</option><option value="USD">USD</option></select>
  <button type="submit" data-testid="place-order-btn">${escapeHtml(messages.placeOrderButton)}</button>
</form>`
  );
}

export function renderOrderDetailPage(
  order: OrderSummaryDto,
  error: DomainError | null,
  messages: OrderMessages = enMessages
): string {
  const banner = error
    ? `<div data-testid="error-banner">${escapeHtml(error.code)}: ${escapeHtml(localizeError(messages, error))}</div>`
    : "";
  const linesHtml = order.lines
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.productId)}</td><td>${l.quantity}</td><td>${l.unitPrice.amount} ${l.unitPrice.currency}</td></tr>`
    )
    .join("");
  const confirmDisabled = order.status === "Draft" ? "" : " disabled";
  const cancelDisabled = order.status === "Cancelled" ? " disabled" : "";

  return layout(
    messages.locale,
    `${messages.orderPrefix} ${order.orderId}`,
    `<h1>${escapeHtml(messages.orderPrefix)} ${escapeHtml(order.orderId)}</h1>
${banner}
<p>${escapeHtml(messages.customerLabel)}: <span data-testid="customer-id">${escapeHtml(order.customerId)}</span></p>
<p>${escapeHtml(messages.statusLabel)}: <span data-testid="order-status">${order.status}</span></p>
<p>${escapeHtml(messages.totalLabel)}: <span data-testid="order-total">${order.total.amount} ${order.total.currency}</span></p>
<table><tbody data-testid="order-lines">${linesHtml}</tbody></table>
<form method="POST" action="/orders/${escapeHtml(order.orderId)}/confirm">
  <button type="submit" data-testid="confirm-btn"${confirmDisabled}>${escapeHtml(messages.confirmButton)}</button>
</form>
<form method="POST" action="/orders/${escapeHtml(order.orderId)}/cancel">
  <button type="submit" data-testid="cancel-btn"${cancelDisabled}>${escapeHtml(messages.cancelButton)}</button>
</form>`
  );
}

async function readFormParams(req: http.IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function sendHtml(res: http.ServerResponse, status: number, html: string): void {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

// @implements REQ-ORD-004
export function createOrderWebHandler(useCases: OrderUseCases, messages: OrderMessages = enMessages) {
  return async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    const method = req.method as string;
    const urlPath = req.url as string;

    if (method === "GET") {
      if (urlPath === "/") {
        sendHtml(res, 200, renderCreateOrderPage(null, messages));
        return;
      }
      const detailMatch = urlPath.match(/^\/orders\/([^/]+)$/);
      if (detailMatch) {
        const result = await useCases.getOrder(decodeURIComponent(detailMatch[1]));
        if (!result.ok) {
          sendHtml(
            res,
            404,
            layout(
              messages.locale,
              messages.orderNotFoundTitle,
              `<div data-testid="error-banner">${escapeHtml(result.error.code)}: ${escapeHtml(localizeError(messages, result.error))}</div>`
            )
          );
          return;
        }
        sendHtml(res, 200, renderOrderDetailPage(result.value, null, messages));
        return;
      }
      sendHtml(res, 404, layout(messages.locale, messages.notFoundTitle, `<p data-testid="not-found">${escapeHtml(messages.notFoundBody)}</p>`));
      return;
    }

    if (method === "POST") {
      if (urlPath === "/orders") {
        const form = await readFormParams(req);
        const result = await useCases.placeOrder({
          orderId: form.get("orderId") as string,
          customerId: form.get("customerId") as string,
          lines: [
            {
              productId: form.get("productId") as string,
              quantity: Number(form.get("quantity")),
              unitAmount: Number(form.get("unitAmount")),
              currency: form.get("currency") as Currency,
            },
          ],
        });
        if (!result.ok) {
          sendHtml(res, 422, renderCreateOrderPage(result.error, messages));
          return;
        }
        sendHtml(res, 200, renderOrderDetailPage(result.value, null, messages));
        return;
      }

      const confirmMatch = urlPath.match(/^\/orders\/([^/]+)\/confirm$/);
      if (confirmMatch) {
        const orderId = decodeURIComponent(confirmMatch[1]);
        const result = await useCases.confirmOrder(orderId);
        if (!result.ok) {
          const current = await useCases.getOrder(orderId);
          if (!current.ok) {
            sendHtml(
              res,
              404,
              layout(
                messages.locale,
                messages.orderNotFoundTitle,
                `<div data-testid="error-banner">${escapeHtml(result.error.code)}: ${escapeHtml(localizeError(messages, result.error))}</div>`
              )
            );
            return;
          }
          sendHtml(res, 422, renderOrderDetailPage(current.value, result.error, messages));
          return;
        }
        sendHtml(res, 200, renderOrderDetailPage(result.value, null, messages));
        return;
      }

      const cancelMatch = urlPath.match(/^\/orders\/([^/]+)\/cancel$/);
      if (cancelMatch) {
        const orderId = decodeURIComponent(cancelMatch[1]);
        const result = await useCases.cancelOrder(orderId);
        if (!result.ok) {
          const current = await useCases.getOrder(orderId);
          if (!current.ok) {
            sendHtml(
              res,
              404,
              layout(
                messages.locale,
                messages.orderNotFoundTitle,
                `<div data-testid="error-banner">${escapeHtml(result.error.code)}: ${escapeHtml(localizeError(messages, result.error))}</div>`
              )
            );
            return;
          }
          sendHtml(res, 422, renderOrderDetailPage(current.value, result.error, messages));
          return;
        }
        sendHtml(res, 200, renderOrderDetailPage(result.value, null, messages));
        return;
      }
    }

    sendHtml(res, 404, layout(messages.locale, messages.notFoundTitle, `<p data-testid="not-found">${escapeHtml(messages.notFoundBody)}</p>`));
  };
}

export async function startOrderWebServer(
  useCases: OrderUseCases,
  port = 0,
  messages: OrderMessages = enMessages
): Promise<{ server: http.Server; baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(createOrderWebHandler(useCases, messages));
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const addr = server.address() as import("node:net").AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); }),
  };
}
