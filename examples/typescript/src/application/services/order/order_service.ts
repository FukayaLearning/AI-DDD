import type { DomainError, OrderError } from "../../../domain/shared/errors.ts";
import { Order, type OrderLine } from "../../../domain/entities/order/order.ts";
import type { OrderRepository } from "../../../domain/repositories/order/order_repository.ts";
import { err, ok, type Result } from "../../../domain/shared/result.ts";
import {
  CustomerId,
  OrderId,
  ProductId,
} from "../../../domain/value_objects/shared/identifiers.ts";
import { Money } from "../../../domain/value_objects/shared/money.ts";
import { Quantity } from "../../../domain/value_objects/order/quantity.ts";
import type { InventoryPort, ReserveStockItem } from "../../ports/inventory/inventory_port.ts";
import type { PaymentPort } from "../../ports/payment/payment_port.ts";
import type { DomainEventPublisher } from "../../ports/events/domain_event_publisher.ts";
import type { OrderSummaryDto, PlaceOrderCommand } from "../../dtos/order/order_dto.ts";

export interface OrderUseCases {
  placeOrder(cmd: PlaceOrderCommand): Promise<Result<OrderSummaryDto, OrderError>>;
  confirmOrder(orderId: string): Promise<Result<OrderSummaryDto, OrderError>>;
  cancelOrder(orderId: string): Promise<Result<OrderSummaryDto, OrderError>>;
  getOrder(orderId: string): Promise<Result<OrderSummaryDto, OrderError>>;
}

function toDto(order: Order): Result<OrderSummaryDto, OrderError> {
  const total = order.totalAmount();
  if (!total.ok) return err(total.error);
  return ok({
    orderId: order.id.value,
    customerId: order.customerId.value,
    status: order.status,
    version: order.version,
    total: total.value,
    canConfirm: order.canConfirm(),
    canCancel: order.canCancel(),
    lines: order.lines.map((l) => ({
      productId: l.productId.value,
      quantity: l.quantity.value,
      unitPrice: l.unitPrice,
    })),
  });
}

function toReserveItems(lines: readonly OrderLine[]): readonly ReserveStockItem[] {
  return lines.map((l) => ({ productId: l.productId.value, quantity: l.quantity.value }));
}

export class OrderApplicationService implements OrderUseCases {
  private readonly orders: OrderRepository;
  private readonly inventory: InventoryPort;
  private readonly payment: PaymentPort;
  private readonly events: DomainEventPublisher;

  constructor(
    orders: OrderRepository,
    inventory: InventoryPort,
    payment: PaymentPort,
    events: DomainEventPublisher
  ) {
    this.orders = orders;
    this.inventory = inventory;
    this.payment = payment;
    this.events = events;
  }

  // @implements REQ-ORD-001
  async placeOrder(cmd: PlaceOrderCommand): Promise<Result<OrderSummaryDto, OrderError>> {
    const idRes = OrderId.create(cmd.orderId);
    if (!idRes.ok) return err(idRes.error);

    const custRes = CustomerId.create(cmd.customerId);
    if (!custRes.ok) return err(custRes.error);

    const builtLines: OrderLine[] = [];
    for (const item of cmd.lines) {
      const prodRes = ProductId.create(item.productId);
      if (!prodRes.ok) return err(prodRes.error);

      const qtyRes = Quantity.create(item.quantity);
      if (!qtyRes.ok) return err(qtyRes.error);

      const moneyRes = Money.create(item.unitAmount, item.currency);
      if (!moneyRes.ok) return err(moneyRes.error);

      builtLines.push({
        productId: prodRes.value,
        quantity: qtyRes.value,
        unitPrice: moneyRes.value,
      });
    }

    const orderRes = Order.create(idRes.value, custRes.value, builtLines);
    if (!orderRes.ok) return err(orderRes.error);

    const order = orderRes.value;
    const saveRes = await this.orders.save(order);
    if (!saveRes.ok) return err(saveRes.error);

    const publishRes = await this.events.publish(order.pullEvents());
    if (!publishRes.ok) return err(publishRes.error);

    return toDto(order);
  }

  // @implements REQ-ORD-002
  async confirmOrder(rawOrderId: string): Promise<Result<OrderSummaryDto, OrderError>> {
    const idRes = OrderId.create(rawOrderId);
    if (!idRes.ok) return err(idRes.error);

    const foundRes = await this.orders.findById(idRes.value);
    if (!foundRes.ok) return err(foundRes.error);

    const totalRes = foundRes.value.totalAmount();
    if (!totalRes.ok) return err(totalRes.error);

    const confirmedRes = foundRes.value.confirm();
    if (!confirmedRes.ok) return err(confirmedRes.error);
    const confirmed = confirmedRes.value;

    const items = toReserveItems(confirmed.lines);
    const stockRes = await this.inventory.reserveStock(confirmed.id, items);
    if (!stockRes.ok) return err(stockRes.error);

    const payRes = await this.payment.charge(confirmed.id, totalRes.value);
    if (!payRes.ok) {
      const releaseRes = await this.inventory.releaseStock(confirmed.id, items);
      if (!releaseRes.ok) return err(releaseRes.error);
      return err(payRes.error);
    }

    const saveRes = await this.orders.save(confirmed);
    if (!saveRes.ok) {
      const refundRes = await this.payment.refund(confirmed.id, totalRes.value);
      if (!refundRes.ok) return err(refundRes.error);
      return err(saveRes.error);
    }

    const publishRes = await this.events.publish(confirmed.pullEvents());
    if (!publishRes.ok) return err(publishRes.error);

    return toDto(confirmed);
  }

  // @implements REQ-ORD-003
  async cancelOrder(rawOrderId: string): Promise<Result<OrderSummaryDto, OrderError>> {
    const idRes = OrderId.create(rawOrderId);
    if (!idRes.ok) return err(idRes.error);

    const foundRes = await this.orders.findById(idRes.value);
    if (!foundRes.ok) return err(foundRes.error);

    const cancelledRes = foundRes.value.cancel();
    if (!cancelledRes.ok) return err(cancelledRes.error);
    const cancelled = cancelledRes.value;

    if (foundRes.value.status === "Confirmed") {
      const totalRes = foundRes.value.totalAmount();
      if (!totalRes.ok) return err(totalRes.error);

      const items = toReserveItems(foundRes.value.lines);
      const releaseRes = await this.inventory.releaseStock(foundRes.value.id, items);
      if (!releaseRes.ok) return err(releaseRes.error);

      const refundRes = await this.payment.refund(foundRes.value.id, totalRes.value);
      if (!refundRes.ok) return err(refundRes.error);
    }

    const saveRes = await this.orders.save(cancelled);
    if (!saveRes.ok) return err(saveRes.error);

    const publishRes = await this.events.publish(cancelled.pullEvents());
    if (!publishRes.ok) return err(publishRes.error);

    return toDto(cancelled);
  }

  async getOrder(rawOrderId: string): Promise<Result<OrderSummaryDto, OrderError>> {
    const idRes = OrderId.create(rawOrderId);
    if (!idRes.ok) return err(idRes.error);

    const foundRes = await this.orders.findById(idRes.value);
    if (!foundRes.ok) return err(foundRes.error);

    return toDto(foundRes.value);
  }
}
