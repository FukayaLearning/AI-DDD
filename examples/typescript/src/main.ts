import path from "node:path";
import { OrderApplicationService } from "./application/order_service.ts";
import { InventoryGateway, PaymentGateway } from "./infrastructure/acl/external_gateways.ts";
import { FetchHttpJsonDriver } from "./infrastructure/drivers/http_driver.ts";
import { FileKvDriver } from "./infrastructure/drivers/kv_driver.ts";
import { DriverOrderRepository } from "./infrastructure/repository/driver_order_repository.ts";
import { startOrderWebServer } from "./presentation/order_web_server.ts";

export function createOrderingApp(options: {
  dataDir: string;
  inventoryUrl: string;
  paymentUrl: string;
}) {
  const kvDriver = new FileKvDriver(options.dataDir);
  const httpDriver = new FetchHttpJsonDriver();
  const repo = new DriverOrderRepository(kvDriver);
  const inventory = new InventoryGateway(httpDriver, options.inventoryUrl);
  const payment = new PaymentGateway(httpDriver, options.paymentUrl);
  const useCases = new OrderApplicationService(repo, inventory, payment);
  return { useCases };
}

const isEntrypoint = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isEntrypoint) {
  const port = Number(process.env.PORT ?? "3000");
  const dataDir = process.env.ORDER_DATA_DIR ?? path.join(process.cwd(), ".order-data");
  const inventoryUrl = process.env.INVENTORY_URL ?? "http://127.0.0.1:4001/reserve";
  const paymentUrl = process.env.PAYMENT_URL ?? "http://127.0.0.1:4002/charge";
  const { useCases } = createOrderingApp({ dataDir, inventoryUrl, paymentUrl });
  const { baseUrl } = await startOrderWebServer(useCases, port);
  console.log(`LISTENING ${baseUrl}`);
}
