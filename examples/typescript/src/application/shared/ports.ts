import type { DomainError } from "../../domain/shared/errors.ts";
import type { OrderLine } from "../../domain/order/order.ts";
import type { Result } from "../../domain/shared/result.ts";
import type { Money, OrderId } from "../../domain/shared/value_objects.ts";

export interface InventoryPort {
  reserveStock(orderId: OrderId, lines: readonly OrderLine[]): Promise<Result<void, DomainError>>;
}

export interface PaymentPort {
  charge(orderId: OrderId, amount: Money): Promise<Result<void, DomainError>>;
}
