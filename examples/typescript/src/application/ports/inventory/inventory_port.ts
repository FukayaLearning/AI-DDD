import type { InfrastructureError } from "../../../domain/shared/errors.ts";
import type { Result } from "../../../domain/shared/result.ts";
import type { OrderId } from "../../../domain/value_objects/shared/identifiers.ts";

export interface ReserveStockItem {
  readonly productId: string;
  readonly quantity: number;
}

export interface InventoryPort {
  reserveStock(
    orderId: OrderId,
    items: readonly ReserveStockItem[]
  ): Promise<Result<void, InfrastructureError>>;
  releaseStock(
    orderId: OrderId,
    items: readonly ReserveStockItem[]
  ): Promise<Result<void, InfrastructureError>>;
}
