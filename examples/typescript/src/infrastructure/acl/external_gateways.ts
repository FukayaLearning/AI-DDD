import { domainError, type DomainError } from "../../domain/errors.ts";
import type { OrderLine } from "../../domain/order.ts";
import type { InventoryPort, PaymentPort } from "../../domain/ports.ts";
import { err, ok, type Result } from "../../domain/result.ts";
import type { Money, OrderId } from "../../domain/value_objects.ts";
import type { HttpJsonDriver, RawHttpResponse } from "../drivers/http_driver.ts";

export function mapInventoryHttpResponse(res: RawHttpResponse): Result<void, DomainError> {
  if (res.status === 200) {
    return ok(undefined);
  }
  if (res.status === 409) {
    return err(domainError("INSUFFICIENT_STOCK", "Requested inventory is unavailable"));
  }
  return err(domainError("EXTERNAL_TIMEOUT", `Inventory service error status ${res.status}`));
}

export function mapPaymentHttpResponse(res: RawHttpResponse): Result<void, DomainError> {
  if (res.status === 200) {
    return ok(undefined);
  }
  if (res.status === 402) {
    return err(domainError("PAYMENT_DECLINED", "Payment gateway declined the charge"));
  }
  return err(domainError("EXTERNAL_TIMEOUT", `Payment service error status ${res.status}`));
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

export class PaymentGateway implements PaymentPort {
  private readonly driver: HttpJsonDriver;
  private readonly endpointUrl: string;

  constructor(driver: HttpJsonDriver, endpointUrl: string) {
    this.driver = driver;
    this.endpointUrl = endpointUrl;
  }

  async charge(orderId: OrderId, amount: Money): Promise<Result<void, DomainError>> {
    const body = JSON.stringify({
      orderId: orderId.value,
      amount: amount.amount,
      currency: amount.currency,
    });
    try {
      const res = await this.driver.postJson(this.endpointUrl, body);
      return mapPaymentHttpResponse(res);
    } catch {
      return err(domainError("EXTERNAL_TIMEOUT", "Payment service request timed out"));
    }
  }
}
