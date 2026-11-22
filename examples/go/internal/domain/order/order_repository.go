package order

import "example.com/ordering-go/internal/domain/shared"

type OrderRepository interface {
	Save(order Order) shared.Result[struct{}, shared.DomainError]
	FindById(orderId shared.OrderId) shared.Result[Order, shared.DomainError]
}
