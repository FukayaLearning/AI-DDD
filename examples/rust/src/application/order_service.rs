use crate::domain::errors::DomainError;
use crate::domain::order::{Order, OrderLine, OrderStatus};
use crate::domain::ports::{InventoryPort, OrderRepository, PaymentPort};
use crate::domain::result::DomainResult;
use crate::domain::value_objects::{
    create_customer_id, create_money, create_order_id, create_product_id, create_quantity, Currency, Money,
};

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

pub trait OrderUseCases {
    fn place_order(&self, cmd: PlaceOrderCommand) -> DomainResult<OrderSummaryDto, DomainError>;
    fn confirm_order(&self, order_id: &str) -> DomainResult<OrderSummaryDto, DomainError>;
    fn cancel_order(&self, order_id: &str) -> DomainResult<OrderSummaryDto, DomainError>;
    fn get_order(&self, order_id: &str) -> DomainResult<OrderSummaryDto, DomainError>;
}

pub struct OrderApplicationService<R: OrderRepository, I: InventoryPort, P: PaymentPort> {
    orders: R,
    inventory: I,
    payment: P,
}

impl<R: OrderRepository, I: InventoryPort, P: PaymentPort> OrderApplicationService<R, I, P> {
    pub fn new(orders: R, inventory: I, payment: P) -> Self {
        Self {
            orders,
            inventory,
            payment,
        }
    }
}

fn to_dto(order: &Order) -> OrderSummaryDto {
    OrderSummaryDto {
        order_id: order.id.0.clone(),
        customer_id: order.customer_id.0.clone(),
        status: order.status,
        total: order.total_amount(),
        lines: order
            .lines
            .iter()
            .map(|l| OrderLineDto {
                product_id: l.product_id.0.clone(),
                quantity: l.quantity.0,
                unit_price: l.unit_price,
            })
            .collect(),
    }
}

impl<R: OrderRepository, I: InventoryPort, P: PaymentPort> OrderUseCases for OrderApplicationService<R, I, P> {
    fn place_order(&self, cmd: PlaceOrderCommand) -> DomainResult<OrderSummaryDto, DomainError> {
        let oid = match create_order_id(&cmd.order_id) {
            DomainResult::Ok(v) => v,
            DomainResult::Err(e) => return DomainResult::Err(e),
        };
        let cid = match create_customer_id(&cmd.customer_id) {
            DomainResult::Ok(v) => v,
            DomainResult::Err(e) => return DomainResult::Err(e),
        };
        let mut built = Vec::with_capacity(cmd.lines.len());
        for item in cmd.lines {
            let pid = match create_product_id(&item.product_id) {
                DomainResult::Ok(v) => v,
                DomainResult::Err(e) => return DomainResult::Err(e),
            };
            let qty = match create_quantity(item.quantity) {
                DomainResult::Ok(v) => v,
                DomainResult::Err(e) => return DomainResult::Err(e),
            };
            let price = match create_money(item.unit_amount, item.currency) {
                DomainResult::Ok(v) => v,
                DomainResult::Err(e) => return DomainResult::Err(e),
            };
            built.push(OrderLine {
                product_id: pid,
                quantity: qty,
                unit_price: price,
            });
        }
        let order = match Order::create(oid, cid, built, OrderStatus::Draft, vec![]) {
            DomainResult::Ok(o) => o,
            DomainResult::Err(e) => return DomainResult::Err(e),
        };
        if let DomainResult::Err(e) = self.orders.save(&order) {
            return DomainResult::Err(e);
        }
        DomainResult::Ok(to_dto(&order))
    }

    fn confirm_order(&self, raw_order_id: &str) -> DomainResult<OrderSummaryDto, DomainError> {
        let oid = match create_order_id(raw_order_id) {
            DomainResult::Ok(v) => v,
            DomainResult::Err(e) => return DomainResult::Err(e),
        };
        let order = match self.orders.find_by_id(&oid) {
            DomainResult::Ok(v) => v,
            DomainResult::Err(e) => return DomainResult::Err(e),
        };
        let confirmed = match order.confirm() {
            DomainResult::Ok(v) => v,
            DomainResult::Err(e) => return DomainResult::Err(e),
        };
        if let DomainResult::Err(e) = self.inventory.reserve_stock(&order.id, &order.lines) {
            return DomainResult::Err(e);
        }
        if let DomainResult::Err(e) = self.payment.charge(&order.id, order.total_amount()) {
            return DomainResult::Err(e);
        }
        if let DomainResult::Err(e) = self.orders.save(&confirmed) {
            return DomainResult::Err(e);
        }
        DomainResult::Ok(to_dto(&confirmed))
    }

    fn cancel_order(&self, raw_order_id: &str) -> DomainResult<OrderSummaryDto, DomainError> {
        let oid = match create_order_id(raw_order_id) {
            DomainResult::Ok(v) => v,
            DomainResult::Err(e) => return DomainResult::Err(e),
        };
        let order = match self.orders.find_by_id(&oid) {
            DomainResult::Ok(v) => v,
            DomainResult::Err(e) => return DomainResult::Err(e),
        };
        let cancelled = match order.cancel() {
            DomainResult::Ok(v) => v,
            DomainResult::Err(e) => return DomainResult::Err(e),
        };
        if let DomainResult::Err(e) = self.orders.save(&cancelled) {
            return DomainResult::Err(e);
        }
        DomainResult::Ok(to_dto(&cancelled))
    }

    fn get_order(&self, raw_order_id: &str) -> DomainResult<OrderSummaryDto, DomainError> {
        let oid = match create_order_id(raw_order_id) {
            DomainResult::Ok(v) => v,
            DomainResult::Err(e) => return DomainResult::Err(e),
        };
        match self.orders.find_by_id(&oid) {
            DomainResult::Ok(o) => DomainResult::Ok(to_dto(&o)),
            DomainResult::Err(e) => DomainResult::Err(e),
        }
    }
}
