import { domainError, type DomainError } from "../../../domain/shared/errors.ts";
import { err, ok, type Result } from "../../../domain/shared/result.ts";
import type { Money, OrderId } from "../../../domain/shared/value_objects.ts";
import type { PaymentPort } from "../../../application/shared/ports.ts";
import type { HttpJsonDriver, RawHttpResponse } from "../../drivers/http/http_driver.ts";

export function mapPaymentHttpResponse(res: RawHttpResponse): Result<void, DomainError> {
  if (res.status === 200) {
    return ok(undefined);
  }
  if (res.status === 402) {
    return err(domainError("PAYMENT_DECLINED", "Payment gateway declined the charge"));
  }
  return err(domainError("EXTERNAL_TIMEOUT", `Payment service error status ${res.status}`));
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
