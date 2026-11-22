from dataclasses import dataclass
from typing import Literal
from src.domain.errors import DomainError
from src.domain.result import Err, Ok, Result
from src.domain.value_objects import CustomerId, Money, OrderId, ProductId, Quantity, add_money, multiply_money

OrderStatus = Literal["Draft", "Confirmed", "Cancelled"]


@dataclass(frozen=True)
class OrderLine:
    product_id: ProductId
    quantity: Quantity
    unit_price: Money


@dataclass(frozen=True)
class OrderConfirmedEvent:
    order_id: str
    total_amount: Money
    event_type: str = "OrderConfirmedEvent"


@dataclass(frozen=True)
class OrderCancelledEvent:
    order_id: str
    previous_status: OrderStatus
    event_type: str = "OrderCancelledEvent"


DomainEvent = OrderConfirmedEvent | OrderCancelledEvent


@dataclass(frozen=True)
class Order:
    id: OrderId
    customer_id: CustomerId
    lines: tuple[OrderLine, ...]
    status: OrderStatus
    events: tuple[DomainEvent, ...]

    @staticmethod
    def create(
        order_id: OrderId,
        customer_id: CustomerId,
        lines: tuple[OrderLine, ...],
        status: OrderStatus = "Draft",
        events: tuple[DomainEvent, ...] = (),
    ) -> Result["Order", DomainError]:
        if len(lines) == 0:
            return Err(DomainError("EMPTY_ORDER_LINES", "Order must contain at least 1 line"))
        if len(lines) > 5:
            return Err(DomainError("TOO_MANY_ORDER_LINES", "Order cannot exceed 5 lines"))
        seen: set[str] = set()
        currency = lines[0].unit_price.currency
        for line in lines:
            if line.product_id.value in seen:
                return Err(DomainError("DUPLICATE_PRODUCT", f"Duplicate product_id: {line.product_id.value}"))
            seen.add(line.product_id.value)
            if line.unit_price.currency != currency:
                return Err(DomainError("CURRENCY_MISMATCH", "All order lines must share the same currency"))
        return Ok(Order(id=order_id, customer_id=customer_id, lines=lines, status=status, events=events))

    def total_amount(self) -> Money:
        currency = self.lines[0].unit_price.currency
        total_cents = 0
        for line in self.lines:
            sub = multiply_money(line.unit_price, line.quantity)
            total_cents += sub.amount
        return Money(total_cents, currency)

    def confirm(self) -> Result["Order", DomainError]:
        if self.status != "Draft":
            return Err(DomainError("INVALID_ORDER_STATE", f"Cannot confirm order in {self.status} status"))
        ev = OrderConfirmedEvent(order_id=self.id.value, total_amount=self.total_amount())
        return Ok(
            Order(
                id=self.id,
                customer_id=self.customer_id,
                lines=self.lines,
                status="Confirmed",
                events=self.events + (ev,),
            )
        )

    def cancel(self) -> Result["Order", DomainError]:
        if self.status == "Cancelled":
            return Err(DomainError("INVALID_ORDER_STATE", "Order is already cancelled"))
        ev = OrderCancelledEvent(order_id=self.id.value, previous_status=self.status)
        return Ok(
            Order(
                id=self.id,
                customer_id=self.customer_id,
                lines=self.lines,
                status="Cancelled",
                events=self.events + (ev,),
            )
        )
