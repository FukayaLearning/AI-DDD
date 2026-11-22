from contextlib import contextmanager
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import re
from threading import Thread
from typing import Iterator
from urllib.parse import parse_qs, unquote
from src.application.order_service import OrderSummaryDto, OrderUseCases, PlaceOrderCommand, PlaceOrderLineInput
from src.domain.errors import DomainError
from src.domain.result import Err
from src.domain.value_objects import Currency


def _layout(title: str, content: str) -> str:
    return f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>{escape(title)}</title></head><body><main>{content}</main></body></html>"


def render_create_order_page(error: DomainError | None) -> str:
    banner = ""
    if error is not None:
        banner = f"<div data-testid='error-banner'>{escape(error.code)}: {escape(error.message)}</div>"
    return _layout(
        "Place Order",
        f"""<h1>Place Order</h1>
{banner}
<form method="POST" action="/orders">
  <input name="orderId" placeholder="Order ID" />
  <input name="customerId" placeholder="Customer ID" />
  <input name="productId" placeholder="Product ID" />
  <input name="quantity" type="number" value="1" />
  <input name="unitAmount" type="number" value="1000" />
  <select name="currency"><option value="JPY">JPY</option><option value="USD">USD</option></select>
  <button type="submit" data-testid="place-order-btn">Place Order</button>
</form>""",
    )


def render_order_detail_page(order: OrderSummaryDto, error: DomainError | None) -> str:
    banner = ""
    if error is not None:
        banner = f"<div data-testid='error-banner'>{escape(error.code)}: {escape(error.message)}</div>"
    rows = "".join(
        f"<tr><td>{escape(l.product_id)}</td><td>{l.quantity}</td><td>{l.unit_price.amount} {l.unit_price.currency}</td></tr>"
        for l in order.lines
    )
    confirm_disabled = "" if order.status == "Draft" else " disabled"
    cancel_disabled = " disabled" if order.status == "Cancelled" else ""
    oid = escape(order.order_id)
    return _layout(
        f"Order {order.order_id}",
        f"""<h1>Order {oid}</h1>
{banner}
<p>Customer: <span data-testid="customer-id">{escape(order.customer_id)}</span></p>
<p>Status: <span data-testid="order-status">{order.status}</span></p>
<p>Total: <span data-testid="order-total">{order.total.amount} {order.total.currency}</span></p>
<table><tbody data-testid="order-lines">{rows}</tbody></table>
<form method="POST" action="/orders/{oid}/confirm">
  <button type="submit" data-testid="confirm-btn"{confirm_disabled}>Confirm Order</button>
</form>
<form method="POST" action="/orders/{oid}/cancel">
  <button type="submit" data-testid="cancel-btn"{cancel_disabled}>Cancel Order</button>
</form>""",
    )


def dispatch_request(
    use_cases: OrderUseCases, method: str, path: str, body_text: str
) -> tuple[int, str]:
    if method == "GET":
        if path == "/":
            return (200, render_create_order_page(None))
        m = re.fullmatch(r"/orders/([^/]+)", path)
        if m:
            res = use_cases.get_order(unquote(m.group(1)))
            if isinstance(res, Err):
                return (
                    404,
                    _layout(
                        "Order Not Found",
                        f"<div data-testid='error-banner'>{escape(res.error.code)}: {escape(res.error.message)}</div>",
                    ),
                )
            return (200, render_order_detail_page(res.value, None))
        return (404, _layout("Not Found", "<p data-testid='not-found'>Page Not Found</p>"))

    if method == "POST":
        if path == "/orders":
            form = parse_qs(body_text, keep_blank_values=True)
            currency_raw = form["currency"][0]
            currency: Currency = "USD" if currency_raw == "USD" else "JPY"
            res = use_cases.place_order(
                PlaceOrderCommand(
                    order_id=form["orderId"][0],
                    customer_id=form["customerId"][0],
                    lines=(
                        PlaceOrderLineInput(
                            product_id=form["productId"][0],
                            quantity=int(form["quantity"][0]),
                            unit_amount=int(form["unitAmount"][0]),
                            currency=currency,
                        ),
                    ),
                )
            )
            if isinstance(res, Err):
                return (422, render_create_order_page(res.error))
            return (200, render_order_detail_page(res.value, None))

        m_confirm = re.fullmatch(r"/orders/([^/]+)/confirm", path)
        if m_confirm:
            oid = unquote(m_confirm.group(1))
            res = use_cases.confirm_order(oid)
            if isinstance(res, Err):
                cur = use_cases.get_order(oid)
                if isinstance(cur, Err):
                    return (
                        404,
                        _layout(
                            "Order Not Found",
                            f"<div data-testid='error-banner'>{escape(res.error.code)}: {escape(res.error.message)}</div>",
                        ),
                    )
                return (422, render_order_detail_page(cur.value, res.error))
            return (200, render_order_detail_page(res.value, None))

        m_cancel = re.fullmatch(r"/orders/([^/]+)/cancel", path)
        if m_cancel:
            oid = unquote(m_cancel.group(1))
            res = use_cases.cancel_order(oid)
            if isinstance(res, Err):
                cur = use_cases.get_order(oid)
                if isinstance(cur, Err):
                    return (
                        404,
                        _layout(
                            "Order Not Found",
                            f"<div data-testid='error-banner'>{escape(res.error.code)}: {escape(res.error.message)}</div>",
                        ),
                    )
                return (422, render_order_detail_page(cur.value, res.error))
            return (200, render_order_detail_page(res.value, None))

    return (404, _layout("Not Found", "<p data-testid='not-found'>Page Not Found</p>"))


def make_handler(use_cases: OrderUseCases):
    class OrderHandler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: object) -> None:
            return

        def do_GET(self) -> None:
            status, html = dispatch_request(use_cases, "GET", self.path, "")
            self._send(status, html)

        def do_POST(self) -> None:
            length = int(self.headers["Content-Length"])
            body = self.rfile.read(length).decode("utf-8")
            status, html = dispatch_request(use_cases, "POST", self.path, body)
            self._send(status, html)

        def do_PUT(self) -> None:
            status, html = dispatch_request(use_cases, "PUT", self.path, "")
            self._send(status, html)

        def _send(self, status: int, html: str) -> None:
            payload = html.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    return OrderHandler


@contextmanager
def run_order_web_server(use_cases: OrderUseCases, port: int = 0) -> Iterator[str]:
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(use_cases))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, actual_port = server.server_address
        yield f"http://{host}:{actual_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
