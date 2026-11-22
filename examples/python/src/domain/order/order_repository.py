from typing import Protocol
from src.domain.order.order import Order
from src.domain.shared.errors import DomainError
from src.domain.shared.result import Result
from src.domain.shared.value_objects import OrderId


class OrderRepository(Protocol):
    def save(self, order: Order) -> Result[None, DomainError]: ...
    def find_by_id(self, order_id: OrderId) -> Result[Order, DomainError]: ...
