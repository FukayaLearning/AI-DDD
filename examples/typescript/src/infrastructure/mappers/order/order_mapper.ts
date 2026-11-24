import { infrastructureError, type InfrastructureError } from "../../../domain/shared/errors.ts";
import { Order, type OrderLine, type OrderStatus } from "../../../domain/entities/order/order.ts";
import { err, ok, type Result } from "../../../domain/shared/result.ts";
import {
  CustomerId,
  OrderId,
  ProductId,
} from "../../../domain/value_objects/shared/identifiers.ts";
import { Money, type Currency } from "../../../domain/value_objects/shared/money.ts";
import { Quantity } from "../../../domain/value_objects/order/quantity.ts";

export interface OrderRecord {
  readonly id: string;
  readonly customerId: string;
  readonly status: OrderStatus;
  readonly version: number;
  readonly lines: readonly {
    readonly productId: string;
    readonly quantity: number;
    readonly unitAmount: number;
    readonly currency: Currency;
  }[];
}

export function toOrderRecord(order: Order): OrderRecord {
  return {
    id: order.id.value,
    customerId: order.customerId.value,
    status: order.status,
    version: order.version,
    lines: order.lines.map((l) => ({
      productId: l.productId.value,
      quantity: l.quantity.value,
      unitAmount: l.unitPrice.amount,
      currency: l.unitPrice.currency,
    })),
  };
}

export function fromOrderRecord(record: OrderRecord): Result<Order, InfrastructureError> {
  const idRes = OrderId.create(record.id);
  if (!idRes.ok) return err(infrastructureError("REPOSITORY_ERROR", idRes.error.message));

  const custRes = CustomerId.create(record.customerId);
  if (!custRes.ok) return err(infrastructureError("REPOSITORY_ERROR", custRes.error.message));

  const lines: OrderLine[] = [];
  for (const item of record.lines) {
    const pRes = ProductId.create(item.productId);
    if (!pRes.ok) return err(infrastructureError("REPOSITORY_ERROR", pRes.error.message));

    const qRes = Quantity.create(item.quantity);
    if (!qRes.ok) return err(infrastructureError("REPOSITORY_ERROR", qRes.error.message));

    const mRes = Money.create(item.unitAmount, item.currency);
    if (!mRes.ok) return err(infrastructureError("REPOSITORY_ERROR", mRes.error.message));

    lines.push({ productId: pRes.value, quantity: qRes.value, unitPrice: mRes.value });
  }

  const version = typeof record.version === "number" ? record.version : 0;
  const orderRes = Order.reconstitute(
    idRes.value,
    custRes.value,
    lines,
    record.status,
    version
  );
  if (!orderRes.ok) {
    return err(infrastructureError("REPOSITORY_ERROR", orderRes.error.message));
  }
  return ok(orderRes.value);
}
