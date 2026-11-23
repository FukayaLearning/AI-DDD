from html import escape
from src.application.dtos.order.order_dto import OrderSummaryDto
from src.domain.shared.errors import DomainError
from src.presentation.i18n.en import MESSAGES as EN_MESSAGES


def localize_error(messages: dict, error: DomainError) -> str:
    localized = messages.get("errorMessages", {})
    return localized.get(error.code, error.message)


def layout(locale: str, title: str, content: str) -> str:
    return f"<!doctype html><html lang='{escape(locale)}'><head><meta charset='utf-8'><title>{escape(title)}</title></head><body><main>{content}</main></body></html>"


def render_create_order_page(error: DomainError | None, messages: dict[str, str] = EN_MESSAGES) -> str:
    banner = ""
    if error is not None:
        banner = f"<div data-testid='error-banner'>{escape(error.code)}: {escape(localize_error(messages, error))}</div>"
    return layout(
        messages["locale"],
        messages["placeOrderTitle"],
        f"""<h1>{escape(messages["placeOrderTitle"])}</h1>
{banner}
<form method="POST" action="/orders">
  <input name="orderId" placeholder="Order ID" />
  <input name="customerId" placeholder="Customer ID" />
  <input name="productId" placeholder="Product ID" />
  <input name="quantity" type="number" value="1" />
  <input name="unitAmount" type="number" value="1000" />
  <select name="currency"><option value="JPY">JPY</option><option value="USD">USD</option></select>
  <button type="submit" data-testid="place-order-btn">{escape(messages["placeOrderButton"])}</button>
</form>""",
    )


def render_order_detail_page(
    order: OrderSummaryDto,
    error: DomainError | None,
    messages: dict[str, str] = EN_MESSAGES,
) -> str:
    banner = ""
    if error is not None:
        banner = f"<div data-testid='error-banner'>{escape(error.code)}: {escape(localize_error(messages, error))}</div>"
    rows = "".join(
        f"<tr><td>{escape(l.product_id)}</td><td>{l.quantity}</td><td>{l.unit_price.amount} {l.unit_price.currency}</td></tr>"
        for l in order.lines
    )
    confirm_disabled = "" if order.status == "Draft" else " disabled"
    cancel_disabled = " disabled" if order.status == "Cancelled" else ""
    oid = escape(order.order_id)
    return layout(
        messages["locale"],
        f"{messages['orderPrefix']} {order.order_id}",
        f"""<h1>{escape(messages["orderPrefix"])} {oid}</h1>
{banner}
<p>{escape(messages["customerLabel"])}: <span data-testid="customer-id">{escape(order.customer_id)}</span></p>
<p>{escape(messages["statusLabel"])}: <span data-testid="order-status">{order.status}</span></p>
<p>{escape(messages["totalLabel"])}: <span data-testid="order-total">{order.total.amount} {order.total.currency}</span></p>
<table><tbody data-testid="order-lines">{rows}</tbody></table>
<form method="POST" action="/orders/{oid}/confirm">
  <button type="submit" data-testid="confirm-btn"{confirm_disabled}>{escape(messages["confirmButton"])}</button>
</form>
<form method="POST" action="/orders/{oid}/cancel">
  <button type="submit" data-testid="cancel-btn"{cancel_disabled}>{escape(messages["cancelButton"])}</button>
</form>""",
    )
