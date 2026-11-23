use crate::domain::shared::errors::DomainError;
use crate::domain::shared::result::DomainResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Quantity(pub u32);

pub fn create_quantity(value: u32) -> DomainResult<Quantity, DomainError> {
    if value < 1 || value > 100 {
        return DomainResult::Err(DomainError::new(
            "INVALID_QUANTITY",
            "Quantity must be between 1 and 100",
        ));
    }
    DomainResult::Ok(Quantity(value))
}
