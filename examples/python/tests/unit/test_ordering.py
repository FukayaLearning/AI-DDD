import json
import pathlib
import subprocess
import unittest
import urllib.error
import urllib.request

from src.application.order.commands.order_service import OrderApplicationService, PlaceOrderCommand, PlaceOrderLineInput
from src.domain.shared.errors import DomainError
from src.domain.order.order import Order, OrderLine
from src.domain.shared.result import Err, Ok
from src.domain.shared.value_objects import (
    add_money,
    create_customer_id,
    create_money,
    create_order_id,
    create_product_id,
    create_quantity,
    multiply_money,
)
from src.infrastructure.acl.inventory.inventory_gateway import InventoryGateway
from src.infrastructure.acl.payment.payment_gateway import PaymentGateway
from src.infrastructure.drivers.http.http_driver import RawHttpResponse
from src.infrastructure.persistence.order.driver_order_repository import DriverOrderRepository
from src.infrastructure.persistence.order.order_mapper import from_order_record, to_order_record
from src.presentation.web.order.order_web_server import run_order_web_server

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent


class InMemoryRepo:
    def __init__(self, fail_save: bool = False) -> None:
        self._data: dict[str, Order] = {}
        self.fail_save = fail_save

    def save(self, order: Order):
        if self.fail_save:
            return Err(DomainError("REPOSITORY_ERROR", "db down"))
        self._data[order.id.value] = order
        return Ok(None)

    def find_by_id(self, order_id):
        found = self._data.get(order_id.value)
        if found is None:
            return Err(DomainError("ORDER_NOT_FOUND", "not found"))
        return Ok(found)


