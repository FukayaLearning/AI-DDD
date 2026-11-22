package order

import "example.com/ordering-go/internal/domain/shared"

type OrderStatus string

const (
	StatusDraft     OrderStatus = "Draft"
	StatusConfirmed OrderStatus = "Confirmed"
	StatusCancelled OrderStatus = "Cancelled"
)

type OrderLine struct {
	ProductId shared.ProductId
	Quantity  shared.Quantity
	UnitPrice shared.Money
}

type DomainEvent struct {
	Type           string
	OrderId        string
	PreviousStatus OrderStatus
	TotalAmount    *shared.Money
}

type Order struct {
	Id         shared.OrderId
	CustomerId shared.CustomerId
	Lines      []OrderLine
	Status     OrderStatus
	Events     []DomainEvent
}

func CreateOrder(
	id shared.OrderId,
	customerId shared.CustomerId,
	lines []OrderLine,
	status OrderStatus,
	events []DomainEvent,
) shared.Result[Order, shared.DomainError] {
	if len(lines) == 0 {
		return shared.Failure[Order, shared.DomainError](shared.NewDomainError("EMPTY_ORDER_LINES", "Order must contain at least 1 line"))
	}
	if len(lines) > 5 {
		return shared.Failure[Order, shared.DomainError](shared.NewDomainError("TOO_MANY_ORDER_LINES", "Order cannot exceed 5 lines"))
	}
	seen := make(map[string]struct{}, len(lines))
	currency := lines[0].UnitPrice.Currency
	for _, line := range lines {
		if _, exists := seen[line.ProductId.Value]; exists {
			return shared.Failure[Order, shared.DomainError](shared.NewDomainError("DUPLICATE_PRODUCT", "Duplicate productId"))
		}
		seen[line.ProductId.Value] = struct{}{}
		if line.UnitPrice.Currency != currency {
			return shared.Failure[Order, shared.DomainError](shared.NewDomainError("CURRENCY_MISMATCH", "All order lines must share the same currency"))
		}
	}
	return shared.Success[Order, shared.DomainError](Order{
		Id:         id,
		CustomerId: customerId,
		Lines:      append([]OrderLine(nil), lines...),
		Status:     status,
		Events:     append([]DomainEvent(nil), events...),
	})
}

func (o Order) TotalAmount() shared.Money {
	currency := o.Lines[0].UnitPrice.Currency
	var total int64
	for _, line := range o.Lines {
		total += shared.MultiplyMoney(line.UnitPrice, line.Quantity).Amount
	}
	return shared.Money{Amount: total, Currency: currency}
}

func (o Order) Confirm() shared.Result[Order, shared.DomainError] {
	if o.Status != StatusDraft {
		return shared.Failure[Order, shared.DomainError](shared.NewDomainError("INVALID_ORDER_STATE", "Cannot confirm order in current status"))
	}
	total := o.TotalAmount()
	ev := DomainEvent{Type: "OrderConfirmedEvent", OrderId: o.Id.Value, TotalAmount: &total}
	next := o
	next.Status = StatusConfirmed
	next.Events = append(append([]DomainEvent(nil), o.Events...), ev)
	return shared.Success[Order, shared.DomainError](next)
}

func (o Order) Cancel() shared.Result[Order, shared.DomainError] {
	if o.Status == StatusCancelled {
		return shared.Failure[Order, shared.DomainError](shared.NewDomainError("INVALID_ORDER_STATE", "Order is already cancelled"))
	}
	ev := DomainEvent{Type: "OrderCancelledEvent", OrderId: o.Id.Value, PreviousStatus: o.Status}
	next := o
	next.Status = StatusCancelled
	next.Events = append(append([]DomainEvent(nil), o.Events...), ev)
	return shared.Success[Order, shared.DomainError](next)
}
