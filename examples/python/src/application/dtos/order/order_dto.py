from dataclasses import dataclass
from src.domain.entities.order.order import OrderStatus
from src.domain.value_objects.shared.money import Currency, Money


@dataclass(frozen=True)
class PlaceOrderLineInput:
    product_id: str
    quantity: int
    unit_amount: int
    currency: Currency


@dataclass(frozen=True)
class PlaceOrderCommand:
    order_id: str
    customer_id: str
    lines: tuple[PlaceOrderLineInput, ...]


@dataclass(frozen=True)
class OrderLineDto:
    product_id: str
    quantity: int
    unit_price: Money


@dataclass(frozen=True)
class OrderSummaryDto:
    order_id: str
    customer_id: str
    status: OrderStatus
    total: Money
    lines: tuple[OrderLineDto, ...]
