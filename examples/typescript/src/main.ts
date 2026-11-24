import path from "node:path";
import { OrderApplicationService } from "./application/services/order/order_service.ts";
import { InventoryGateway } from "./infrastructure/gateways/inventory/inventory_gateway.ts";
import { PaymentGateway } from "./infrastructure/gateways/payment/payment_gateway.ts";
import { LoggingEventPublisher } from "./infrastructure/gateways/events/logging_event_publisher.ts";
import { FetchHttpJsonDriver } from "./infrastructure/drivers/http/http_driver.ts";
import { FileKvDriver } from "./infrastructure/drivers/kv/kv_driver.ts";
import { DriverOrderRepository } from "./infrastructure/repositories/order/driver_order_repository.ts";
import { startOrderWebServer } from "./presentation/controllers/order/order_controller.ts";
import { enMessages } from "./presentation/i18n/en.ts";
import { jaMessages } from "./presentation/i18n/ja.ts";

export function createOrderingApp(options: {
  dataDir: string;
  inventoryUrl: string;
  paymentUrl: string;
  httpTimeoutMs?: number;
}) {
  const kvDriver = new FileKvDriver(options.dataDir);
  const httpDriver = new FetchHttpJsonDriver(options.httpTimeoutMs ?? 5000);
  const repo = new DriverOrderRepository(kvDriver);
  const inventory = new InventoryGateway(httpDriver, options.inventoryUrl);
  const payment = new PaymentGateway(httpDriver, options.paymentUrl);
  const events = new LoggingEventPublisher();
  const useCases = new OrderApplicationService(repo, inventory, payment, events);
  return { useCases };
}

const isEntrypoint = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isEntrypoint) {
  const port = Number(process.env.PORT ?? "3000");
  const dataDir = process.env.ORDER_DATA_DIR ?? path.join(process.cwd(), ".order-data");
  const inventoryUrl = process.env.INVENTORY_URL ?? "http://127.0.0.1:4001/reserve";
  const paymentUrl = process.env.PAYMENT_URL ?? "http://127.0.0.1:4002/charge";
  const httpTimeoutMs = Number(process.env.HTTP_TIMEOUT_MS ?? "5000");
  const activeMessages = (process.env.APP_LOCALE ?? "ja") === "en" ? enMessages : jaMessages;
  const { useCases } = createOrderingApp({ dataDir, inventoryUrl, paymentUrl, httpTimeoutMs });
  const { baseUrl } = await startOrderWebServer(useCases, port, activeMessages);
  console.log(`LISTENING ${baseUrl}`);
}
