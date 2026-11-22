package commands

import (
	appshared "example.com/ordering-go/internal/application/shared"
	domainorder "example.com/ordering-go/internal/domain/order"
	"example.com/ordering-go/internal/domain/shared"
)

type PlaceOrderLineInput struct {
	ProductId  string
	Quantity   int
	UnitAmount int64
	Currency   shared.Currency
}

type PlaceOrderCommand struct {
	OrderId    string
	CustomerId string
	Lines      []PlaceOrderLineInput
}

type OrderLineDto struct {
	ProductId string
	Quantity  int
	UnitPrice shared.Money
}

type OrderSummaryDto struct {
	OrderId    string
	CustomerId string
	Status     domainorder.OrderStatus
	Total      shared.Money
	Lines      []OrderLineDto
}

type OrderUseCases interface {
	PlaceOrder(cmd PlaceOrderCommand) shared.Result[OrderSummaryDto, shared.DomainError]
	ConfirmOrder(orderId string) shared.Result[OrderSummaryDto, shared.DomainError]
	CancelOrder(orderId string) shared.Result[OrderSummaryDto, shared.DomainError]
	GetOrder(orderId string) shared.Result[OrderSummaryDto, shared.DomainError]
}

type OrderApplicationService struct {
	orders    domainorder.OrderRepository
	inventory appshared.InventoryPort
	payment   appshared.PaymentPort
}

func NewOrderApplicationService(
	orders domainorder.OrderRepository,
	inventory appshared.InventoryPort,
	payment appshared.PaymentPort,
) *OrderApplicationService {
	return &OrderApplicationService{orders: orders, inventory: inventory, payment: payment}
}

func toDto(order domainorder.Order) OrderSummaryDto {
	lines := make([]OrderLineDto, len(order.Lines))
	for i, l := range order.Lines {
		lines[i] = OrderLineDto{ProductId: l.ProductId.Value, Quantity: l.Quantity.Value, UnitPrice: l.UnitPrice}
	}
	return OrderSummaryDto{
		OrderId:    order.Id.Value,
		CustomerId: order.CustomerId.Value,
		Status:     order.Status,
		Total:      order.TotalAmount(),
		Lines:      lines,
	}
}

// @implements REQ-ORD-001
func (s *OrderApplicationService) PlaceOrder(cmd PlaceOrderCommand) shared.Result[OrderSummaryDto, shared.DomainError] {
	idRes := shared.CreateOrderId(cmd.OrderId)
	if !idRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*idRes.Error)
	}
	custRes := shared.CreateCustomerId(cmd.CustomerId)
	if !custRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*custRes.Error)
	}
	built := make([]domainorder.OrderLine, 0, len(cmd.Lines))
	for _, item := range cmd.Lines {
		pRes := shared.CreateProductId(item.ProductId)
		if !pRes.Ok {
			return shared.Failure[OrderSummaryDto, shared.DomainError](*pRes.Error)
		}
		qRes := shared.CreateQuantity(item.Quantity)
		if !qRes.Ok {
			return shared.Failure[OrderSummaryDto, shared.DomainError](*qRes.Error)
		}
		mRes := shared.CreateMoney(item.UnitAmount, item.Currency)
		if !mRes.Ok {
			return shared.Failure[OrderSummaryDto, shared.DomainError](*mRes.Error)
		}
		built = append(built, domainorder.OrderLine{ProductId: pRes.Value, Quantity: qRes.Value, UnitPrice: mRes.Value})
	}
	orderRes := domainorder.CreateOrder(idRes.Value, custRes.Value, built, domainorder.StatusDraft, nil)
	if !orderRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*orderRes.Error)
	}
	if saveRes := s.orders.Save(orderRes.Value); !saveRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*saveRes.Error)
	}
	return shared.Success[OrderSummaryDto, shared.DomainError](toDto(orderRes.Value))
}

// @implements REQ-ORD-002
func (s *OrderApplicationService) ConfirmOrder(rawOrderId string) shared.Result[OrderSummaryDto, shared.DomainError] {
	idRes := shared.CreateOrderId(rawOrderId)
	if !idRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*idRes.Error)
	}
	foundRes := s.orders.FindById(idRes.Value)
	if !foundRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*foundRes.Error)
	}
	confirmedRes := foundRes.Value.Confirm()
	if !confirmedRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*confirmedRes.Error)
	}
	if stockRes := s.inventory.ReserveStock(foundRes.Value.Id, foundRes.Value.Lines); !stockRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*stockRes.Error)
	}
	if payRes := s.payment.Charge(foundRes.Value.Id, foundRes.Value.TotalAmount()); !payRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*payRes.Error)
	}
	if saveRes := s.orders.Save(confirmedRes.Value); !saveRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*saveRes.Error)
	}
	return shared.Success[OrderSummaryDto, shared.DomainError](toDto(confirmedRes.Value))
}

// @implements REQ-ORD-003
func (s *OrderApplicationService) CancelOrder(rawOrderId string) shared.Result[OrderSummaryDto, shared.DomainError] {
	idRes := shared.CreateOrderId(rawOrderId)
	if !idRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*idRes.Error)
	}
	foundRes := s.orders.FindById(idRes.Value)
	if !foundRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*foundRes.Error)
	}
	cancelledRes := foundRes.Value.Cancel()
	if !cancelledRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*cancelledRes.Error)
	}
	if saveRes := s.orders.Save(cancelledRes.Value); !saveRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*saveRes.Error)
	}
	return shared.Success[OrderSummaryDto, shared.DomainError](toDto(cancelledRes.Value))
}

func (s *OrderApplicationService) GetOrder(rawOrderId string) shared.Result[OrderSummaryDto, shared.DomainError] {
	idRes := shared.CreateOrderId(rawOrderId)
	if !idRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*idRes.Error)
	}
	foundRes := s.orders.FindById(idRes.Value)
	if !foundRes.Ok {
		return shared.Failure[OrderSummaryDto, shared.DomainError](*foundRes.Error)
	}
	return shared.Success[OrderSummaryDto, shared.DomainError](toDto(foundRes.Value))
}
