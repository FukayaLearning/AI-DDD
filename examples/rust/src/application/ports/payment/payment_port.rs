use crate::domain::shared::errors::DomainError;
use crate::domain::shared::result::DomainResult;
use crate::domain::value_objects::shared::identifiers::OrderId;
use crate::domain::value_objects::shared::money::Money;

pub trait PaymentPort {
    fn charge(&self, order_id: &OrderId, amount: Money) -> DomainResult<(), DomainError>;
}
