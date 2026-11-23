from dataclasses import dataclass
from src.domain.shared.errors import DomainError
from src.domain.shared.result import Err, Ok, Result


@dataclass(frozen=True)
class OrderId:
    value: str


@dataclass(frozen=True)
class CustomerId:
    value: str


@dataclass(frozen=True)
class ProductId:
    value: str


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
