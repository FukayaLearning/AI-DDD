use crate::domain::entities::order::order::OrderStatus;
use crate::domain::value_objects::shared::money::{Currency, Money};

#[derive(Debug, Clone)]
pub struct PlaceOrderLineInput {
    pub product_id: String,
    pub quantity: u32,
    pub unit_amount: i64,
    pub currency: Currency,
}

#[derive(Debug, Clone)]
pub struct PlaceOrderCommand {
    pub order_id: String,
    pub customer_id: String,
    pub lines: Vec<PlaceOrderLineInput>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OrderLineDto {
    pub product_id: String,
    pub quantity: u32,
    pub unit_price: Money,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OrderSummaryDto {
    pub order_id: String,
    pub customer_id: String,
    pub status: OrderStatus,
    pub total: Money,
    pub lines: Vec<OrderLineDto>,
}
