import json
from src.domain.shared.errors import DomainError
from src.domain.shared.result import Err, Ok, Result
from src.domain.value_objects.shared.identifiers import OrderId
from src.domain.value_objects.shared.money import Money
from src.infrastructure.drivers.http.http_driver import HttpJsonDriver, RawHttpResponse


def map_payment_http_response(res: RawHttpResponse) -> Result[None, DomainError]:
    if res.status == 200:
        return Ok(None)
    if res.status == 402:
        return Err(DomainError("PAYMENT_DECLINED", "Payment gateway declined the charge"))
    return Err(DomainError("EXTERNAL_TIMEOUT", f"Payment service error status {res.status}"))


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
