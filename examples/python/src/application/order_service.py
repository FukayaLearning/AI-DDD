from dataclasses import dataclass
from typing import Protocol
from src.domain.errors import DomainError
from src.domain.order import Order, OrderLine, OrderStatus
from src.domain.ports import InventoryPort, OrderRepository, PaymentPort
from src.domain.result import Err, Ok, Result
from src.domain.value_objects import (
    Currency,
    Money,
    create_customer_id,
    create_money,
    create_order_id,
    create_product_id,
    create_quantity,
)


@dataclass(frozen=True)
class PlaceOrderLineInput:
    product_id: str
    quantity: int
    unit_amount: int
    currency: Currency


@dataclass(frozen=True)
class PlaceOrderCommand:
    order_id: str
    customer_id: str
    lines: tuple[PlaceOrderLineInput, ...]


@dataclass(frozen=True)
class OrderLineDto:
    product_id: str
    quantity: int
    unit_price: Money


@dataclass(frozen=True)
class OrderSummaryDto:
    order_id: str
    customer_id: str
    status: OrderStatus
    total: Money
    lines: tuple[OrderLineDto, ...]


class OrderUseCases(Protocol):
    def place_order(self, cmd: PlaceOrderCommand) -> Result[OrderSummaryDto, DomainError]: ...
    def confirm_order(self, order_id: str) -> Result[OrderSummaryDto, DomainError]: ...
    def cancel_order(self, order_id: str) -> Result[OrderSummaryDto, DomainError]: ...
    def get_order(self, order_id: str) -> Result[OrderSummaryDto, DomainError]: ...


def _to_dto(order: Order) -> OrderSummaryDto:
    return OrderSummaryDto(
        order_id=order.id.value,
        customer_id=order.customer_id.value,
        status=order.status,
        total=order.total_amount(),
        lines=tuple(
            OrderLineDto(
                product_id=line.product_id.value,
                quantity=line.quantity.value,
                unit_price=line.unit_price,
            )
            for line in order.lines
        ),
    )


class OrderApplicationService:
    def __init__(self, orders: OrderRepository, inventory: InventoryPort, payment: PaymentPort) -> None:
        self._orders = orders
        self._inventory = inventory
        self._payment = payment

    def place_order(self, cmd: PlaceOrderCommand) -> Result[OrderSummaryDto, DomainError]:
        id_res = create_order_id(cmd.order_id)
        if isinstance(id_res, Err):
            return id_res

        cust_res = create_customer_id(cmd.customer_id)
        if isinstance(cust_res, Err):
            return cust_res

        built_lines: list[OrderLine] = []
        for item in cmd.lines:
            prod_res = create_product_id(item.product_id)
            if isinstance(prod_res, Err):
                return prod_res
            qty_res = create_quantity(item.quantity)
            if isinstance(qty_res, Err):
                return qty_res
            money_res = create_money(item.unit_amount, item.currency)
            if isinstance(money_res, Err):
                return money_res
            built_lines.append(OrderLine(prod_res.value, qty_res.value, money_res.value))

        order_res = Order.create(id_res.value, cust_res.value, tuple(built_lines))
        if isinstance(order_res, Err):
            return order_res

        save_res = self._orders.save(order_res.value)
        if isinstance(save_res, Err):
            return save_res

        return Ok(_to_dto(order_res.value))

    def confirm_order(self, raw_order_id: str) -> Result[OrderSummaryDto, DomainError]:
        id_res = create_order_id(raw_order_id)
        if isinstance(id_res, Err):
            return id_res

        found_res = self._orders.find_by_id(id_res.value)
        if isinstance(found_res, Err):
            return found_res

        order = found_res.value
        confirmed_res = order.confirm()
        if isinstance(confirmed_res, Err):
            return confirmed_res

        stock_res = self._inventory.reserve_stock(order.id, order.lines)
        if isinstance(stock_res, Err):
            return stock_res

        pay_res = self._payment.charge(order.id, order.total_amount())
        if isinstance(pay_res, Err):
            return pay_res

        save_res = self._orders.save(confirmed_res.value)
        if isinstance(save_res, Err):
            return save_res

        return Ok(_to_dto(confirmed_res.value))

    def cancel_order(self, raw_order_id: str) -> Result[OrderSummaryDto, DomainError]:
        id_res = create_order_id(raw_order_id)
        if isinstance(id_res, Err):
            return id_res

        found_res = self._orders.find_by_id(id_res.value)
        if isinstance(found_res, Err):
            return found_res

        cancelled_res = found_res.value.cancel()
        if isinstance(cancelled_res, Err):
            return cancelled_res

        save_res = self._orders.save(cancelled_res.value)
        if isinstance(save_res, Err):
            return save_res

        return Ok(_to_dto(cancelled_res.value))

    def get_order(self, raw_order_id: str) -> Result[OrderSummaryDto, DomainError]:
        id_res = create_order_id(raw_order_id)
        if isinstance(id_res, Err):
            return id_res

        found_res = self._orders.find_by_id(id_res.value)
        if isinstance(found_res, Err):
            return found_res

        return Ok(_to_dto(found_res.value))
