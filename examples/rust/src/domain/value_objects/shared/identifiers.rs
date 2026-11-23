use crate::domain::shared::errors::DomainError;
use crate::domain::shared::result::DomainResult;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OrderId(pub String);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CustomerId(pub String);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProductId(pub String);

pub fn create_order_id(raw: &str) -> DomainResult<OrderId, DomainError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return DomainResult::Err(DomainError::new(
            "INVALID_ORDER_ID",
            "OrderId must not be empty",
        ));
    }
    DomainResult::Ok(OrderId(trimmed.to_string()))
}

pub fn create_customer_id(raw: &str) -> DomainResult<CustomerId, DomainError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return DomainResult::Err(DomainError::new(
            "INVALID_CUSTOMER_ID",
            "CustomerId must not be empty",
        ));
    }
    DomainResult::Ok(CustomerId(trimmed.to_string()))
}

pub fn create_product_id(raw: &str) -> DomainResult<ProductId, DomainError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return DomainResult::Err(DomainError::new(
            "INVALID_PRODUCT_ID",
            "ProductId must not be empty",
        ));
    }
    DomainResult::Ok(ProductId(trimmed.to_string()))
}
