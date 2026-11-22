import json
from src.domain.errors import DomainError
from src.domain.order import Order
from src.domain.result import Err, Ok, Result
from src.domain.value_objects import OrderId
from src.infrastructure.drivers.kv_driver import KeyValueStorageDriver
from src.infrastructure.repository.order_mapper import from_order_record, to_order_record


class DriverOrderRepository:
    def __init__(self, driver: KeyValueStorageDriver) -> None:
        self._driver = driver

    def save(self, order: Order) -> Result[None, DomainError]:
        payload = json.dumps(to_order_record(order))
        try:
            self._driver.put(order.id.value, payload)
            return Ok(None)
        except Exception:
            return Err(DomainError("REPOSITORY_ERROR", "Failed to save order to storage"))

    def find_by_id(self, order_id: OrderId) -> Result[Order, DomainError]:
        try:
            raw = self._driver.get(order_id.value)
        except FileNotFoundError:
            return Err(DomainError("ORDER_NOT_FOUND", f"Order not found: {order_id.value}"))
        except Exception:
            return Err(DomainError("REPOSITORY_ERROR", "Failed to read order from storage"))

        try:
            parsed = json.loads(raw)
        except Exception:
            return Err(DomainError("REPOSITORY_ERROR", "Corrupted order payload in storage"))

        return from_order_record(parsed)
