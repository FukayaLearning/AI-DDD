import { domainError, type DomainError } from "../../../domain/shared/errors.ts";
import { Order, type DomainEvent, type OrderLine, type OrderStatus } from "../../../domain/entities/order/order.ts";
import { err, type Result } from "../../../domain/shared/result.ts";
import {
  createCustomerId,
  createOrderId,
  createProductId,
} from "../../../domain/value_objects/shared/identifiers.ts";
import { createMoney, type Currency } from "../../../domain/value_objects/shared/money.ts";
import { createQuantity } from "../../../domain/value_objects/order/quantity.ts";

export interface OrderRecord {
  readonly id: string;
  readonly customerId: string;
  readonly status: OrderStatus;
  readonly lines: readonly {
    readonly productId: string;
    readonly quantity: number;
    readonly unitAmount: number;
    readonly currency: Currency;
  }[];
  readonly events: readonly DomainEvent[];
}

export function toOrderRecord(order: Order): OrderRecord {
  return {
    id: order.id.value,
    customerId: order.customerId.value,
    status: order.status,
    lines: order.lines.map((l) => ({
      productId: l.productId.value,
      quantity: l.quantity.value,
      unitAmount: l.unitPrice.amount,
      currency: l.unitPrice.currency,
    })),
    events: order.events,
  };
}

export function fromOrderRecord(record: OrderRecord): Result<Order, DomainError> {
  const idRes = createOrderId(record.id);
  if (!idRes.ok) return err(domainError("REPOSITORY_ERROR", idRes.error.message));

  const custRes = createCustomerId(record.customerId);
  if (!custRes.ok) return err(domainError("REPOSITORY_ERROR", custRes.error.message));

  const lines: OrderLine[] = [];
  for (const item of record.lines) {
    const pRes = createProductId(item.productId);
    if (!pRes.ok) return err(domainError("REPOSITORY_ERROR", pRes.error.message));

    const qRes = createQuantity(item.quantity);
    if (!qRes.ok) return err(domainError("REPOSITORY_ERROR", qRes.error.message));

    const mRes = createMoney(item.unitAmount, item.currency);
    if (!mRes.ok) return err(domainError("REPOSITORY_ERROR", mRes.error.message));

    lines.push({ productId: pRes.value, quantity: qRes.value, unitPrice: mRes.value });
  }

  const orderRes = Order.create(idRes.value, custRes.value, lines, record.status, record.events);
  if (!orderRes.ok) return err(domainError("REPOSITORY_ERROR", orderRes.error.message));

  return orderRes;
}
