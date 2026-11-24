import { infrastructureError, type InfrastructureError } from "../../../domain/shared/errors.ts";
import { err, ok, type Result } from "../../../domain/shared/result.ts";
import type { Money } from "../../../domain/value_objects/shared/money.ts";
import type { OrderId } from "../../../domain/value_objects/shared/identifiers.ts";
import type { PaymentPort } from "../../../application/ports/payment/payment_port.ts";
import type { HttpJsonDriver, RawHttpResponse } from "../../drivers/http/http_driver.ts";

export function mapPaymentHttpResponse(res: RawHttpResponse): Result<void, InfrastructureError> {
  if (res.status === 200) {
    return ok(undefined);
  }
  if (res.status === 402) {
    return err(infrastructureError("PAYMENT_DECLINED", "Payment gateway declined the charge"));
  }
  return err(infrastructureError("EXTERNAL_TIMEOUT", `Payment service error status ${res.status}`));
}

export function mapPaymentRefundResponse(res: RawHttpResponse): Result<void, InfrastructureError> {
  if (res.status === 200) {
    return ok(undefined);
  }
  return err(infrastructureError("EXTERNAL_TIMEOUT", `Payment refund error status ${res.status}`));
}

export class PaymentGateway implements PaymentPort {
  private readonly driver: HttpJsonDriver;
  private readonly endpointUrl: string;
  private readonly refundUrl: string;

  constructor(driver: HttpJsonDriver, endpointUrl: string, refundUrl?: string) {
    this.driver = driver;
    this.endpointUrl = endpointUrl;
    this.refundUrl = refundUrl ?? endpointUrl.replace(/\/charge$/, "/refund");
  }

  async charge(orderId: OrderId, amount: Money): Promise<Result<void, InfrastructureError>> {
    const body = JSON.stringify({
      orderId: orderId.value,
      amount: amount.amount,
      currency: amount.currency,
    });
    try {
      const res = await this.driver.postJson(this.endpointUrl, body);
      return mapPaymentHttpResponse(res);
    } catch {
      return err(infrastructureError("EXTERNAL_TIMEOUT", "Payment service request timed out"));
    }
  }

  async refund(orderId: OrderId, amount: Money): Promise<Result<void, InfrastructureError>> {
    const body = JSON.stringify({
      orderId: orderId.value,
      amount: amount.amount,
      currency: amount.currency,
    });
    try {
      const res = await this.driver.postJson(this.refundUrl, body);
      return mapPaymentRefundResponse(res);
    } catch {
      return err(infrastructureError("EXTERNAL_TIMEOUT", "Payment refund request timed out"));
    }
  }
}
