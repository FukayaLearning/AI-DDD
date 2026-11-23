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
            _ => DomainResult::Err(DomainError::new(
                "CURRENCY_MISMATCH",
                "Unsupported currency",
            )),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Money {
    pub amount: i64,
    pub currency: Currency,
}

pub fn create_money(amount: i64, currency: Currency) -> DomainResult<Money, DomainError> {
    if amount < 0 {
        return DomainResult::Err(DomainError::new(
            "INVALID_MONEY_AMOUNT",
            "Money amount must be non-negative",
        ));
    }
    DomainResult::Ok(Money { amount, currency })
}

pub fn multiply_money(money: Money, quantity_count: u32) -> Money {
    Money {
        amount: money.amount * (quantity_count as i64),
        currency: money.currency,
    }
}

pub fn add_money(left: Money, right: Money) -> DomainResult<Money, DomainError> {
    if left.currency != right.currency {
        return DomainResult::Err(DomainError::new(
            "CURRENCY_MISMATCH",
            "Cannot add Money with different currencies",
        ));
    }
    DomainResult::Ok(Money {
        amount: left.amount + right.amount,
        currency: left.currency,
    })
}
