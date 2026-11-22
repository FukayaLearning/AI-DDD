use crate::domain::order::order::OrderLine;
use crate::domain::shared::errors::DomainError;
use crate::domain::shared::result::DomainResult;
use crate::domain::shared::value_objects::{Money, OrderId};

pub trait InventoryPort {
    fn reserve_stock(&self, order_id: &OrderId, lines: &[OrderLine]) -> DomainResult<(), DomainError>;
}

pub trait PaymentPort {
    fn charge(&self, order_id: &OrderId, amount: Money) -> DomainResult<(), DomainError>;
}
