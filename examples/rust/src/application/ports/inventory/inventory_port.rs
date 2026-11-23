use crate::domain::entities::order::order::OrderLine;
use crate::domain::shared::errors::DomainError;
use crate::domain::shared::result::DomainResult;
use crate::domain::value_objects::shared::identifiers::OrderId;

pub trait InventoryPort {
    fn reserve_stock(
        &self,
        order_id: &OrderId,
        lines: &[OrderLine],
    ) -> DomainResult<(), DomainError>;
}
