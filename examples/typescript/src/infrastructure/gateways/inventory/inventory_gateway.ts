import { domainError, type DomainError } from "../../../domain/shared/errors.ts";
import type { OrderLine } from "../../../domain/entities/order/order.ts";
import { err, ok, type Result } from "../../../domain/shared/result.ts";
import type { OrderId } from "../../../domain/value_objects/shared/identifiers.ts";
import type { InventoryPort } from "../../../application/ports/inventory/inventory_port.ts";
import type { HttpJsonDriver, RawHttpResponse } from "../../drivers/http/http_driver.ts";

export function mapInventoryHttpResponse(res: RawHttpResponse): Result<void, DomainError> {
  if (res.status === 200) {
    return ok(undefined);
  }
  if (res.status === 409) {
    return err(domainError("INSUFFICIENT_STOCK", "Requested inventory is unavailable"));
  }
  return err(domainError("EXTERNAL_TIMEOUT", `Inventory service error status ${res.status}`));
}

export class InventoryGateway implements InventoryPort {
  private readonly driver: HttpJsonDriver;
  private readonly endpointUrl: string;

  constructor(driver: HttpJsonDriver, endpointUrl: string) {
    this.driver = driver;
    this.endpointUrl = endpointUrl;
  }

  async reserveStock(orderId: OrderId, lines: readonly OrderLine[]): Promise<Result<void, DomainError>> {
    const body = JSON.stringify({
      orderId: orderId.value,
      items: lines.map((l) => ({ productId: l.productId.value, quantity: l.quantity.value })),
    });
    try {
      const res = await this.driver.postJson(this.endpointUrl, body);
      return mapInventoryHttpResponse(res);
    } catch {
      return err(domainError("EXTERNAL_TIMEOUT", "Inventory service request timed out"));
    }
  }
}
