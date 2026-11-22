package domain

type OrderRepository interface {
	Save(order Order) Result[struct{}, DomainError]
	FindById(orderId OrderId) Result[Order, DomainError]
}

type InventoryPort interface {
	ReserveStock(orderId OrderId, lines []OrderLine) Result[struct{}, DomainError]
}

type PaymentPort interface {
	Charge(orderId OrderId, amount Money) Result[struct{}, DomainError]
}
