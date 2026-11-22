import type { DomainError } from "./errors.ts";
import type { Order, OrderLine } from "./order.ts";
import type { Result } from "./result.ts";
import type { Money, OrderId } from "./value_objects.ts";

export interface OrderRepository {
  save(order: Order): Promise<Result<void, DomainError>>;
  findById(orderId: OrderId): Promise<Result<Order, DomainError>>;
}

export interface InventoryPort {
  reserveStock(orderId: OrderId, lines: readonly OrderLine[]): Promise<Result<void, DomainError>>;
}

export interface PaymentPort {
  charge(orderId: OrderId, amount: Money): Promise<Result<void, DomainError>>;
}
