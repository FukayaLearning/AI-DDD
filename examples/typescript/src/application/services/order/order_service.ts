import type { DomainError } from "../../../domain/shared/errors.ts";
import { Order, type OrderLine } from "../../../domain/entities/order/order.ts";
import type { OrderRepository } from "../../../domain/repositories/order/order_repository.ts";
import { err, ok, type Result } from "../../../domain/shared/result.ts";
import {
  createCustomerId,
  createOrderId,
  createProductId,
} from "../../../domain/value_objects/shared/identifiers.ts";
import { createMoney, type Money } from "../../../domain/value_objects/shared/money.ts";
import { createQuantity } from "../../../domain/value_objects/order/quantity.ts";
import type { InventoryPort } from "../../ports/inventory/inventory_port.ts";
import type { PaymentPort } from "../../ports/payment/payment_port.ts";
import type { OrderSummaryDto, PlaceOrderCommand } from "../../dtos/order/order_dto.ts";

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
