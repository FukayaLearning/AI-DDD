use crate::application::dtos::order::order_dto::{PlaceOrderCommand, PlaceOrderLineInput};
use crate::application::services::order::order_service::OrderUseCases;
use crate::domain::shared::result::DomainResult;
use crate::domain::value_objects::shared::money::Currency;
use crate::presentation::i18n::en::OrderMessages;
use crate::presentation::views::order::order_view::{
    escape_html, layout, localized_error, render_create_order_page, render_order_detail_page,
};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;

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
                                escape_html(localized_error(msg, &e))
                            ),
                        ),
                    ),
                };
            }
        }
        return (
            404,
            layout(
                msg.locale,
                msg.not_found_title,
                &format!(
                    "<p data-testid='not-found'>{}</p>",
                    escape_html(msg.not_found_body)
                ),
            ),
        );
    }

    if method == "POST" {
        if path == "/orders" {
            let form = parse_form(body);
            let cur = match form.get("currency").map(String::as_str) {
                Some("USD") => Currency::USD,
                _ => Currency::JPY,
            };
            let qty: u32 = form
                .get("quantity")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0);
            let amt: i64 = form
                .get("unitAmount")
                .and_then(|s| s.parse().ok())
                .unwrap_or(-1);
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
                        DomainResult::Ok(cur) => {
                            (422, render_order_detail_page(&cur, Some(&e), msg))
                        }
                        DomainResult::Err(_) => (
                            404,
                            layout(
                                msg.locale,
                                msg.order_not_found_title,
                                &format!(
                                    "<div data-testid='error-banner'>{}: {}</div>",
                                    escape_html(&e.code),
                                    escape_html(localized_error(msg, &e))
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
                        DomainResult::Ok(cur) => {
                            (422, render_order_detail_page(&cur, Some(&e), msg))
                        }
                        DomainResult::Err(_) => (
                            404,
                            layout(
                                msg.locale,
                                msg.order_not_found_title,
                                &format!(
                                    "<div data-testid='error-banner'>{}: {}</div>",
                                    escape_html(&e.code),
                                    escape_html(localized_error(msg, &e))
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
        layout(
            msg.locale,
            msg.not_found_title,
            &format!(
                "<p data-testid='not-found'>{}</p>",
                escape_html(msg.not_found_body)
            ),
        ),
    )
}

pub fn serve_single_connection<U: OrderUseCases>(
    mut stream: TcpStream,
    use_cases: &U,
    msg: &OrderMessages,
) {
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
