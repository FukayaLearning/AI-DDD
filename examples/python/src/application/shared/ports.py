from typing import Protocol
from src.domain.order.order import OrderLine
from src.domain.shared.errors import DomainError
from src.domain.shared.result import Result
from src.domain.shared.value_objects import Money, OrderId


class InventoryPort(Protocol):
    def reserve_stock(self, order_id: OrderId, lines: tuple[OrderLine, ...]) -> Result[None, DomainError]: ...


class PaymentPort(Protocol):
    def charge(self, order_id: OrderId, amount: Money) -> Result[None, DomainError]: ...
