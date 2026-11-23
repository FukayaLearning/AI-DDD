from typing import Protocol
from src.domain.entities.order.order import OrderLine
from src.domain.shared.errors import DomainError
from src.domain.shared.result import Result
from src.domain.value_objects.shared.identifiers import OrderId


class InventoryPort(Protocol):
    def reserve_stock(self, order_id: OrderId, lines: tuple[OrderLine, ...]) -> Result[None, DomainError]: ...
