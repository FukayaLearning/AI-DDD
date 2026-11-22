import json
from src.domain.errors import DomainError
from src.domain.order import OrderLine
from src.domain.result import Err, Ok, Result
from src.domain.value_objects import Money, OrderId
from src.infrastructure.drivers.http_driver import HttpJsonDriver, RawHttpResponse


def map_inventory_http_response(res: RawHttpResponse) -> Result[None, DomainError]:
    if res.status == 200:
        return Ok(None)
    if res.status == 409:
        return Err(DomainError("INSUFFICIENT_STOCK", "Requested inventory is unavailable"))
    return Err(DomainError("EXTERNAL_TIMEOUT", f"Inventory service error status {res.status}"))


def map_payment_http_response(res: RawHttpResponse) -> Result[None, DomainError]:
    if res.status == 200:
        return Ok(None)
    if res.status == 402:
        return Err(DomainError("PAYMENT_DECLINED", "Payment gateway declined the charge"))
    return Err(DomainError("EXTERNAL_TIMEOUT", f"Payment service error status {res.status}"))


class InventoryGateway:
    def __init__(self, driver: HttpJsonDriver, endpoint_url: str) -> None:
        self._driver = driver
        self._endpoint_url = endpoint_url

    def reserve_stock(self, order_id: OrderId, lines: tuple[OrderLine, ...]) -> Result[None, DomainError]:
        body = json.dumps({
            "orderId": order_id.value,
            "items": [{"productId": l.product_id.value, "quantity": l.quantity.value} for l in lines],
        })
        try:
            res = self._driver.post_json(self._endpoint_url, body)
        except Exception:
            return Err(DomainError("EXTERNAL_TIMEOUT", "Inventory service request timed out"))
        return map_inventory_http_response(res)


class PaymentGateway:
    def __init__(self, driver: HttpJsonDriver, endpoint_url: str) -> None:
        self._driver = driver
        self._endpoint_url = endpoint_url

    def charge(self, order_id: OrderId, amount: Money) -> Result[None, DomainError]:
        body = json.dumps({"orderId": order_id.value, "amount": amount.amount, "currency": amount.currency})
        try:
            res = self._driver.post_json(self._endpoint_url, body)
        except Exception:
            return Err(DomainError("EXTERNAL_TIMEOUT", "Payment service request timed out"))
        return map_payment_http_response(res)
