use crate::domain::shared::errors::DomainError;
use crate::domain::shared::result::DomainResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Currency {
    JPY,
    USD,
}

impl Currency {
    pub fn as_str(&self) -> &'static str {
        match self {
            Currency::JPY => "JPY",
            Currency::USD => "USD",
        }
    }

    pub fn from_str(raw: &str) -> DomainResult<Currency, DomainError> {
        match raw {
            "JPY" => DomainResult::Ok(Currency::JPY),
            "USD" => DomainResult::Ok(Currency::USD),
            _ => DomainResult::Err(DomainError::new("CURRENCY_MISMATCH", "Unsupported currency")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OrderId(pub String);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CustomerId(pub String);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProductId(pub String);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Quantity(pub u32);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Money {
    pub amount: i64,
    pub currency: Currency,
}

pub fn create_order_id(raw: &str) -> DomainResult<OrderId, DomainError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return DomainResult::Err(DomainError::new("INVALID_ORDER_ID", "OrderId must not be empty"));
    }
    DomainResult::Ok(OrderId(trimmed.to_string()))
}

pub fn create_customer_id(raw: &str) -> DomainResult<CustomerId, DomainError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return DomainResult::Err(DomainError::new("INVALID_CUSTOMER_ID", "CustomerId must not be empty"));
    }
    DomainResult::Ok(CustomerId(trimmed.to_string()))
}

pub fn create_product_id(raw: &str) -> DomainResult<ProductId, DomainError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return DomainResult::Err(DomainError::new("INVALID_PRODUCT_ID", "ProductId must not be empty"));
    }
    DomainResult::Ok(ProductId(trimmed.to_string()))
}

pub fn create_quantity(value: u32) -> DomainResult<Quantity, DomainError> {
    if value < 1 || value > 100 {
        return DomainResult::Err(DomainError::new("INVALID_QUANTITY", "Quantity must be between 1 and 100"));
    }
    DomainResult::Ok(Quantity(value))
}

pub fn create_money(amount: i64, currency: Currency) -> DomainResult<Money, DomainError> {
    if amount < 0 {
        return DomainResult::Err(DomainError::new("INVALID_MONEY_AMOUNT", "Money amount must be non-negative"));
    }
    DomainResult::Ok(Money { amount, currency })
}

pub fn multiply_money(money: Money, quantity: Quantity) -> Money {
    Money {
        amount: money.amount * (quantity.0 as i64),
        currency: money.currency,
    }
}

pub fn add_money(left: Money, right: Money) -> DomainResult<Money, DomainError> {
    if left.currency != right.currency {
        return DomainResult::Err(DomainError::new("CURRENCY_MISMATCH", "Cannot add Money with different currencies"));
    }
    DomainResult::Ok(Money {
        amount: left.amount + right.amount,
        currency: left.currency,
    })
}
