import http from "node:http";
import type { OrderUseCases } from "../../../application/services/order/order_service.ts";
import type { Currency } from "../../../domain/value_objects/shared/money.ts";
import type { OrderError } from "../../../domain/shared/errors.ts";
import type { PlaceOrderLineInput } from "../../../application/dtos/order/order_dto.ts";
import { enMessages, type OrderMessages } from "../../i18n/en.ts";
import {
  escapeHtml,
  layout,
  localizeError,
  renderCreateOrderPage,
  renderOrderDetailPage,
} from "../../views/order/order_view.ts";

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

function parseLines(form: URLSearchParams): PlaceOrderLineInput[] {
  const productIds = form.getAll("productId");
  const quantities = form.getAll("quantity");
  const unitAmounts = form.getAll("unitAmount");
  const currencies = form.getAll("currency");
  const count = Math.max(
    productIds.length,
    quantities.length,
    unitAmounts.length,
    currencies.length
  );
  const lines: PlaceOrderLineInput[] = [];
  for (let i = 0; i < count; i++) {
    lines.push({
      productId: productIds[i] ?? "",
      quantity: Number(quantities[i] ?? "0"),
      unitAmount: Number(unitAmounts[i] ?? "0"),
      currency: (currencies[i] ?? "") as Currency,
    });
  }
  return lines;
}

function renderErrorPage(
  res: http.ServerResponse,
  status: number,
  messages: OrderMessages,
  title: string,
  error: OrderError
): void {
  sendHtml(
    res,
    status,
    layout(
      messages.locale,
      title,
      `<div data-testid="error-banner">${escapeHtml(error.code)}: ${escapeHtml(localizeError(messages, error))}</div>`
    )
  );
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
          renderErrorPage(res, 404, messages, messages.orderNotFoundTitle, result.error);
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
          orderId: form.get("orderId") ?? "",
          customerId: form.get("customerId") ?? "",
          lines: parseLines(form),
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
            renderErrorPage(res, 404, messages, messages.orderNotFoundTitle, result.error);
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
            renderErrorPage(res, 404, messages, messages.orderNotFoundTitle, result.error);
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
