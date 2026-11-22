import type { DomainError } from "../shared/errors.ts";
import type { Result } from "../shared/result.ts";
import type { OrderId } from "../shared/value_objects.ts";
import type { Order } from "./order.ts";

export interface OrderRepository {
  save(order: Order): Promise<Result<void, DomainError>>;
  findById(orderId: OrderId): Promise<Result<Order, DomainError>>;
}
