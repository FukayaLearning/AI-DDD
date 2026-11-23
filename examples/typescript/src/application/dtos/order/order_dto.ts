import type { OrderStatus } from "../../../domain/entities/order/order.ts";
import type { Currency, Money } from "../../../domain/value_objects/shared/money.ts";

export interface PlaceOrderLineInput {
  readonly productId: string;
  readonly quantity: number;
  readonly unitAmount: number;
  readonly currency: Currency;
}

export interface PlaceOrderCommand {
  readonly orderId: string;
  readonly customerId: string;
  readonly lines: readonly PlaceOrderLineInput[];
}

export interface OrderSummaryDto {
  readonly orderId: string;
  readonly customerId: string;
  readonly status: OrderStatus;
  readonly total: Money;
  readonly lines: readonly {
    readonly productId: string;
    readonly quantity: number;
    readonly unitPrice: Money;
  }[];
}
