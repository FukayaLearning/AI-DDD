package inventoryport

import (
	"example.com/ordering-go/internal/domain/entities/order"
	"example.com/ordering-go/internal/domain/shared"
	sharedvo "example.com/ordering-go/internal/domain/value_objects/shared"
)

type InventoryPort interface {
	ReserveStock(orderId sharedvo.OrderId, lines []order.OrderLine) shared.Result[struct{}, shared.DomainError]
}
