package shared

import (
	"example.com/ordering-go/internal/domain/order"
	domainshared "example.com/ordering-go/internal/domain/shared"
)

type InventoryPort interface {
	ReserveStock(orderId domainshared.OrderId, lines []order.OrderLine) domainshared.Result[struct{}, domainshared.DomainError]
}

type PaymentPort interface {
	Charge(orderId domainshared.OrderId, amount domainshared.Money) domainshared.Result[struct{}, domainshared.DomainError]
}
