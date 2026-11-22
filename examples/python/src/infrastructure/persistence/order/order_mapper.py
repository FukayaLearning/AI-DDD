from typing import Any
from src.domain.shared.errors import DomainError
from src.domain.order.order import Order, OrderCancelledEvent, OrderConfirmedEvent, OrderLine
from src.domain.shared.result import Err, Result
from src.domain.shared.value_objects import (
    create_customer_id,
    create_money,
    create_order_id,
    create_product_id,
    create_quantity,
)


def to_order_record(order: Order) -> dict[str, Any]:
    events_list = []
    for ev in order.events:
        if isinstance(ev, OrderConfirmedEvent):
            events_list.append({
                "type": "OrderConfirmedEvent",
                "orderId": ev.order_id,
                "totalAmount": {"amount": ev.total_amount.amount, "currency": ev.total_amount.currency},
            })
        else:
            events_list.append({
                "type": "OrderCancelledEvent",
                "orderId": ev.order_id,
                "previousStatus": ev.previous_status,
            })
    return {
        "id": order.id.value,
        "customerId": order.customer_id.value,
        "status": order.status,
        "lines": [
            {
                "productId": line.product_id.value,
                "quantity": line.quantity.value,
                "unitAmount": line.unit_price.amount,
                "currency": line.unit_price.currency,
            }
            for line in order.lines
        ],
        "events": events_list,
    }


def from_order_record(record: dict[str, Any]) -> Result[Order, DomainError]:
    id_res = create_order_id(str(record["id"]))
    if isinstance(id_res, Err):
        return Err(DomainError("REPOSITORY_ERROR", id_res.error.message))

    cust_res = create_customer_id(str(record["customerId"]))
    if isinstance(cust_res, Err):
        return Err(DomainError("REPOSITORY_ERROR", cust_res.error.message))

    lines: list[OrderLine] = []
    for item in record["lines"]:
        p_res = create_product_id(str(item["productId"]))
        if isinstance(p_res, Err):
            return Err(DomainError("REPOSITORY_ERROR", p_res.error.message))
        q_res = create_quantity(int(item["quantity"]))
        if isinstance(q_res, Err):
            return Err(DomainError("REPOSITORY_ERROR", q_res.error.message))
        m_res = create_money(int(item["unitAmount"]), item["currency"])
        if isinstance(m_res, Err):
            return Err(DomainError("REPOSITORY_ERROR", m_res.error.message))
        lines.append(OrderLine(p_res.value, q_res.value, m_res.value))

    events = []
    for ev in record["events"]:
        if ev["type"] == "OrderConfirmedEvent":
            ev_money = create_money(int(ev["totalAmount"]["amount"]), ev["totalAmount"]["currency"])
            if isinstance(ev_money, Err):
                return Err(DomainError("REPOSITORY_ERROR", ev_money.error.message))
            events.append(OrderConfirmedEvent(order_id=ev["orderId"], total_amount=ev_money.value))
        else:
            events.append(OrderCancelledEvent(order_id=ev["orderId"], previous_status=ev["previousStatus"]))

    order_res = Order.create(id_res.value, cust_res.value, tuple(lines), record["status"], tuple(events))
    if isinstance(order_res, Err):
        return Err(DomainError("REPOSITORY_ERROR", order_res.error.message))
    return order_res
