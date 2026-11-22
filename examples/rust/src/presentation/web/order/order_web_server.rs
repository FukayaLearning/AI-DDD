use crate::presentation::web::i18n::en::OrderMessages;
use crate::application::order::commands::order_service::{
    OrderSummaryDto, OrderUseCases, PlaceOrderCommand, PlaceOrderLineInput,
};
use crate::domain::shared::errors::DomainError;
use crate::domain::order::order::OrderStatus;
use crate::domain::shared::result::DomainResult;
use crate::domain::shared::value_objects::Currency;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn layout(locale: &str, title: &str, content: &str) -> String {
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
            escape_html(&e.message)
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

pub fn render_order_detail_page(order: &OrderSummaryDto, error: Option<&DomainError>, msg: &OrderMessages) -> String {
    let banner = match error {
        Some(e) => format!(
            "<div data-testid='error-banner'>{}: {}</div>",
            escape_html(&e.code),
            escape_html(&e.message)
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
    let confirm_disabled = if order.status == OrderStatus::Draft { "" } else { " disabled" };
    let cancel_disabled = if order.status == OrderStatus::Cancelled { " disabled" } else { "" };
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

fn parse_form(body: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for pair in body.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            map.insert(k.to_string(), v.replace('+', " "));
        }
    }
    map
}

// @implements REQ-ORD-004
pub fn handle_http_request<U: OrderUseCases>(
    use_cases: &U,
    method: &str,
    path: &str,
    body: &str,
    msg: &OrderMessages,
) -> (u16, String) {
    if method == "GET" {
        if path == "/" {
            return (200, render_create_order_page(None, msg));
        }
        if let Some(oid) = path.strip_prefix("/orders/") {
            if !oid.is_empty() && !oid.contains('/') {
                return match use_cases.get_order(oid) {
                    DomainResult::Ok(order) => (200, render_order_detail_page(&order, None, msg)),
                    DomainResult::Err(e) => (
                        404,
                        layout(
                            msg.locale,
                            msg.order_not_found_title,
                            &format!(
                                "<div data-testid='error-banner'>{}: {}</div>",
                                escape_html(&e.code),
                                escape_html(&e.message)
                            ),
                        ),
                    ),
                };
            }
        }
        return (
            404,
            layout(msg.locale, msg.not_found_title, "<p data-testid='not-found'>Page Not Found</p>"),
        );
    }

    if method == "POST" {
        if path == "/orders" {
            let form = parse_form(body);
            let cur = match form.get("currency").map(String::as_str) {
                Some("USD") => Currency::USD,
                _ => Currency::JPY,
            };
            let qty: u32 = form.get("quantity").and_then(|s| s.parse().ok()).unwrap_or(0);
            let amt: i64 = form.get("unitAmount").and_then(|s| s.parse().ok()).unwrap_or(-1);
            let cmd = PlaceOrderCommand {
                order_id: form.get("orderId").cloned().unwrap_or_default(),
                customer_id: form.get("customerId").cloned().unwrap_or_default(),
                lines: vec![PlaceOrderLineInput {
                    product_id: form.get("productId").cloned().unwrap_or_default(),
                    quantity: qty,
                    unit_amount: amt,
                    currency: cur,
                }],
            };
            return match use_cases.place_order(cmd) {
                DomainResult::Ok(order) => (200, render_order_detail_page(&order, None, msg)),
                DomainResult::Err(e) => (422, render_create_order_page(Some(&e), msg)),
            };
        }
        if let Some(rest) = path.strip_prefix("/orders/") {
            if let Some(oid) = rest.strip_suffix("/confirm") {
                return match use_cases.confirm_order(oid) {
                    DomainResult::Ok(order) => (200, render_order_detail_page(&order, None, msg)),
                    DomainResult::Err(e) => match use_cases.get_order(oid) {
                        DomainResult::Ok(cur) => (422, render_order_detail_page(&cur, Some(&e), msg)),
                        DomainResult::Err(_) => (
                            404,
                            layout(
                                msg.locale,
                                msg.order_not_found_title,
                                &format!(
                                    "<div data-testid='error-banner'>{}: {}</div>",
                                    escape_html(&e.code),
                                    escape_html(&e.message)
                                ),
                            ),
                        ),
                    },
                };
            }
            if let Some(oid) = rest.strip_suffix("/cancel") {
                return match use_cases.cancel_order(oid) {
                    DomainResult::Ok(order) => (200, render_order_detail_page(&order, None, msg)),
                    DomainResult::Err(e) => match use_cases.get_order(oid) {
                        DomainResult::Ok(cur) => (422, render_order_detail_page(&cur, Some(&e), msg)),
                        DomainResult::Err(_) => (
                            404,
                            layout(
                                msg.locale,
                                msg.order_not_found_title,
                                &format!(
                                    "<div data-testid='error-banner'>{}: {}</div>",
                                    escape_html(&e.code),
                                    escape_html(&e.message)
                                ),
                            ),
                        ),
                    },
                };
            }
        }
    }

    (
        404,
        layout(msg.locale, msg.not_found_title, "<p data-testid='not-found'>Page Not Found</p>"),
    )
}

pub fn serve_single_connection<U: OrderUseCases>(mut stream: TcpStream, use_cases: &U, msg: &OrderMessages) {
    let mut raw = Vec::new();
    let mut buf = [0u8; 4096];
    let mut header_end = None;
    let mut content_length = 0usize;

    loop {
        let n = match stream.read(&mut buf) {
            Ok(0) | Err(_) => break,
            Ok(n) => n,
        };
        raw.extend_from_slice(&buf[..n]);
        if header_end.is_none() {
            if let Some(pos) = raw.windows(4).position(|w| w == b"\r\n\r\n") {
                header_end = Some(pos + 4);
                let headers_str = String::from_utf8_lossy(&raw[..pos]);
                for line in headers_str.lines() {
                    if let Some((k, v)) = line.split_once(':') {
                        if k.trim().eq_ignore_ascii_case("content-length") {
                            content_length = v.trim().parse().unwrap_or(0);
                        }
                    }
                }
            }
        }
        if let Some(end) = header_end {
            if raw.len() >= end + content_length {
                break;
            }
        }
    }

    let end = header_end.unwrap_or(raw.len());
    let head_str = String::from_utf8_lossy(&raw[..end]);
    let first_line = head_str.lines().next().unwrap_or("");
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("");
    let body_slice = if raw.len() >= end + content_length {
        &raw[end..end + content_length]
    } else {
        &raw[end..]
    };
    let body = String::from_utf8_lossy(body_slice);

    let (status_code, html) = handle_http_request(use_cases, method, path, &body, msg);
    let status_text = match status_code {
        200 => "OK",
        422 => "Unprocessable Entity",
        _ => "Not Found",
    };
    let response = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status_code,
        status_text,
        html.len(),
        html
    );
    let _ = stream.write_all(response.as_bytes());
}
