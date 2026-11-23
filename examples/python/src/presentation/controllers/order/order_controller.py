from contextlib import contextmanager
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import re
from threading import Thread
from typing import Iterator
from urllib.parse import parse_qs, unquote
from src.application.dtos.order.order_dto import PlaceOrderCommand, PlaceOrderLineInput
from src.application.services.order.order_service import OrderUseCases
from src.domain.shared.result import Err
from src.domain.value_objects.shared.money import Currency
from src.presentation.i18n.en import MESSAGES as EN_MESSAGES
from src.presentation.views.order.order_view import (
    layout,
    localize_error,
    render_create_order_page,
    render_order_detail_page,
)


# @implements REQ-ORD-004
def dispatch_request(
    use_cases: OrderUseCases,
    method: str,
    path: str,
    body_text: str,
    messages: dict[str, str] = EN_MESSAGES,
) -> tuple[int, str]:
    if method == "GET":
        if path == "/":
            return (200, render_create_order_page(None, messages))
        m = re.fullmatch(r"/orders/([^/]+)", path)
        if m:
            res = use_cases.get_order(unquote(m.group(1)))
            if isinstance(res, Err):
                return (
                    404,
                    layout(
                        messages["locale"],
                        messages["orderNotFoundTitle"],
                        f"<div data-testid='error-banner'>{escape(res.error.code)}: {escape(localize_error(messages, res.error))}</div>",
                    ),
                )
            return (200, render_order_detail_page(res.value, None, messages))
        return (404, layout(messages["locale"], messages["notFoundTitle"], f"<p data-testid='not-found'>{escape(messages['notFoundBody'])}</p>"))

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
                return (422, render_create_order_page(res.error, messages))
            return (200, render_order_detail_page(res.value, None, messages))

        m_confirm = re.fullmatch(r"/orders/([^/]+)/confirm", path)
        if m_confirm:
            oid = unquote(m_confirm.group(1))
            res = use_cases.confirm_order(oid)
            if isinstance(res, Err):
                cur = use_cases.get_order(oid)
                if isinstance(cur, Err):
                    return (
                        404,
                        layout(
                            messages["locale"],
                            messages["orderNotFoundTitle"],
                            f"<div data-testid='error-banner'>{escape(res.error.code)}: {escape(localize_error(messages, res.error))}</div>",
                        ),
                    )
                return (422, render_order_detail_page(cur.value, res.error, messages))
            return (200, render_order_detail_page(res.value, None, messages))

        m_cancel = re.fullmatch(r"/orders/([^/]+)/cancel", path)
        if m_cancel:
            oid = unquote(m_cancel.group(1))
            res = use_cases.cancel_order(oid)
            if isinstance(res, Err):
                cur = use_cases.get_order(oid)
                if isinstance(cur, Err):
                    return (
                        404,
                        layout(
                            messages["locale"],
                            messages["orderNotFoundTitle"],
                            f"<div data-testid='error-banner'>{escape(res.error.code)}: {escape(localize_error(messages, res.error))}</div>",
                        ),
                    )
                return (422, render_order_detail_page(cur.value, res.error, messages))
            return (200, render_order_detail_page(res.value, None, messages))

    return (404, layout(messages["locale"], messages["notFoundTitle"], f"<p data-testid='not-found'>{escape(messages['notFoundBody'])}</p>"))


def make_handler(use_cases: OrderUseCases, messages: dict[str, str] = EN_MESSAGES):
    class OrderHandler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: object) -> None:
            return

        def do_GET(self) -> None:
            status, html = dispatch_request(use_cases, "GET", self.path, "", messages)
            self._send(status, html)

        def do_POST(self) -> None:
            length = int(self.headers["Content-Length"])
            body = self.rfile.read(length).decode("utf-8")
            status, html = dispatch_request(use_cases, "POST", self.path, body, messages)
            self._send(status, html)

        def do_PUT(self) -> None:
            status, html = dispatch_request(use_cases, "PUT", self.path, "", messages)
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
def run_order_web_server(
    use_cases: OrderUseCases,
    port: int = 0,
    messages: dict[str, str] = EN_MESSAGES,
) -> Iterator[str]:
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(use_cases, messages))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, actual_port = server.server_address
        yield f"http://{host}:{actual_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
