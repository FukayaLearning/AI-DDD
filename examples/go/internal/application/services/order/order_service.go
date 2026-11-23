package ordersvc

import (
	orderdto "example.com/ordering-go/internal/application/dtos/order"
	inventoryport "example.com/ordering-go/internal/application/ports/inventory"
	paymentport "example.com/ordering-go/internal/application/ports/payment"
	domainorder "example.com/ordering-go/internal/domain/entities/order"
	orderrepo "example.com/ordering-go/internal/domain/repositories/order"
	"example.com/ordering-go/internal/domain/shared"
	ordervo "example.com/ordering-go/internal/domain/value_objects/order"
	sharedvo "example.com/ordering-go/internal/domain/value_objects/shared"
)

type OrderApplicationService struct {
	orders    orderrepo.OrderRepository
	inventory inventoryport.InventoryPort
	payment   paymentport.PaymentPort
}

func NewOrderApplicationService(
	orders orderrepo.OrderRepository,
	inventory inventoryport.InventoryPort,
	payment paymentport.PaymentPort,
) *OrderApplicationService {
	return &OrderApplicationService{orders: orders, inventory: inventory, payment: payment}
}

func toDto(order domainorder.Order) orderdto.OrderSummaryDto {
	lines := make([]orderdto.OrderLineDto, len(order.Lines))
	for i, l := range order.Lines {
		lines[i] = orderdto.OrderLineDto{ProductId: l.ProductId.Value, Quantity: l.Quantity.Value, UnitPrice: l.UnitPrice}
	}
	return orderdto.OrderSummaryDto{
		OrderId:    order.Id.Value,
		CustomerId: order.CustomerId.Value,
		Status:     order.Status,
		Total:      order.TotalAmount(),
		Lines:      lines,
	}
}

// @implements REQ-ORD-001
func (s *OrderApplicationService) PlaceOrder(cmd orderdto.PlaceOrderCommand) shared.Result[orderdto.OrderSummaryDto, shared.DomainError] {
	idRes := sharedvo.CreateOrderId(cmd.OrderId)
	if !idRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*idRes.Error)
	}
	custRes := sharedvo.CreateCustomerId(cmd.CustomerId)
	if !custRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*custRes.Error)
	}
	built := make([]domainorder.OrderLine, 0, len(cmd.Lines))
	for _, item := range cmd.Lines {
		pRes := sharedvo.CreateProductId(item.ProductId)
		if !pRes.Ok {
			return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*pRes.Error)
		}
		qRes := ordervo.CreateQuantity(item.Quantity)
		if !qRes.Ok {
			return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*qRes.Error)
		}
		mRes := sharedvo.CreateMoney(item.UnitAmount, item.Currency)
		if !mRes.Ok {
			return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*mRes.Error)
		}
		built = append(built, domainorder.OrderLine{ProductId: pRes.Value, Quantity: qRes.Value, UnitPrice: mRes.Value})
	}
	orderRes := domainorder.CreateOrder(idRes.Value, custRes.Value, built, domainorder.StatusDraft, nil)
	if !orderRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*orderRes.Error)
	}
	if saveRes := s.orders.Save(orderRes.Value); !saveRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*saveRes.Error)
	}
	return shared.Success[orderdto.OrderSummaryDto, shared.DomainError](toDto(orderRes.Value))
}

// @implements REQ-ORD-002
func (s *OrderApplicationService) ConfirmOrder(rawOrderId string) shared.Result[orderdto.OrderSummaryDto, shared.DomainError] {
	idRes := sharedvo.CreateOrderId(rawOrderId)
	if !idRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*idRes.Error)
	}
	foundRes := s.orders.FindById(idRes.Value)
	if !foundRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*foundRes.Error)
	}
	confirmedRes := foundRes.Value.Confirm()
	if !confirmedRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*confirmedRes.Error)
	}
	if stockRes := s.inventory.ReserveStock(foundRes.Value.Id, foundRes.Value.Lines); !stockRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*stockRes.Error)
	}
	if payRes := s.payment.Charge(foundRes.Value.Id, foundRes.Value.TotalAmount()); !payRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*payRes.Error)
	}
	if saveRes := s.orders.Save(confirmedRes.Value); !saveRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*saveRes.Error)
	}
	return shared.Success[orderdto.OrderSummaryDto, shared.DomainError](toDto(confirmedRes.Value))
}

// @implements REQ-ORD-003
func (s *OrderApplicationService) CancelOrder(rawOrderId string) shared.Result[orderdto.OrderSummaryDto, shared.DomainError] {
	idRes := sharedvo.CreateOrderId(rawOrderId)
	if !idRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*idRes.Error)
	}
	foundRes := s.orders.FindById(idRes.Value)
	if !foundRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*foundRes.Error)
	}
	cancelledRes := foundRes.Value.Cancel()
	if !cancelledRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*cancelledRes.Error)
	}
	if saveRes := s.orders.Save(cancelledRes.Value); !saveRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*saveRes.Error)
	}
	return shared.Success[orderdto.OrderSummaryDto, shared.DomainError](toDto(cancelledRes.Value))
}

func (s *OrderApplicationService) GetOrder(rawOrderId string) shared.Result[orderdto.OrderSummaryDto, shared.DomainError] {
	idRes := sharedvo.CreateOrderId(rawOrderId)
	if !idRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*idRes.Error)
	}
	foundRes := s.orders.FindById(idRes.Value)
	if !foundRes.Ok {
		return shared.Failure[orderdto.OrderSummaryDto, shared.DomainError](*foundRes.Error)
	}
	return shared.Success[orderdto.OrderSummaryDto, shared.DomainError](toDto(foundRes.Value))
}
