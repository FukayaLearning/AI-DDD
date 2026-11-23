import os
import pathlib
from http.server import ThreadingHTTPServer
from src.application.services.order.order_service import OrderApplicationService
from src.infrastructure.gateways.inventory.inventory_gateway import InventoryGateway
from src.infrastructure.gateways.payment.payment_gateway import PaymentGateway
from src.infrastructure.drivers.http.http_driver import UrllibHttpJsonDriver
from src.infrastructure.drivers.kv.kv_driver import FileKvDriver
from src.infrastructure.repositories.order.driver_order_repository import DriverOrderRepository
from src.presentation.i18n.en import MESSAGES as EN_MESSAGES
from src.presentation.i18n.ja import MESSAGES as JA_MESSAGES
from src.presentation.controllers.order.order_controller import make_handler


def create_ordering_app(
    data_dir: str,
    inventory_url: str,
    payment_url: str,
    http_timeout_sec: float = 5.0,
) -> OrderApplicationService:
    kv = FileKvDriver(data_dir)
    http_drv = UrllibHttpJsonDriver(http_timeout_sec)
    repo = DriverOrderRepository(kv)
    inventory = InventoryGateway(http_drv, inventory_url)
    payment = PaymentGateway(http_drv, payment_url)
    return OrderApplicationService(repo, inventory, payment)


def main() -> None:
    port = int(os.environ.get("PORT", "3000"))
    data_dir = os.environ.get("ORDER_DATA_DIR", str(pathlib.Path.cwd() / ".order-data"))
    inventory_url = os.environ.get("INVENTORY_URL", "http://127.0.0.1:4001/reserve")
    payment_url = os.environ.get("PAYMENT_URL", "http://127.0.0.1:4002/charge")
    http_timeout_sec = float(os.environ.get("HTTP_TIMEOUT_SEC", "5.0"))
    messages = EN_MESSAGES if os.environ.get("APP_LOCALE", "ja") == "en" else JA_MESSAGES
    uc = create_ordering_app(data_dir, inventory_url, payment_url, http_timeout_sec)
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(uc, messages))
    actual_port = server.server_address[1]
    print(f"LISTENING http://127.0.0.1:{actual_port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
