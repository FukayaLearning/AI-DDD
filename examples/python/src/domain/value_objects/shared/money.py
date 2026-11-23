from dataclasses import dataclass
from typing import Literal, Protocol
from src.domain.shared.errors import DomainError
from src.domain.shared.result import Err, Ok, Result

Currency = Literal["JPY", "USD"]


@dataclass(frozen=True)
class Money:
    amount: int
    currency: Currency


class HasQuantityValue(Protocol):
    value: int


def create_money(amount: int, currency: Currency) -> Result[Money, DomainError]:
    if not isinstance(amount, int) or isinstance(amount, bool):
        return Err(DomainError("INVALID_MONEY_AMOUNT", "Money amount must be an integer"))
    if amount < 0:
        return Err(DomainError("INVALID_MONEY_AMOUNT", "Money amount must be non-negative"))
    return Ok(Money(amount, currency))


def multiply_money(money: Money, quantity: HasQuantityValue) -> Money:
    return Money(money.amount * quantity.value, money.currency)


def add_money(left: Money, right: Money) -> Result[Money, DomainError]:
    if left.currency != right.currency:
        return Err(DomainError("CURRENCY_MISMATCH", "Cannot add Money with different currencies"))
    return Ok(Money(left.amount + right.amount, left.currency))
