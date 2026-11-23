import type { DomainError } from "../../../domain/shared/errors.ts";
import type { Result } from "../../../domain/shared/result.ts";
import type { OrderLine } from "../../../domain/entities/order/order.ts";
import type { OrderId } from "../../../domain/value_objects/shared/identifiers.ts";

export interface InventoryPort {
  reserveStock(orderId: OrderId, lines: readonly OrderLine[]): Promise<Result<void, DomainError>>;
}
