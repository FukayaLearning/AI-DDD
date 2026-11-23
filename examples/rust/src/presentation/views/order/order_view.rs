use crate::application::dtos::order::order_dto::OrderSummaryDto;
use crate::domain::entities::order::order::OrderStatus;
use crate::domain::shared::errors::DomainError;
use crate::presentation::i18n::en::OrderMessages;

pub fn localized_error<'a>(msg: &'a OrderMessages, err: &'a DomainError) -> &'a str {
    msg.error_message(&err.code).unwrap_or(err.message.as_str())
}

pub fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

pub fn layout(locale: &str, title: &str, content: &str) -> String {
    format!(
        "<!doctype html><html lang='{}'><head><meta charset='utf-8'><title>{}</title></head><body><main>{}</main></body></html>",
        escape_html(locale),
        escape_html(title),
        content
    )
}

pub fn render_create_order_page(error: Option<&DomainError>, msg: &OrderMessages) -> String {
    let banner = match error {
        Some(e) => format!(
            "<div data-testid='error-banner'>{}: {}</div>",
            escape_html(&e.code),
            escape_html(localized_error(msg, e))
        ),
        None => String::new(),
    };
    layout(
        msg.locale,
        msg.place_order_title,
        &format!(
            r#"<h1>{}</h1>{}
<form method="POST" action="/orders">
  <input name="orderId" placeholder="Order ID" />
  <input name="customerId" placeholder="Customer ID" />
  <input name="productId" placeholder="Product ID" />
  <input name="quantity" type="number" value="1" />
  <input name="unitAmount" type="number" value="1000" />
  <select name="currency"><option value="JPY">JPY</option><option value="USD">USD</option></select>
  <button type="submit" data-testid="place-order-btn">{}</button>
</form>"#,
            escape_html(msg.place_order_title),
            banner,
            escape_html(msg.place_order_button)
        ),
    )
}

pub fn render_order_detail_page(
    order: &OrderSummaryDto,
    error: Option<&DomainError>,
    msg: &OrderMessages,
) -> String {
    let banner = match error {
        Some(e) => format!(
            "<div data-testid='error-banner'>{}: {}</div>",
            escape_html(&e.code),
            escape_html(localized_error(msg, e))
        ),
        None => String::new(),
    };
    let rows: String = order
        .lines
        .iter()
        .map(|l| {
            format!(
                "<tr><td>{}</td><td>{}</td><td>{} {}</td></tr>",
                escape_html(&l.product_id),
                l.quantity,
                l.unit_price.amount,
                l.unit_price.currency.as_str()
            )
        })
        .collect();
    let confirm_disabled = if order.status == OrderStatus::Draft {
        ""
    } else {
        " disabled"
    };
    let cancel_disabled = if order.status == OrderStatus::Cancelled {
        " disabled"
    } else {
        ""
    };
    let oid = escape_html(&order.order_id);
    layout(
        msg.locale,
        &format!("{} {}", msg.order_prefix, order.order_id),
        &format!(
            r#"<h1>{} {}</h1>{}
<p>{}: <span data-testid="customer-id">{}</span></p>
<p>{}: <span data-testid="order-status">{}</span></p>
<p>{}: <span data-testid="order-total">{} {}</span></p>
<table><tbody data-testid="order-lines">{}</tbody></table>
<form method="POST" action="/orders/{}/confirm"><button type="submit" data-testid="confirm-btn"{}>{}</button></form>
<form method="POST" action="/orders/{}/cancel"><button type="submit" data-testid="cancel-btn"{}>{}</button></form>"#,
            escape_html(msg.order_prefix),
            oid,
            banner,
            escape_html(msg.customer_label),
            escape_html(&order.customer_id),
            escape_html(msg.status_label),
            order.status.as_str(),
            escape_html(msg.total_label),
            order.total.amount,
            order.total.currency.as_str(),
            rows,
            oid,
            confirm_disabled,
            escape_html(msg.confirm_button),
            oid,
            cancel_disabled,
            escape_html(msg.cancel_button)
        ),
    )
}
