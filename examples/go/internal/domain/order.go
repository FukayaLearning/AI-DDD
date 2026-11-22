package domain

type OrderStatus string

const (
	StatusDraft     OrderStatus = "Draft"
	StatusConfirmed OrderStatus = "Confirmed"
	StatusCancelled OrderStatus = "Cancelled"
)

type OrderLine struct {
	ProductId ProductId
	Quantity  Quantity
	UnitPrice Money
}

type DomainEvent struct {
	Type           string
	OrderId        string
	PreviousStatus OrderStatus
	TotalAmount    *Money
}

type Order struct {
	Id         OrderId
	CustomerId CustomerId
	Lines      []OrderLine
	Status     OrderStatus
	Events     []DomainEvent
}

func CreateOrder(
	id OrderId,
	customerId CustomerId,
	lines []OrderLine,
	status OrderStatus,
	events []DomainEvent,
) Result[Order, DomainError] {
	if len(lines) == 0 {
		return Failure[Order, DomainError](NewDomainError("EMPTY_ORDER_LINES", "Order must contain at least 1 line"))
	}
	if len(lines) > 5 {
		return Failure[Order, DomainError](NewDomainError("TOO_MANY_ORDER_LINES", "Order cannot exceed 5 lines"))
	}
	seen := make(map[string]struct{}, len(lines))
	currency := lines[0].UnitPrice.Currency
	for _, line := range lines {
		if _, exists := seen[line.ProductId.Value]; exists {
			return Failure[Order, DomainError](NewDomainError("DUPLICATE_PRODUCT", "Duplicate productId"))
		}
		seen[line.ProductId.Value] = struct{}{}
		if line.UnitPrice.Currency != currency {
			return Failure[Order, DomainError](NewDomainError("CURRENCY_MISMATCH", "All order lines must share the same currency"))
		}
	}
	return Success[Order, DomainError](Order{
		Id:         id,
		CustomerId: customerId,
		Lines:      append([]OrderLine(nil), lines...),
		Status:     status,
		Events:     append([]DomainEvent(nil), events...),
	})
}

func (o Order) TotalAmount() Money {
	currency := o.Lines[0].UnitPrice.Currency
	var total int64
	for _, line := range o.Lines {
		total += MultiplyMoney(line.UnitPrice, line.Quantity).Amount
	}
	return Money{Amount: total, Currency: currency}
}

func (o Order) Confirm() Result[Order, DomainError] {
	if o.Status != StatusDraft {
		return Failure[Order, DomainError](NewDomainError("INVALID_ORDER_STATE", "Cannot confirm order in current status"))
	}
	total := o.TotalAmount()
	ev := DomainEvent{Type: "OrderConfirmedEvent", OrderId: o.Id.Value, TotalAmount: &total}
	next := o
	next.Status = StatusConfirmed
	next.Events = append(append([]DomainEvent(nil), o.Events...), ev)
	return Success[Order, DomainError](next)
}

func (o Order) Cancel() Result[Order, DomainError] {
	if o.Status == StatusCancelled {
		return Failure[Order, DomainError](NewDomainError("INVALID_ORDER_STATE", "Order is already cancelled"))
	}
	ev := DomainEvent{Type: "OrderCancelledEvent", OrderId: o.Id.Value, PreviousStatus: o.Status}
	next := o
	next.Status = StatusCancelled
	next.Events = append(append([]DomainEvent(nil), o.Events...), ev)
	return Success[Order, DomainError](next)
}
