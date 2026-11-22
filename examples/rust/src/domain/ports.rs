use crate::domain::errors::DomainError;
use crate::domain::order::{Order, OrderLine};
use crate::domain::result::DomainResult;
use crate::domain::value_objects::{Money, OrderId};

pub trait OrderRepository {
    fn save(&self, order: &Order) -> DomainResult<(), DomainError>;
    fn find_by_id(&self, order_id: &OrderId) -> DomainResult<Order, DomainError>;
}

pub trait InventoryPort {
    fn reserve_stock(&self, order_id: &OrderId, lines: &[OrderLine]) -> DomainResult<(), DomainError>;
}

pub trait PaymentPort {
    fn charge(&self, order_id: &OrderId, amount: Money) -> DomainResult<(), DomainError>;
}
