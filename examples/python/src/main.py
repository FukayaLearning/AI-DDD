import os
import pathlib
from http.server import ThreadingHTTPServer
from src.application.order_service import OrderApplicationService
from src.infrastructure.acl.external_gateways import InventoryGateway, PaymentGateway
from src.infrastructure.drivers.http_driver import UrllibHttpJsonDriver
from src.infrastructure.drivers.kv_driver import FileKvDriver
from src.infrastructure.repository.driver_order_repository import DriverOrderRepository
from src.presentation.order_web_server import make_handler


def create_ordering_app(data_dir: str, inventory_url: str, payment_url: str) -> OrderApplicationService:
    kv = FileKvDriver(data_dir)
    http_drv = UrllibHttpJsonDriver()
    repo = DriverOrderRepository(kv)
    inventory = InventoryGateway(http_drv, inventory_url)
    payment = PaymentGateway(http_drv, payment_url)
    return OrderApplicationService(repo, inventory, payment)


def main() -> None:
    port = int(os.environ.get("PORT", "3000"))
    data_dir = os.environ.get("ORDER_DATA_DIR", str(pathlib.Path.cwd() / ".order-data"))
    inventory_url = os.environ.get("INVENTORY_URL", "http://127.0.0.1:4001/reserve")
    payment_url = os.environ.get("PAYMENT_URL", "http://127.0.0.1:4002/charge")
    uc = create_ordering_app(data_dir, inventory_url, payment_url)
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(uc))
    actual_port = server.server_address[1]
    print(f"LISTENING http://127.0.0.1:{actual_port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
