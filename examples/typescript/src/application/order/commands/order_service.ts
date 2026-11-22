import type { DomainError } from "../../../domain/shared/errors.ts";
import { Order, type OrderLine } from "../../../domain/order/order.ts";
import type { OrderRepository } from "../../../domain/order/order_repository.ts";
import { err, ok, type Result } from "../../../domain/shared/result.ts";
import {
  createCustomerId,
  createMoney,
  createOrderId,
  createProductId,
  createQuantity,
  type Currency,
  type Money,
} from "../../../domain/shared/value_objects.ts";
import type { InventoryPort, PaymentPort } from "../../shared/ports.ts";

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
  readonly status: "Draft" | "Confirmed" | "Cancelled";
  readonly total: Money;
  readonly lines: readonly {
    readonly productId: string;
    readonly quantity: number;
    readonly unitPrice: Money;
  }[];
}

export interface OrderUseCases {
  placeOrder(cmd: PlaceOrderCommand): Promise<Result<OrderSummaryDto, DomainError>>;
  confirmOrder(orderId: string): Promise<Result<OrderSummaryDto, DomainError>>;
  cancelOrder(orderId: string): Promise<Result<OrderSummaryDto, DomainError>>;
  getOrder(orderId: string): Promise<Result<OrderSummaryDto, DomainError>>;
}

function toDto(order: Order): OrderSummaryDto {
  return {
    orderId: order.id.value,
    customerId: order.customerId.value,
    status: order.status,
    total: order.totalAmount(),
    lines: order.lines.map((l) => ({
      productId: l.productId.value,
      quantity: l.quantity.value,
      unitPrice: l.unitPrice,
    })),
  };
}

export class OrderApplicationService implements OrderUseCases {
  private readonly orders: OrderRepository;
  private readonly inventory: InventoryPort;
  private readonly payment: PaymentPort;

  constructor(orders: OrderRepository, inventory: InventoryPort, payment: PaymentPort) {
    this.orders = orders;
    this.inventory = inventory;
    this.payment = payment;
  }

  // @implements REQ-ORD-001
  async placeOrder(cmd: PlaceOrderCommand): Promise<Result<OrderSummaryDto, DomainError>> {
    const idRes = createOrderId(cmd.orderId);
    if (!idRes.ok) return err(idRes.error);

    const custRes = createCustomerId(cmd.customerId);
    if (!custRes.ok) return err(custRes.error);

    const builtLines: OrderLine[] = [];
    for (const item of cmd.lines) {
      const prodRes = createProductId(item.productId);
      if (!prodRes.ok) return err(prodRes.error);

      const qtyRes = createQuantity(item.quantity);
      if (!qtyRes.ok) return err(qtyRes.error);

      const moneyRes = createMoney(item.unitAmount, item.currency);
      if (!moneyRes.ok) return err(moneyRes.error);

      builtLines.push({ productId: prodRes.value, quantity: qtyRes.value, unitPrice: moneyRes.value });
    }

    const orderRes = Order.create(idRes.value, custRes.value, builtLines);
    if (!orderRes.ok) return err(orderRes.error);

    const saveRes = await this.orders.save(orderRes.value);
    if (!saveRes.ok) return err(saveRes.error);

    return ok(toDto(orderRes.value));
  }

  // @implements REQ-ORD-002
  async confirmOrder(rawOrderId: string): Promise<Result<OrderSummaryDto, DomainError>> {
    const idRes = createOrderId(rawOrderId);
    if (!idRes.ok) return err(idRes.error);

    const foundRes = await this.orders.findById(idRes.value);
    if (!foundRes.ok) return err(foundRes.error);

    const order = foundRes.value;
    const confirmedPreview = order.confirm();
    if (!confirmedPreview.ok) return err(confirmedPreview.error);

    const stockRes = await this.inventory.reserveStock(order.id, order.lines);
    if (!stockRes.ok) return err(stockRes.error);

    const payRes = await this.payment.charge(order.id, order.totalAmount());
    if (!payRes.ok) return err(payRes.error);

    const saveRes = await this.orders.save(confirmedPreview.value);
    if (!saveRes.ok) return err(saveRes.error);

    return ok(toDto(confirmedPreview.value));
  }

  // @implements REQ-ORD-003
  async cancelOrder(rawOrderId: string): Promise<Result<OrderSummaryDto, DomainError>> {
    const idRes = createOrderId(rawOrderId);
    if (!idRes.ok) return err(idRes.error);

    const foundRes = await this.orders.findById(idRes.value);
    if (!foundRes.ok) return err(foundRes.error);

    const cancelledRes = foundRes.value.cancel();
    if (!cancelledRes.ok) return err(cancelledRes.error);

    const saveRes = await this.orders.save(cancelledRes.value);
    if (!saveRes.ok) return err(saveRes.error);

    return ok(toDto(cancelledRes.value));
  }

  async getOrder(rawOrderId: string): Promise<Result<OrderSummaryDto, DomainError>> {
    const idRes = createOrderId(rawOrderId);
    if (!idRes.ok) return err(idRes.error);

    const foundRes = await this.orders.findById(idRes.value);
    if (!foundRes.ok) return err(foundRes.error);

    return ok(toDto(foundRes.value));
  }
}
