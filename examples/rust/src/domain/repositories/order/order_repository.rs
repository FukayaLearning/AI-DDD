use crate::domain::entities::order::order::Order;
use crate::domain::shared::errors::DomainError;
use crate::domain::shared::result::DomainResult;
use crate::domain::value_objects::shared::identifiers::OrderId;

pub trait OrderRepository {
    fn save(&self, order: &Order) -> DomainResult<(), DomainError>;
    fn find_by_id(&self, order_id: &OrderId) -> DomainResult<Order, DomainError>;
}
