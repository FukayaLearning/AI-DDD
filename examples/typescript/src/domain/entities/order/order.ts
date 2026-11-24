import { domainError, type DomainError } from "../../shared/errors.ts";
import { err, ok, type Result } from "../../shared/result.ts";
import {
  CustomerId,
  OrderId,
  ProductId,
} from "../../value_objects/shared/identifiers.ts";
import { Money } from "../../value_objects/shared/money.ts";
import { Quantity } from "../../value_objects/order/quantity.ts";

export type OrderStatus = "Draft" | "Confirmed" | "Cancelled";

export interface OrderLine {
  readonly productId: ProductId;
  readonly quantity: Quantity;
  readonly unitPrice: Money;
}

export type DomainEvent =
  | {
      readonly type: "OrderConfirmedEvent";
      readonly orderId: string;
      readonly totalAmount: Money;
    }
  | {
      readonly type: "OrderCancelledEvent";
      readonly orderId: string;
      readonly previousStatus: OrderStatus;
    };

interface OrderProps {
  readonly id: OrderId;
  readonly customerId: CustomerId;
  readonly lines: readonly OrderLine[];
  readonly status: OrderStatus;
  readonly version: number;
  readonly events: readonly DomainEvent[];
}

function validateLines(
  lines: readonly OrderLine[]
): Result<readonly OrderLine[], DomainError> {
  if (lines.length === 0) {
    return err(domainError("EMPTY_ORDER_LINES", "Order must contain at least 1 line"));
  }
  if (lines.length > 5) {
    return err(domainError("TOO_MANY_ORDER_LINES", "Order cannot exceed 5 lines"));
  }
  const seen = new Set<string>();
  const currency = lines[0].unitPrice.currency;
  for (const line of lines) {
    if (!(line.productId instanceof ProductId)) {
      return err(domainError("INVALID_PRODUCT_ID", "OrderLine contains an invalid ProductId"));
    }
    if (!(line.quantity instanceof Quantity)) {
      return err(domainError("INVALID_QUANTITY", "OrderLine contains an invalid Quantity"));
    }
    if (!(line.unitPrice instanceof Money)) {
      return err(domainError("INVALID_MONEY_AMOUNT", "OrderLine contains an invalid Money"));
    }
    if (seen.has(line.productId.value)) {
      return err(
        domainError("DUPLICATE_PRODUCT", `Duplicate productId: ${line.productId.value}`)
      );
    }
    seen.add(line.productId.value);
    if (line.unitPrice.currency !== currency) {
      return err(domainError("CURRENCY_MISMATCH", "All order lines must share the same currency"));
    }
  }
  return ok(lines);
}

export class Order {
  readonly id: OrderId;
  readonly customerId: CustomerId;
  readonly status: OrderStatus;
  readonly version: number;
  private readonly _lines: readonly OrderLine[];
  private _events: DomainEvent[];

  private constructor(props: OrderProps) {
    this.id = props.id;
    this.customerId = props.customerId;
    this._lines = props.lines;
    this.status = props.status;
    this.version = props.version;
    this._events = [...props.events];
  }

  get lines(): readonly OrderLine[] {
    return this._lines;
  }

  static create(
    id: OrderId,
    customerId: CustomerId,
    lines: readonly OrderLine[]
  ): Result<Order, DomainError> {
    const validated = validateLines(lines);
    if (!validated.ok) return err(validated.error);
    return ok(
      new Order({
        id,
        customerId,
        lines: validated.value,
        status: "Draft",
        version: 0,
        events: [],
      })
    );
  }

  static reconstitute(
    id: OrderId,
    customerId: CustomerId,
    lines: readonly OrderLine[],
    status: OrderStatus,
    version: number
  ): Result<Order, DomainError> {
    if (!Number.isInteger(version) || version < 0) {
      return err(domainError("INVALID_ORDER_STATE", "Order version must be a non-negative integer"));
    }
    if (status !== "Draft" && status !== "Confirmed" && status !== "Cancelled") {
      return err(domainError("INVALID_ORDER_STATE", `Unknown order status: ${String(status)}`));
    }
    const validated = validateLines(lines);
    if (!validated.ok) return err(validated.error);
    return ok(
      new Order({
        id,
        customerId,
        lines: validated.value,
        status,
        version,
        events: [],
      })
    );
  }

  equals(other: Order): boolean {
    return this.id.equals(other.id);
  }

  canConfirm(): boolean {
    return this.status === "Draft";
  }

  canCancel(): boolean {
    return this.status !== "Cancelled";
  }

  totalAmount(): Result<Money, DomainError> {
    let total = Money.zero(this._lines[0].unitPrice.currency);
    for (const line of this._lines) {
      const sub = line.unitPrice.multiply(line.quantity);
      if (!sub.ok) return sub;
      const sum = total.add(sub.value);
      if (!sum.ok) return sum;
      total = sum.value;
    }
    return ok(total);
  }

  confirm(): Result<Order, DomainError> {
    if (!this.canConfirm()) {
      return err(domainError("INVALID_ORDER_STATE", `Cannot confirm order in ${this.status} status`));
    }
    const total = this.totalAmount();
    if (!total.ok) return total;
    const event: DomainEvent = {
      type: "OrderConfirmedEvent",
      orderId: this.id.value,
      totalAmount: total.value,
    };
    return ok(
      new Order({
        id: this.id,
        customerId: this.customerId,
        lines: this._lines,
        status: "Confirmed",
        version: this.version,
        events: [...this._events, event],
      })
    );
  }

  cancel(): Result<Order, DomainError> {
    if (!this.canCancel()) {
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
        lines: this._lines,
        status: "Cancelled",
        version: this.version,
        events: [...this._events, event],
      })
    );
  }

  pullEvents(): readonly DomainEvent[] {
    const pulled = [...this._events];
    this._events = [];
    return pulled;
  }

  clearEvents(): void {
    this._events = [];
  }
}
