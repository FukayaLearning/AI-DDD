from typing import Protocol
from src.domain.shared.errors import DomainError
from src.domain.shared.result import Result
from src.domain.value_objects.shared.identifiers import OrderId
from src.domain.value_objects.shared.money import Money


class PaymentPort(Protocol):
    def charge(self, order_id: OrderId, amount: Money) -> Result[None, DomainError]: ...
