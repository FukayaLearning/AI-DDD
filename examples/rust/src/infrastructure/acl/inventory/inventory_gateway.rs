use crate::application::shared::ports::InventoryPort;
use crate::domain::order::order::OrderLine;
use crate::domain::shared::errors::DomainError;
use crate::domain::shared::result::DomainResult;
use crate::domain::shared::value_objects::OrderId;
use crate::infrastructure::drivers::http::http_driver::HttpJsonDriver;

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
