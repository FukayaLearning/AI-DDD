import { infrastructureError, type InfrastructureError } from "../../../domain/shared/errors.ts";
import { err, ok, type Result } from "../../../domain/shared/result.ts";
import type { OrderId } from "../../../domain/value_objects/shared/identifiers.ts";
import type { InventoryPort, ReserveStockItem } from "../../../application/ports/inventory/inventory_port.ts";
import type { HttpJsonDriver, RawHttpResponse } from "../../drivers/http/http_driver.ts";

export function mapInventoryHttpResponse(res: RawHttpResponse): Result<void, InfrastructureError> {
  if (res.status === 200) {
    return ok(undefined);
  }
  if (res.status === 409) {
    return err(infrastructureError("INSUFFICIENT_STOCK", "Requested inventory is unavailable"));
  }
  return err(infrastructureError("EXTERNAL_TIMEOUT", `Inventory service error status ${res.status}`));
}

export function mapInventoryReleaseResponse(res: RawHttpResponse): Result<void, InfrastructureError> {
  if (res.status === 200) {
    return ok(undefined);
  }
  return err(infrastructureError("EXTERNAL_TIMEOUT", `Inventory release error status ${res.status}`));
}

export class InventoryGateway implements InventoryPort {
  private readonly driver: HttpJsonDriver;
  private readonly endpointUrl: string;
  private readonly releaseUrl: string;

  constructor(driver: HttpJsonDriver, endpointUrl: string, releaseUrl?: string) {
    this.driver = driver;
    this.endpointUrl = endpointUrl;
    this.releaseUrl = releaseUrl ?? endpointUrl.replace(/\/reserve$/, "/release");
  }

  async reserveStock(
    orderId: OrderId,
    items: readonly ReserveStockItem[]
  ): Promise<Result<void, InfrastructureError>> {
    const body = JSON.stringify({ orderId: orderId.value, items });
    try {
      const res = await this.driver.postJson(this.endpointUrl, body);
      return mapInventoryHttpResponse(res);
    } catch {
      return err(infrastructureError("EXTERNAL_TIMEOUT", "Inventory service request timed out"));
    }
  }

  async releaseStock(
    orderId: OrderId,
    items: readonly ReserveStockItem[]
  ): Promise<Result<void, InfrastructureError>> {
    const body = JSON.stringify({ orderId: orderId.value, items });
    try {
      const res = await this.driver.postJson(this.releaseUrl, body);
      return mapInventoryReleaseResponse(res);
    } catch {
      return err(infrastructureError("EXTERNAL_TIMEOUT", "Inventory release request timed out"));
    }
  }
}
