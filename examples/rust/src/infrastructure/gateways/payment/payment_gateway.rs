use crate::application::ports::payment::payment_port::PaymentPort;
use crate::domain::shared::errors::DomainError;
use crate::domain::shared::result::DomainResult;
use crate::domain::value_objects::shared::identifiers::OrderId;
use crate::domain::value_objects::shared::money::Money;
use crate::infrastructure::drivers::http::http_driver::HttpJsonDriver;
use crate::infrastructure::gateways::inventory::inventory_gateway::extract_http_status;

pub fn map_payment_status(status: u16) -> DomainResult<(), DomainError> {
    match status {
        200 => DomainResult::Ok(()),
        402 => DomainResult::Err(DomainError::new(
            "PAYMENT_DECLINED",
            "Payment gateway declined the charge",
        )),
        _ => DomainResult::Err(DomainError::new(
            "EXTERNAL_TIMEOUT",
            "Payment service error",
        )),
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
            Err(_) => DomainResult::Err(DomainError::new(
                "EXTERNAL_TIMEOUT",
                "Payment service timed out",
            )),
        }
    }
}
