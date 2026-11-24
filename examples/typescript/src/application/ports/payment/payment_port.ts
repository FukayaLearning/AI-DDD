import type { InfrastructureError } from "../../../domain/shared/errors.ts";
import type { Result } from "../../../domain/shared/result.ts";
import type { OrderId } from "../../../domain/value_objects/shared/identifiers.ts";
import type { Money } from "../../../domain/value_objects/shared/money.ts";

export interface PaymentPort {
  charge(orderId: OrderId, amount: Money): Promise<Result<void, InfrastructureError>>;
  refund(orderId: OrderId, amount: Money): Promise<Result<void, InfrastructureError>>;
}
