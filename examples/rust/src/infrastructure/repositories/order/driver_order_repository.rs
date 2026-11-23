use crate::domain::entities::order::order::Order;
use crate::domain::repositories::order::order_repository::OrderRepository;
use crate::domain::shared::errors::DomainError;
use crate::domain::shared::result::DomainResult;
use crate::domain::value_objects::shared::identifiers::OrderId;
use crate::infrastructure::drivers::kv::kv_driver::KeyValueStorageDriver;
use crate::infrastructure::mappers::order::order_mapper::{
    decode_order_record, encode_order_record,
};
use std::io::ErrorKind;

pub struct DriverOrderRepository<D: KeyValueStorageDriver> {
    driver: D,
}

impl<D: KeyValueStorageDriver> DriverOrderRepository<D> {
    pub fn new(driver: D) -> Self {
        Self { driver }
    }
}

impl<D: KeyValueStorageDriver> OrderRepository for DriverOrderRepository<D> {
    fn save(&self, order: &Order) -> DomainResult<(), DomainError> {
        let payload = encode_order_record(order);
        match self.driver.put(&order.id.0, &payload) {
            Ok(()) => DomainResult::Ok(()),
            Err(_) => {
                DomainResult::Err(DomainError::new("REPOSITORY_ERROR", "Failed to save order"))
            }
        }
    }

    fn find_by_id(&self, order_id: &OrderId) -> DomainResult<Order, DomainError> {
        match self.driver.get(&order_id.0) {
            Ok(raw) => decode_order_record(&raw),
            Err(e) if e.kind() == ErrorKind::NotFound => {
                DomainResult::Err(DomainError::new("ORDER_NOT_FOUND", "Order not found"))
            }
            Err(_) => {
                DomainResult::Err(DomainError::new("REPOSITORY_ERROR", "Failed to read order"))
            }
        }
    }
}
