from typing import Protocol
from src.domain.entities.order.order import Order
from src.domain.shared.errors import DomainError
from src.domain.shared.result import Result
from src.domain.value_objects.shared.identifiers import OrderId


class OrderRepository(Protocol):
    def save(self, order: Order) -> Result[None, DomainError]: ...
    def find_by_id(self, order_id: OrderId) -> Result[Order, DomainError]: ...
