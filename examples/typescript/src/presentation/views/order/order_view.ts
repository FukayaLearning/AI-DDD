import type { OrderSummaryDto } from "../../../application/dtos/order/order_dto.ts";
import type { DomainError } from "../../../domain/shared/errors.ts";
import { enMessages, type OrderMessages } from "../../i18n/en.ts";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function localizeError(messages: OrderMessages, error: DomainError): string {
  return messages.errorMessages[error.code] ?? error.message;
}

export function layout(locale: string, title: string, content: string): string {
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
