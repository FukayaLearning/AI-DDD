package orderdto

import (
	domainorder "example.com/ordering-go/internal/domain/entities/order"
	"example.com/ordering-go/internal/domain/shared"
	sharedvo "example.com/ordering-go/internal/domain/value_objects/shared"
)

type PlaceOrderLineInput struct {
	ProductId  string
	Quantity   int
	UnitAmount int64
	Currency   sharedvo.Currency
}

type PlaceOrderCommand struct {
	OrderId    string
	CustomerId string
	Lines      []PlaceOrderLineInput
}

type OrderLineDto struct {
	ProductId string
	Quantity  int
	UnitPrice sharedvo.Money
}

type OrderSummaryDto struct {
	OrderId    string
	CustomerId string
	Status     domainorder.OrderStatus
	Total      sharedvo.Money
	Lines      []OrderLineDto
}

type OrderUseCases interface {
	PlaceOrder(cmd PlaceOrderCommand) shared.Result[OrderSummaryDto, shared.DomainError]
	ConfirmOrder(orderId string) shared.Result[OrderSummaryDto, shared.DomainError]
	CancelOrder(orderId string) shared.Result[OrderSummaryDto, shared.DomainError]
	GetOrder(orderId string) shared.Result[OrderSummaryDto, shared.DomainError]
}