class TestPythonOrderingDDD(unittest.TestCase):
    def test_domain_all_branches(self) -> None:
        """UT-ORD-001 UT-ORD-002 UT-ORD-003 UT-ORD-004 UT-ORD-005 UT-ORD-006 UT-ORD-007 UT-ORD-008 UT-ORD-009 UT-ORD-010 UT-ORD-011 UT-ORD-012 UT-ORD-013"""
        self.assertIsInstance(create_order_id(" "), Err)
        oid = create_order_id(" ORD-1 ").value
        self.assertIsInstance(create_customer_id(" "), Err)
        cid = create_customer_id(" CUST-1 ").value
        self.assertIsInstance(create_product_id(" "), Err)
        pid1 = create_product_id(" P1 ").value
        pid2 = create_product_id(" P2 ").value

        self.assertIsInstance(create_quantity(1.5), Err)  # type: ignore[arg-type]
        self.assertIsInstance(create_quantity(True), Err)  # type: ignore[arg-type]
        self.assertIsInstance(create_quantity(0), Err)
        self.assertIsInstance(create_quantity(101), Err)
        qty2 = create_quantity(2).value

        self.assertIsInstance(create_money("10", "JPY"), Err)  # type: ignore[arg-type]
        self.assertIsInstance(create_money(True, "JPY"), Err)  # type: ignore[arg-type]
        self.assertIsInstance(create_money(-1, "JPY"), Err)
        jpy = create_money(500, "JPY").value
        usd = create_money(5, "USD").value

        sub = multiply_money(jpy, qty2)
        self.assertEqual(sub.amount, 1000)
        self.assertIsInstance(add_money(jpy, usd), Err)
        self.assertEqual(add_money(jpy, sub).value.amount, 1500)

        self.assertEqual(Order.create(oid, cid, ()).error.code, "EMPTY_ORDER_LINES")
        six = tuple(OrderLine(create_product_id(f"P{i}").value, qty2, jpy) for i in range(6))
        self.assertEqual(Order.create(oid, cid, six).error.code, "TOO_MANY_ORDER_LINES")
        self.assertEqual(
            Order.create(oid, cid, (OrderLine(pid1, qty2, jpy), OrderLine(pid1, qty2, jpy))).error.code,
            "DUPLICATE_PRODUCT",
        )
        self.assertEqual(
            Order.create(oid, cid, (OrderLine(pid1, qty2, jpy), OrderLine(pid2, qty2, usd))).error.code,
            "CURRENCY_MISMATCH",
        )

        order = Order.create(oid, cid, (OrderLine(pid1, qty2, jpy),)).value
        self.assertEqual(order.total_amount().amount, 1000)
        confirmed = order.confirm().value
        self.assertEqual(confirmed.status, "Confirmed")
        self.assertEqual(confirmed.confirm().error.code, "INVALID_ORDER_STATE")
        cancelled = confirmed.cancel().value
        self.assertEqual(cancelled.status, "Cancelled")
        self.assertEqual(cancelled.cancel().error.code, "INVALID_ORDER_STATE")

    def test_infrastructure_all_branches(self) -> None:
        """UT-ORD-014 UT-ORD-015 UT-ORD-016 UT-ORD-017 UT-ORD-018 UT-ORD-019 UT-ORD-020"""
        oid = create_order_id("ORD-100").value
        cid = create_customer_id("CUST-1").value
        pid = create_product_id("P1").value
        qty = create_quantity(3).value
        price = create_money(200, "JPY").value
        order = Order.create(oid, cid, (OrderLine(pid, qty, price),)).value
        confirmed = order.confirm().value
        cancelled = confirmed.cancel().value

        rec = to_order_record(cancelled)
        self.assertIsInstance(from_order_record(rec), Ok)
        self.assertEqual(from_order_record({**rec, "id": ""}).error.code, "REPOSITORY_ERROR")
        self.assertEqual(from_order_record({**rec, "customerId": ""}).error.code, "REPOSITORY_ERROR")
        self.assertEqual(
            from_order_record({**rec, "lines": [{"productId": "", "quantity": 1, "unitAmount": 100, "currency": "JPY"}]}).error.code,
            "REPOSITORY_ERROR",
        )
        self.assertEqual(
            from_order_record({**rec, "lines": [{"productId": "P1", "quantity": 0, "unitAmount": 100, "currency": "JPY"}]}).error.code,
            "REPOSITORY_ERROR",
        )
        self.assertEqual(
            from_order_record({**rec, "lines": [{"productId": "P1", "quantity": 1, "unitAmount": -1, "currency": "JPY"}]}).error.code,
            "REPOSITORY_ERROR",
        )
        self.assertEqual(
            from_order_record({**rec, "events": [{"type": "OrderConfirmedEvent", "orderId": "ORD-100", "totalAmount": {"amount": -5, "currency": "JPY"}}]}).error.code,
            "REPOSITORY_ERROR",
        )
        self.assertEqual(from_order_record({**rec, "lines": []}).error.code, "REPOSITORY_ERROR")

        class MockKv:
            def __init__(self) -> None:
                self.data: dict[str, str] = {}

            def put(self, k: str, v: str) -> None:
                self.data[k] = v

            def get(self, k: str) -> str:
                if k not in self.data:
                    raise FileNotFoundError(k)
                return self.data[k]

        repo = DriverOrderRepository(MockKv())
        self.assertIsInstance(repo.save(order), Ok)
        self.assertIsInstance(repo.find_by_id(oid), Ok)
        self.assertEqual(repo.find_by_id(create_order_id("MISS").value).error.code, "ORDER_NOT_FOUND")

        class BrokenKv:
            def put(self, k: str, v: str) -> None:
                raise OSError("disk full")

            def get(self, k: str) -> str:
                raise OSError("disk io")

        broken_repo = DriverOrderRepository(BrokenKv())
        self.assertEqual(broken_repo.save(order).error.code, "REPOSITORY_ERROR")
        self.assertEqual(broken_repo.find_by_id(oid).error.code, "REPOSITORY_ERROR")

        class CorruptKv:
            def put(self, k: str, v: str) -> None:
                pass

            def get(self, k: str) -> str:
                return "{bad-json"

        self.assertEqual(DriverOrderRepository(CorruptKv()).find_by_id(oid).error.code, "REPOSITORY_ERROR")

        class MockHttp:
            def __init__(self, status: int, fail: bool = False) -> None:
                self.status = status
                self.fail = fail

            def post_json(self, url: str, body: str) -> RawHttpResponse:
                if self.fail:
                    raise TimeoutError("timeout")
                return RawHttpResponse(self.status, "{}")

        self.assertIsInstance(InventoryGateway(MockHttp(200), "http://inv").reserve_stock(oid, order.lines), Ok)
        self.assertEqual(InventoryGateway(MockHttp(409), "http://inv").reserve_stock(oid, order.lines).error.code, "INSUFFICIENT_STOCK")
        self.assertEqual(InventoryGateway(MockHttp(500), "http://inv").reserve_stock(oid, order.lines).error.code, "EXTERNAL_TIMEOUT")
        self.assertEqual(InventoryGateway(MockHttp(200, True), "http://inv").reserve_stock(oid, order.lines).error.code, "EXTERNAL_TIMEOUT")

        self.assertIsInstance(PaymentGateway(MockHttp(200), "http://pay").charge(oid, order.total_amount()), Ok)
        self.assertEqual(PaymentGateway(MockHttp(402), "http://pay").charge(oid, order.total_amount()).error.code, "PAYMENT_DECLINED")
        self.assertEqual(PaymentGateway(MockHttp(503), "http://pay").charge(oid, order.total_amount()).error.code, "EXTERNAL_TIMEOUT")
        self.assertEqual(PaymentGateway(MockHttp(200, True), "http://pay").charge(oid, order.total_amount()).error.code, "EXTERNAL_TIMEOUT")

    def test_application_scenarios(self) -> None:
        """UT-ORD-021 UT-ORD-022 UT-ORD-023 UT-ORD-024 UT-ORD-025 UT-ORD-026"""
        class OkInv:
            def reserve_stock(self, oid, lines):
                return Ok(None)

        class FailInv:
            def reserve_stock(self, oid, lines):
                return Err(DomainError("INSUFFICIENT_STOCK", "short"))

        class OkPay:
            def charge(self, oid, amount):
                return Ok(None)

        class FailPay:
            def charge(self, oid, amount):
                return Err(DomainError("PAYMENT_DECLINED", "declined"))

        repo = InMemoryRepo()
        svc = OrderApplicationService(repo, OkInv(), OkPay())
        self.assertEqual(svc.place_order(PlaceOrderCommand("", "C", ())).error.code, "INVALID_ORDER_ID")
        self.assertEqual(svc.place_order(PlaceOrderCommand("O1", "", ())).error.code, "INVALID_CUSTOMER_ID")
        self.assertEqual(
            svc.place_order(PlaceOrderCommand("O1", "C", (PlaceOrderLineInput("", 1, 10, "JPY"),))).error.code,
            "INVALID_PRODUCT_ID",
        )
        self.assertEqual(
            svc.place_order(PlaceOrderCommand("O1", "C", (PlaceOrderLineInput("P1", 0, 10, "JPY"),))).error.code,
            "INVALID_QUANTITY",
        )
        self.assertEqual(
            svc.place_order(PlaceOrderCommand("O1", "C", (PlaceOrderLineInput("P1", 1, -1, "JPY"),))).error.code,
            "INVALID_MONEY_AMOUNT",
        )
        self.assertEqual(svc.place_order(PlaceOrderCommand("O1", "C", ())).error.code, "EMPTY_ORDER_LINES")

        fail_repo = InMemoryRepo(fail_save=True)
        self.assertEqual(
            OrderApplicationService(fail_repo, OkInv(), OkPay()).place_order(
                PlaceOrderCommand("O1", "C", (PlaceOrderLineInput("P1", 1, 10, "JPY"),))
            ).error.code,
            "REPOSITORY_ERROR",
        )

        placed = svc.place_order(PlaceOrderCommand("ORD-1", "C1", (PlaceOrderLineInput("P1", 2, 500, "JPY"),)))
        self.assertIsInstance(placed, Ok)

        self.assertEqual(svc.get_order("").error.code, "INVALID_ORDER_ID")
        self.assertEqual(svc.get_order("NONE").error.code, "ORDER_NOT_FOUND")
        self.assertEqual(svc.get_order("ORD-1").value.order_id, "ORD-1")

        self.assertEqual(svc.confirm_order("").error.code, "INVALID_ORDER_ID")
        self.assertEqual(svc.confirm_order("NONE").error.code, "ORDER_NOT_FOUND")
        self.assertEqual(OrderApplicationService(repo, FailInv(), OkPay()).confirm_order("ORD-1").error.code, "INSUFFICIENT_STOCK")
        self.assertEqual(OrderApplicationService(repo, OkInv(), FailPay()).confirm_order("ORD-1").error.code, "PAYMENT_DECLINED")
        repo.fail_save = True
        self.assertEqual(svc.confirm_order("ORD-1").error.code, "REPOSITORY_ERROR")
        repo.fail_save = False

        self.assertEqual(svc.confirm_order("ORD-1").value.status, "Confirmed")
        self.assertEqual(svc.confirm_order("ORD-1").error.code, "INVALID_ORDER_STATE")

        self.assertEqual(svc.cancel_order("").error.code, "INVALID_ORDER_ID")
        self.assertEqual(svc.cancel_order("NONE").error.code, "ORDER_NOT_FOUND")
        repo.fail_save = True
        self.assertEqual(svc.cancel_order("ORD-1").error.code, "REPOSITORY_ERROR")
        repo.fail_save = False
        self.assertEqual(svc.cancel_order("ORD-1").value.status, "Cancelled")
        self.assertEqual(svc.cancel_order("ORD-1").error.code, "INVALID_ORDER_STATE")

    def test_presentation_browser_all_branches(self) -> None:
        """UT-ORD-027 UT-ORD-028 UT-ORD-029 UT-ORD-030 UT-ORD-031"""
        from src.application.order.commands.order_service import OrderLineDto, OrderSummaryDto

        dto_draft = OrderSummaryDto(
            order_id="ORD-WEB-1",
            customer_id="CUST-9",
            status="Draft",
            total=create_money(2400, "JPY").value,
            lines=(OrderLineDto("BOOK-A", 2, create_money(1200, "JPY").value),),
        )
        dto_confirmed = OrderSummaryDto(
            order_id="ORD-WEB-1",
            customer_id="CUST-9",
            status="Confirmed",
            total=create_money(2400, "JPY").value,
            lines=dto_draft.lines,
        )
        dto_cancelled = OrderSummaryDto(
            order_id="ORD-WEB-1",
            customer_id="CUST-9",
            status="Cancelled",
            total=create_money(2400, "JPY").value,
            lines=dto_draft.lines,
        )

        class MockWebUseCases:
            def __init__(self) -> None:
                self.place_res = Ok(dto_draft)
                self.confirm_res = Ok(dto_confirmed)
                self.cancel_res = Ok(dto_cancelled)
                self.get_res = Ok(dto_draft)

            def place_order(self, cmd):
                return self.place_res

            def confirm_order(self, order_id):
                return self.confirm_res

            def cancel_order(self, order_id):
                return self.cancel_res

            def get_order(self, order_id):
                return self.get_res

        uc = MockWebUseCases()
        with run_order_web_server(uc, 0) as base_url:
            # 1. Invalid form submit -> 422 error banner (plus USD option branch)
            uc.place_res = Err(DomainError("EMPTY_ORDER_LINES", "invalid lines"))
            subprocess.run(
                [
                    "node",
                    str(ROOT / "scripts" / "browser_driver.mjs"),
                    json.dumps([
                        {"type": "goto", "url": f"{base_url}/"},
                        {"type": "fill", "selector": "input[name='orderId']", "value": "ORD-WEB-1"},
                        {"type": "fill", "selector": "input[name='customerId']", "value": "CUST-9"},
                        {"type": "fill", "selector": "input[name='productId']", "value": "BOOK-A"},
                        {"type": "fill", "selector": "select[name='currency']", "value": "USD"},
                        {"type": "click", "selector": "[data-testid='place-order-btn']"},
                        {"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "EMPTY_ORDER_LINES: Order must contain at least one line"},
                    ]),
                ],
                check=True,
                timeout=25,
            )

            # 2. Valid form submit (JPY) -> Draft view
            uc.place_res = Ok(dto_draft)
            subprocess.run(
                [
                    "node",
                    str(ROOT / "scripts" / "browser_driver.mjs"),
                    json.dumps([
                        {"type": "goto", "url": f"{base_url}/"},
                        {"type": "fill", "selector": "input[name='orderId']", "value": "ORD-WEB-1"},
                        {"type": "fill", "selector": "input[name='customerId']", "value": "CUST-9"},
                        {"type": "fill", "selector": "input[name='productId']", "value": "BOOK-A"},
                        {"type": "click", "selector": "[data-testid='place-order-btn']"},
                        {"type": "assertText", "selector": "[data-testid='order-status']", "expected": "Draft"},
                        {"type": "assertDisabled", "selector": "[data-testid='confirm-btn']", "expected": False},
                    ]),
                ],
                check=True,
                timeout=25,
            )

            # 3. Confirm error (422) and Confirm success (200)
            uc.confirm_res = Err(DomainError("INSUFFICIENT_STOCK", "out of stock"))
            subprocess.run(
                [
                    "node",
                    str(ROOT / "scripts" / "browser_driver.mjs"),
                    json.dumps([
                        {"type": "goto", "url": f"{base_url}/orders/ORD-WEB-1"},
                        {"type": "click", "selector": "[data-testid='confirm-btn']"},
                        {"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "INSUFFICIENT_STOCK: Insufficient stock"},
                    ]),
                ],
                check=True,
                timeout=25,
            )

            uc.get_res = Ok(dto_draft)
            uc.confirm_res = Ok(dto_confirmed)
            subprocess.run(
                [
                    "node",
                    str(ROOT / "scripts" / "browser_driver.mjs"),
                    json.dumps([
                        {"type": "goto", "url": f"{base_url}/orders/ORD-WEB-1"},
                        {"type": "click", "selector": "[data-testid='confirm-btn']"},
                        {"type": "assertText", "selector": "[data-testid='order-status']", "expected": "Confirmed"},
                        {"type": "assertDisabled", "selector": "[data-testid='confirm-btn']", "expected": True},
                    ]),
                ],
                check=True,
                timeout=25,
            )

            # 4. Cancel error (422) and Cancel success (200)
            uc.get_res = Ok(dto_confirmed)
            uc.cancel_res = Err(DomainError("REPOSITORY_ERROR", "db busy"))
            subprocess.run(
                [
                    "node",
                    str(ROOT / "scripts" / "browser_driver.mjs"),
                    json.dumps([
                        {"type": "goto", "url": f"{base_url}/orders/ORD-WEB-1"},
                        {"type": "click", "selector": "[data-testid='cancel-btn']"},
                        {"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "REPOSITORY_ERROR: Failed to access order storage"},
                    ]),
                ],
                check=True,
                timeout=25,
            )

            uc.get_res = Ok(dto_confirmed)
            uc.cancel_res = Ok(dto_cancelled)
            subprocess.run(
                [
                    "node",
                    str(ROOT / "scripts" / "browser_driver.mjs"),
                    json.dumps([
                        {"type": "goto", "url": f"{base_url}/orders/ORD-WEB-1"},
                        {"type": "click", "selector": "[data-testid='cancel-btn']"},
                        {"type": "assertText", "selector": "[data-testid='order-status']", "expected": "Cancelled"},
                        {"type": "assertDisabled", "selector": "[data-testid='confirm-btn']", "expected": True},
                        {"type": "assertDisabled", "selector": "[data-testid='cancel-btn']", "expected": True},
                    ]),
                ],
                check=True,
                timeout=25,
            )

            # 5. Missing order GET/POST/PUT/404 paths
            uc.get_res = Err(DomainError("ORDER_NOT_FOUND", "missing"))
            subprocess.run(
                [
                    "node",
                    str(ROOT / "scripts" / "browser_driver.mjs"),
                    json.dumps([
                        {"type": "goto", "url": f"{base_url}/orders/UNKNOWN"},
                        {"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "ORDER_NOT_FOUND: Order not found"},
                        {"type": "goto", "url": f"{base_url}/not-exist"},
                        {"type": "assertText", "selector": "[data-testid='not-found']", "expected": "Page Not Found"},
                    ]),
                ],
                check=True,
                timeout=25,
            )

            uc.get_res = Err(DomainError("UNKNOWN_CODE", "raw fallback"))
            subprocess.run(
                [
                    "node",
                    str(ROOT / "scripts" / "browser_driver.mjs"),
                    json.dumps([
                        {"type": "goto", "url": f"{base_url}/orders/ORD-WEB-1"},
                        {"type": "assertText", "selector": "[data-testid='error-banner']", "expected": "UNKNOWN_CODE: raw fallback"},
                    ]),
                ],
                check=True,
                timeout=25,
            )

            uc.confirm_res = Err(DomainError("ORDER_NOT_FOUND", "missing"))
            with self.assertRaises(urllib.error.HTTPError) as cm1:
                urllib.request.urlopen(urllib.request.Request(f"{base_url}/orders/UNKNOWN/confirm", data=b"", method="POST"))
            self.assertEqual(cm1.exception.code, 404)

            uc.cancel_res = Err(DomainError("ORDER_NOT_FOUND", "missing"))
            with self.assertRaises(urllib.error.HTTPError) as cm2:
                urllib.request.urlopen(urllib.request.Request(f"{base_url}/orders/UNKNOWN/cancel", data=b"", method="POST"))
            self.assertEqual(cm2.exception.code, 404)

            with self.assertRaises(urllib.error.HTTPError) as cm3:
                urllib.request.urlopen(urllib.request.Request(f"{base_url}/unknown", data=b"", method="POST"))
            self.assertEqual(cm3.exception.code, 404)

            with self.assertRaises(urllib.error.HTTPError) as cm4:
                urllib.request.urlopen(urllib.request.Request(f"{base_url}/", method="PUT"))
            self.assertEqual(cm4.exception.code, 404)

        from src.presentation.web.i18n.ja import MESSAGES as JA_MESSAGES

        uc.get_res = Ok(dto_draft)
        with run_order_web_server(uc, 0, JA_MESSAGES) as ja_url:
            subprocess.run(
                [
                    "node",
                    str(ROOT / "scripts" / "browser_driver.mjs"),
                    json.dumps([
                        {"type": "goto", "url": f"{ja_url}/"},
                        {"type": "assertAttr", "selector": "html", "attr": "lang", "expected": "ja"},
                        {"type": "assertText", "selector": "h1", "expected": "注文作成"},
                        {"type": "assertText", "selector": "[data-testid='place-order-btn']", "expected": "注文を確定する"},
                        {"type": "goto", "url": f"{ja_url}/orders/ORD-WEB-1"},
                        {"type": "assertAttr", "selector": "html", "attr": "lang", "expected": "ja"},
                        {"type": "assertText", "selector": "h1", "expected": "注文 ORD-WEB-1"},
                        {"type": "assertText", "selector": "[data-testid='confirm-btn']", "expected": "注文承認"},
                        {"type": "goto", "url": f"{ja_url}/not-exist"},
                        {"type": "assertText", "selector": "[data-testid='not-found']", "expected": "ページが見つかりません"},
                    ]),
                ],
                check=True,
                timeout=25,
            )
