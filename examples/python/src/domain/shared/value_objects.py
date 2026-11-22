from dataclasses import dataclass
from typing import Literal
from src.domain.shared.errors import DomainError
from src.domain.shared.result import Err, Ok, Result

Currency = Literal["JPY", "USD"]


@dataclass(frozen=True)
class OrderId:
    value: str


@dataclass(frozen=True)
class CustomerId:
    value: str


@dataclass(frozen=True)
class ProductId:
    value: str


@dataclass(frozen=True)
class Quantity:
    value: int


@dataclass(frozen=True)
class Money:
    amount: int
    currency: Currency


def create_order_id(raw: str) -> Result[OrderId, DomainError]:
    trimmed = raw.strip()
    if not trimmed:
        return Err(DomainError("INVALID_ORDER_ID", "OrderId must not be empty"))
    return Ok(OrderId(trimmed))


def create_customer_id(raw: str) -> Result[CustomerId, DomainError]:
    trimmed = raw.strip()
    if not trimmed:
        return Err(DomainError("INVALID_CUSTOMER_ID", "CustomerId must not be empty"))
    return Ok(CustomerId(trimmed))


def create_product_id(raw: str) -> Result[ProductId, DomainError]:
    trimmed = raw.strip()
    if not trimmed:
        return Err(DomainError("INVALID_PRODUCT_ID", "ProductId must not be empty"))
    return Ok(ProductId(trimmed))


def create_quantity(value: int) -> Result[Quantity, DomainError]:
    if not isinstance(value, int) or isinstance(value, bool):
        return Err(DomainError("INVALID_QUANTITY", "Quantity must be an integer"))
    if value < 1:
        return Err(DomainError("INVALID_QUANTITY", "Quantity must be at least 1"))
    if value > 100:
        return Err(DomainError("INVALID_QUANTITY", "Quantity must be at most 100"))
    return Ok(Quantity(value))


def create_money(amount: int, currency: Currency) -> Result[Money, DomainError]:
    if not isinstance(amount, int) or isinstance(amount, bool):
        return Err(DomainError("INVALID_MONEY_AMOUNT", "Money amount must be an integer"))
    if amount < 0:
        return Err(DomainError("INVALID_MONEY_AMOUNT", "Money amount must be non-negative"))
    return Ok(Money(amount, currency))


def multiply_money(money: Money, quantity: Quantity) -> Money:
    return Money(money.amount * quantity.value, money.currency)


def add_money(left: Money, right: Money) -> Result[Money, DomainError]:
    if left.currency != right.currency:
        return Err(DomainError("CURRENCY_MISMATCH", "Cannot add Money with different currencies"))
    return Ok(Money(left.amount + right.amount, left.currency))
