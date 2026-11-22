package application

import "example.com/ordering-go/internal/domain"

type PlaceOrderLineInput struct {
	ProductId  string
	Quantity   int
	UnitAmount int64
	Currency   domain.Currency
}

type PlaceOrderCommand struct {
	OrderId    string
	CustomerId string
	Lines      []PlaceOrderLineInput
}

type OrderLineDto struct {
	ProductId string
	Quantity  int
	UnitPrice domain.Money
}

type OrderSummaryDto struct {
	OrderId    string
	CustomerId string
	Status     domain.OrderStatus
	Total      domain.Money
	Lines      []OrderLineDto
}

type OrderUseCases interface {
	PlaceOrder(cmd PlaceOrderCommand) domain.Result[OrderSummaryDto, domain.DomainError]
	ConfirmOrder(orderId string) domain.Result[OrderSummaryDto, domain.DomainError]
	CancelOrder(orderId string) domain.Result[OrderSummaryDto, domain.DomainError]
	GetOrder(orderId string) domain.Result[OrderSummaryDto, domain.DomainError]
}

type OrderApplicationService struct {
	orders    domain.OrderRepository
	inventory domain.InventoryPort
	payment   domain.PaymentPort
}

func NewOrderApplicationService(
	orders domain.OrderRepository,
	inventory domain.InventoryPort,
	payment domain.PaymentPort,
) *OrderApplicationService {
	return &OrderApplicationService{orders: orders, inventory: inventory, payment: payment}
}

func toDto(order domain.Order) OrderSummaryDto {
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

func (s *OrderApplicationService) PlaceOrder(cmd PlaceOrderCommand) domain.Result[OrderSummaryDto, domain.DomainError] {
	idRes := domain.CreateOrderId(cmd.OrderId)
	if !idRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*idRes.Error)
	}
	custRes := domain.CreateCustomerId(cmd.CustomerId)
	if !custRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*custRes.Error)
	}
	built := make([]domain.OrderLine, 0, len(cmd.Lines))
	for _, item := range cmd.Lines {
		pRes := domain.CreateProductId(item.ProductId)
		if !pRes.Ok {
			return domain.Failure[OrderSummaryDto, domain.DomainError](*pRes.Error)
		}
		qRes := domain.CreateQuantity(item.Quantity)
		if !qRes.Ok {
			return domain.Failure[OrderSummaryDto, domain.DomainError](*qRes.Error)
		}
		mRes := domain.CreateMoney(item.UnitAmount, item.Currency)
		if !mRes.Ok {
			return domain.Failure[OrderSummaryDto, domain.DomainError](*mRes.Error)
		}
		built = append(built, domain.OrderLine{ProductId: pRes.Value, Quantity: qRes.Value, UnitPrice: mRes.Value})
	}
	orderRes := domain.CreateOrder(idRes.Value, custRes.Value, built, domain.StatusDraft, nil)
	if !orderRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*orderRes.Error)
	}
	if saveRes := s.orders.Save(orderRes.Value); !saveRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*saveRes.Error)
	}
	return domain.Success[OrderSummaryDto, domain.DomainError](toDto(orderRes.Value))
}

func (s *OrderApplicationService) ConfirmOrder(rawOrderId string) domain.Result[OrderSummaryDto, domain.DomainError] {
	idRes := domain.CreateOrderId(rawOrderId)
	if !idRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*idRes.Error)
	}
	foundRes := s.orders.FindById(idRes.Value)
	if !foundRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*foundRes.Error)
	}
	confirmedRes := foundRes.Value.Confirm()
	if !confirmedRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*confirmedRes.Error)
	}
	if stockRes := s.inventory.ReserveStock(foundRes.Value.Id, foundRes.Value.Lines); !stockRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*stockRes.Error)
	}
	if payRes := s.payment.Charge(foundRes.Value.Id, foundRes.Value.TotalAmount()); !payRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*payRes.Error)
	}
	if saveRes := s.orders.Save(confirmedRes.Value); !saveRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*saveRes.Error)
	}
	return domain.Success[OrderSummaryDto, domain.DomainError](toDto(confirmedRes.Value))
}

func (s *OrderApplicationService) CancelOrder(rawOrderId string) domain.Result[OrderSummaryDto, domain.DomainError] {
	idRes := domain.CreateOrderId(rawOrderId)
	if !idRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*idRes.Error)
	}
	foundRes := s.orders.FindById(idRes.Value)
	if !foundRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*foundRes.Error)
	}
	cancelledRes := foundRes.Value.Cancel()
	if !cancelledRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*cancelledRes.Error)
	}
	if saveRes := s.orders.Save(cancelledRes.Value); !saveRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*saveRes.Error)
	}
	return domain.Success[OrderSummaryDto, domain.DomainError](toDto(cancelledRes.Value))
}

func (s *OrderApplicationService) GetOrder(rawOrderId string) domain.Result[OrderSummaryDto, domain.DomainError] {
	idRes := domain.CreateOrderId(rawOrderId)
	if !idRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*idRes.Error)
	}
	foundRes := s.orders.FindById(idRes.Value)
	if !foundRes.Ok {
		return domain.Failure[OrderSummaryDto, domain.DomainError](*foundRes.Error)
	}
	return domain.Success[OrderSummaryDto, domain.DomainError](toDto(foundRes.Value))
}
