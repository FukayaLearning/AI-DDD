use crate::domain::errors::DomainError;
use crate::domain::order::OrderLine;
use crate::domain::ports::{InventoryPort, PaymentPort};
use crate::domain::result::DomainResult;
use crate::domain::value_objects::{Money, OrderId};
use crate::infrastructure::drivers::http_driver::HttpJsonDriver;

pub fn extract_http_status(raw_response: &str) -> u16 {
    raw_response
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok())
        .unwrap_or(500)
}

pub fn map_inventory_status(status: u16) -> DomainResult<(), DomainError> {
    match status {
        200 => DomainResult::Ok(()),
        409 => DomainResult::Err(DomainError::new("INSUFFICIENT_STOCK", "Requested inventory is unavailable")),
        _ => DomainResult::Err(DomainError::new("EXTERNAL_TIMEOUT", "Inventory service error")),
    }
}

pub fn map_payment_status(status: u16) -> DomainResult<(), DomainError> {
    match status {
        200 => DomainResult::Ok(()),
        402 => DomainResult::Err(DomainError::new("PAYMENT_DECLINED", "Payment gateway declined the charge")),
        _ => DomainResult::Err(DomainError::new("EXTERNAL_TIMEOUT", "Payment service error")),
    }
}

pub struct InventoryGateway<D: HttpJsonDriver> {
    driver: D,
    endpoint_url: String,
}

impl<D: HttpJsonDriver> InventoryGateway<D> {
    pub fn new(driver: D, endpoint_url: impl Into<String>) -> Self {
        Self {
            driver,
            endpoint_url: endpoint_url.into(),
        }
    }
}

impl<D: HttpJsonDriver> InventoryPort for InventoryGateway<D> {
    fn reserve_stock(&self, order_id: &OrderId, lines: &[OrderLine]) -> DomainResult<(), DomainError> {
        let items: Vec<String> = lines
            .iter()
            .map(|l| format!(r#"{{"productId":"{}","quantity":{}}}"#, l.product_id.0, l.quantity.0))
            .collect();
        let body = format!(r#"{{"orderId":"{}","items":[{}]}}"#, order_id.0, items.join(","));
        match self.driver.post_json_raw(&self.endpoint_url, &body) {
            Ok(raw) => map_inventory_status(extract_http_status(&raw)),
            Err(_) => DomainResult::Err(DomainError::new("EXTERNAL_TIMEOUT", "Inventory service timed out")),
        }
    }
}

pub struct PaymentGateway<D: HttpJsonDriver> {
    driver: D,
    endpoint_url: String,
}

impl<D: HttpJsonDriver> PaymentGateway<D> {
    pub fn new(driver: D, endpoint_url: impl Into<String>) -> Self {
        Self {
            driver,
            endpoint_url: endpoint_url.into(),
        }
    }
}

impl<D: HttpJsonDriver> PaymentPort for PaymentGateway<D> {
    fn charge(&self, order_id: &OrderId, amount: Money) -> DomainResult<(), DomainError> {
        let body = format!(
            r#"{{"orderId":"{}","amount":{},"currency":"{}"}}"#,
            order_id.0,
            amount.amount,
            amount.currency.as_str()
        );
        match self.driver.post_json_raw(&self.endpoint_url, &body) {
            Ok(raw) => map_payment_status(extract_http_status(&raw)),
            Err(_) => DomainResult::Err(DomainError::new("EXTERNAL_TIMEOUT", "Payment service timed out")),
        }
    }
}
