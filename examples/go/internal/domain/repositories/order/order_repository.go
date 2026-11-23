package orderrepo

import (
	"example.com/ordering-go/internal/domain/entities/order"
	"example.com/ordering-go/internal/domain/shared"
	sharedvo "example.com/ordering-go/internal/domain/value_objects/shared"
)

type OrderRepository interface {
	Save(order order.Order) shared.Result[struct{}, shared.DomainError]
	FindById(orderId sharedvo.OrderId) shared.Result[order.Order, shared.DomainError]
}
