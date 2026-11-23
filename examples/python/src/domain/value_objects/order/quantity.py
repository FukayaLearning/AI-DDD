from dataclasses import dataclass
from src.domain.shared.errors import DomainError
from src.domain.shared.result import Err, Ok, Result


@dataclass(frozen=True)
class Quantity:
    value: int


def create_quantity(value: int) -> Result[Quantity, DomainError]:
    if not isinstance(value, int) or isinstance(value, bool):
        return Err(DomainError("INVALID_QUANTITY", "Quantity must be an integer"))
    if value < 1:
        return Err(DomainError("INVALID_QUANTITY", "Quantity must be at least 1"))
    if value > 100:
        return Err(DomainError("INVALID_QUANTITY", "Quantity must be at most 100"))
    return Ok(Quantity(value))
