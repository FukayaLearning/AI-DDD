use crate::domain::shared::errors::DomainError;
use crate::domain::order::order::{DomainEvent, Order, OrderLine, OrderStatus};
use crate::domain::shared::result::DomainResult;
use crate::domain::shared::value_objects::{
    create_customer_id, create_money, create_order_id, create_product_id, create_quantity, Currency,
};

pub fn encode_order_record(order: &Order) -> String {
    let lines_part: Vec<String> = order
        .lines
        .iter()
        .map(|l| {
            format!(
                "{}:{}:{}:{}",
                l.product_id.0,
                l.quantity.0,
                l.unit_price.amount,
                l.unit_price.currency.as_str()
            )
        })
        .collect();
    let events_part: Vec<String> = order
        .events
        .iter()
        .map(|ev| match ev {
            DomainEvent::OrderConfirmedEvent { order_id, total_amount } => format!(
                "OrderConfirmedEvent:{}:{}:{}",
                order_id,
                total_amount.amount,
                total_amount.currency.as_str()
            ),
            DomainEvent::OrderCancelledEvent {
                order_id,
                previous_status,
            } => format!("OrderCancelledEvent:{}:{}", order_id, previous_status.as_str()),
        })
        .collect();
    format!(
        "id={}\ncustomerId={}\nstatus={}\nlines={}\nevents={}",
        order.id.0,
        order.customer_id.0,
        order.status.as_str(),
        lines_part.join(";"),
        events_part.join(";")
    )
}

pub fn decode_order_record(raw: &str) -> DomainResult<Order, DomainError> {
    let mut id_val = None;
    let mut cust_val = None;
    let mut status_val = None;
    let mut lines_val = None;
    let mut events_val = None;

    for line in raw.lines() {
        if let Some((k, v)) = line.split_once('=') {
            match k {
                "id" => id_val = Some(v),
                "customerId" => cust_val = Some(v),
                "status" => status_val = Some(v),
                "lines" => lines_val = Some(v),
                "events" => events_val = Some(v),
                _ => {}
            }
        }
    }

    let id_str = match id_val {
        Some(v) => v,
        None => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", "Missing id field")),
    };
    let cust_str = match cust_val {
        Some(v) => v,
        None => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", "Missing customerId field")),
    };
    let status_str = match status_val {
        Some(v) => v,
        None => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", "Missing status field")),
    };
    let lines_str = match lines_val {
        Some(v) => v,
        None => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", "Missing lines field")),
    };
    let events_str = events_val.unwrap_or("");

    let oid = match create_order_id(id_str) {
        DomainResult::Ok(v) => v,
        DomainResult::Err(e) => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", &e.message)),
    };
    let cid = match create_customer_id(cust_str) {
        DomainResult::Ok(v) => v,
        DomainResult::Err(e) => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", &e.message)),
    };
    let status = match OrderStatus::from_str(status_str) {
        DomainResult::Ok(v) => v,
        DomainResult::Err(e) => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", &e.message)),
    };

    let mut lines = Vec::new();
    if !lines_str.is_empty() {
        for chunk in lines_str.split(';') {
            let parts: Vec<&str> = chunk.split(':').collect();
            if parts.len() != 4 {
                return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", "Invalid line entry"));
            }
            let pid = match create_product_id(parts[0]) {
                DomainResult::Ok(v) => v,
                DomainResult::Err(e) => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", &e.message)),
            };
            let qty_num: u32 = match parts[1].parse() {
                Ok(n) => n,
                Err(_) => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", "Invalid quantity")),
            };
            let qty = match create_quantity(qty_num) {
                DomainResult::Ok(v) => v,
                DomainResult::Err(e) => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", &e.message)),
            };
            let amt_num: i64 = match parts[2].parse() {
                Ok(n) => n,
                Err(_) => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", "Invalid amount")),
            };
            let cur = match Currency::from_str(parts[3]) {
                DomainResult::Ok(v) => v,
                DomainResult::Err(e) => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", &e.message)),
            };
            let price = match create_money(amt_num, cur) {
                DomainResult::Ok(v) => v,
                DomainResult::Err(e) => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", &e.message)),
            };
            lines.push(OrderLine {
                product_id: pid,
                quantity: qty,
                unit_price: price,
            });
        }
    }

    let mut events = Vec::new();
    if !events_str.is_empty() {
        for chunk in events_str.split(';') {
            let parts: Vec<&str> = chunk.split(':').collect();
            if parts[0] == "OrderConfirmedEvent" && parts.len() == 4 {
                let amt: i64 = parts[2].parse().unwrap_or(0);
                let cur = match Currency::from_str(parts[3]) {
                    DomainResult::Ok(v) => v,
                    DomainResult::Err(e) => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", &e.message)),
                };
                let money = match create_money(amt, cur) {
                    DomainResult::Ok(v) => v,
                    DomainResult::Err(e) => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", &e.message)),
                };
                events.push(DomainEvent::OrderConfirmedEvent {
                    order_id: parts[1].to_string(),
                    total_amount: money,
                });
            } else if parts[0] == "OrderCancelledEvent" && parts.len() == 3 {
                let prev = match OrderStatus::from_str(parts[2]) {
                    DomainResult::Ok(v) => v,
                    DomainResult::Err(e) => return DomainResult::Err(DomainError::new("REPOSITORY_ERROR", &e.message)),
                };
                events.push(DomainEvent::OrderCancelledEvent {
                    order_id: parts[1].to_string(),
                    previous_status: prev,
                });
            }
        }
    }

    match Order::create(oid, cid, lines, status, events) {
        DomainResult::Ok(o) => DomainResult::Ok(o),
        DomainResult::Err(e) => DomainResult::Err(DomainError::new("REPOSITORY_ERROR", &e.message)),
    }
}
