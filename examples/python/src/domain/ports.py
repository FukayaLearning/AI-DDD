from typing import Protocol
from src.domain.errors import DomainError
from src.domain.order import Order, OrderLine
from src.domain.result import Result
from src.domain.value_objects import Money, OrderId


class OrderRepository(Protocol):
    def save(self, order: Order) -> Result[None, DomainError]: ...
    def find_by_id(self, order_id: OrderId) -> Result[Order, DomainError]: ...


class InventoryPort(Protocol):
    def reserve_stock(self, order_id: OrderId, lines: tuple[OrderLine, ...]) -> Result[None, DomainError]: ...


class PaymentPort(Protocol):
    def charge(self, order_id: OrderId, amount: Money) -> Result[None, DomainError]: ...
