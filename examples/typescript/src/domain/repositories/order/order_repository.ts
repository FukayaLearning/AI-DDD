import type { DomainError } from "../../shared/errors.ts";
import type { Result } from "../../shared/result.ts";
import type { OrderId } from "../../value_objects/shared/identifiers.ts";
import type { Order } from "../../entities/order/order.ts";

export interface OrderRepository {
  save(order: Order): Promise<Result<void, DomainError>>;
  findById(orderId: OrderId): Promise<Result<Order, DomainError>>;
}
