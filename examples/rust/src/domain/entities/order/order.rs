use crate::domain::shared::errors::DomainError;
use crate::domain::shared::result::DomainResult;
use crate::domain::value_objects::order::quantity::Quantity;
use crate::domain::value_objects::shared::identifiers::{CustomerId, OrderId, ProductId};
use crate::domain::value_objects::shared::money::{multiply_money, Money};
use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrderStatus {
    Draft,
    Confirmed,
    Cancelled,
}

impl OrderStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            OrderStatus::Draft => "Draft",
            OrderStatus::Confirmed => "Confirmed",
            OrderStatus::Cancelled => "Cancelled",
        }
    }

    pub fn from_str(raw: &str) -> DomainResult<OrderStatus, DomainError> {
        match raw {
            "Draft" => DomainResult::Ok(OrderStatus::Draft),
            "Confirmed" => DomainResult::Ok(OrderStatus::Confirmed),
            "Cancelled" => DomainResult::Ok(OrderStatus::Cancelled),
            _ => DomainResult::Err(DomainError::new(
                "INVALID_ORDER_STATE",
                "Unknown order status",
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OrderLine {
    pub product_id: ProductId,
    pub quantity: Quantity,
    pub unit_price: Money,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DomainEvent {
    OrderConfirmedEvent {
        order_id: String,
        total_amount: Money,
    },
    OrderCancelledEvent {
        order_id: String,
        previous_status: OrderStatus,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Order {
    pub id: OrderId,
    pub customer_id: CustomerId,
    pub lines: Vec<OrderLine>,
    pub status: OrderStatus,
    pub events: Vec<DomainEvent>,
}

impl Order {
    pub fn create(
        id: OrderId,
        customer_id: CustomerId,
        lines: Vec<OrderLine>,
        status: OrderStatus,
        events: Vec<DomainEvent>,
    ) -> DomainResult<Order, DomainError> {
        if lines.is_empty() {
            return DomainResult::Err(DomainError::new(
                "EMPTY_ORDER_LINES",
                "Order must contain at least 1 line",
            ));
        }
        if lines.len() > 5 {
            return DomainResult::Err(DomainError::new(
                "TOO_MANY_ORDER_LINES",
                "Order cannot exceed 5 lines",
            ));
        }
        let mut seen = HashSet::new();
        let currency = lines[0].unit_price.currency;
        for line in &lines {
            if !seen.insert(line.product_id.0.clone()) {
                return DomainResult::Err(DomainError::new(
                    "DUPLICATE_PRODUCT",
                    "Duplicate product_id",
                ));
            }
            if line.unit_price.currency != currency {
                return DomainResult::Err(DomainError::new(
                    "CURRENCY_MISMATCH",
                    "All order lines must share currency",
                ));
            }
        }
        DomainResult::Ok(Order {
            id,
            customer_id,
            lines,
            status,
            events,
        })
    }

    pub fn total_amount(&self) -> Money {
        let currency = self.lines[0].unit_price.currency;
        let amount = self
            .lines
            .iter()
            .map(|l| multiply_money(l.unit_price, l.quantity.0).amount)
            .sum();
        Money { amount, currency }
    }

    pub fn confirm(&self) -> DomainResult<Order, DomainError> {
        if self.status != OrderStatus::Draft {
            return DomainResult::Err(DomainError::new(
                "INVALID_ORDER_STATE",
                "Cannot confirm order in current status",
            ));
        }
        let mut next_events = self.events.clone();
        next_events.push(DomainEvent::OrderConfirmedEvent {
            order_id: self.id.0.clone(),
            total_amount: self.total_amount(),
        });
        DomainResult::Ok(Order {
            id: self.id.clone(),
            customer_id: self.customer_id.clone(),
            lines: self.lines.clone(),
            status: OrderStatus::Confirmed,
            events: next_events,
        })
    }

    pub fn cancel(&self) -> DomainResult<Order, DomainError> {
        if self.status == OrderStatus::Cancelled {
            return DomainResult::Err(DomainError::new(
                "INVALID_ORDER_STATE",
                "Order is already cancelled",
            ));
        }
        let mut next_events = self.events.clone();
        next_events.push(DomainEvent::OrderCancelledEvent {
            order_id: self.id.0.clone(),
            previous_status: self.status,
        });
        DomainResult::Ok(Order {
            id: self.id.clone(),
            customer_id: self.customer_id.clone(),
            lines: self.lines.clone(),
            status: OrderStatus::Cancelled,
            events: next_events,
        })
    }
}
