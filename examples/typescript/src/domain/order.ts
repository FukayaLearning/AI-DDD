import { domainError, type DomainError } from "./errors.ts";
import { err, ok, type Result } from "./result.ts";
import {
  addMoney,
  createMoney,
  multiplyMoney,
  type CustomerId,
  type Money,
  type OrderId,
  type ProductId,
  type Quantity,
} from "./value_objects.ts";

export type OrderStatus = "Draft" | "Confirmed" | "Cancelled";

export interface OrderLine {
  readonly productId: ProductId;
  readonly quantity: Quantity;
  readonly unitPrice: Money;
}

export type DomainEvent =
  | { readonly type: "OrderConfirmedEvent"; readonly orderId: string; readonly totalAmount: Money }
  | { readonly type: "OrderCancelledEvent"; readonly orderId: string; readonly previousStatus: OrderStatus };

export interface OrderProps {
  readonly id: OrderId;
  readonly customerId: CustomerId;
  readonly lines: readonly OrderLine[];
  readonly status: OrderStatus;
  readonly events: readonly DomainEvent[];
}

export class Order {
  readonly id: OrderId;
  readonly customerId: CustomerId;
  readonly lines: readonly OrderLine[];
  readonly status: OrderStatus;
  readonly events: readonly DomainEvent[];

  private constructor(props: OrderProps) {
    this.id = props.id;
    this.customerId = props.customerId;
    this.lines = props.lines;
    this.status = props.status;
    this.events = props.events;
  }

  static create(
    id: OrderId,
    customerId: CustomerId,
    lines: readonly OrderLine[],
    status: OrderStatus = "Draft",
    events: readonly DomainEvent[] = []
  ): Result<Order, DomainError> {
    if (lines.length === 0) {
      return err(domainError("EMPTY_ORDER_LINES", "Order must contain at least 1 line"));
    }
    if (lines.length > 5) {
      return err(domainError("TOO_MANY_ORDER_LINES", "Order cannot exceed 5 lines"));
    }
    const seen = new Set<string>();
    const currency = lines[0].unitPrice.currency;
    for (const line of lines) {
      if (seen.has(line.productId.value)) {
        return err(domainError("DUPLICATE_PRODUCT", `Duplicate productId: ${line.productId.value}`));
      }
      seen.add(line.productId.value);
      if (line.unitPrice.currency !== currency) {
        return err(domainError("CURRENCY_MISMATCH", "All order lines must share the same currency"));
      }
    }
    return ok(new Order({ id, customerId, lines, status, events }));
  }

  totalAmount(): Money {
    const currency = this.lines[0].unitPrice.currency;
    let total = (createMoney(0, currency) as { ok: true; value: Money }).value;
    for (const line of this.lines) {
      const sub = multiplyMoney(line.unitPrice, line.quantity);
      total = (addMoney(total, sub) as { ok: true; value: Money }).value;
    }
    return total;
  }

  confirm(): Result<Order, DomainError> {
    if (this.status !== "Draft") {
      return err(domainError("INVALID_ORDER_STATE", `Cannot confirm order in ${this.status} status`));
    }
    const event: DomainEvent = {
      type: "OrderConfirmedEvent",
      orderId: this.id.value,
      totalAmount: this.totalAmount(),
    };
    return ok(
      new Order({
        id: this.id,
        customerId: this.customerId,
        lines: this.lines,
        status: "Confirmed",
        events: [...this.events, event],
      })
    );
  }

  cancel(): Result<Order, DomainError> {
    if (this.status === "Cancelled") {
      return err(domainError("INVALID_ORDER_STATE", "Order is already cancelled"));
    }
    const event: DomainEvent = {
      type: "OrderCancelledEvent",
      orderId: this.id.value,
      previousStatus: this.status,
    };
    return ok(
      new Order({
        id: this.id,
        customerId: this.customerId,
        lines: this.lines,
        status: "Cancelled",
        events: [...this.events, event],
      })
    );
  }
}
