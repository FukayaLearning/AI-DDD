package repository

import "example.com/ordering-go/internal/domain"

type OrderLineRecord struct {
	ProductId  string          `json:"productId"`
	Quantity   int             `json:"quantity"`
	UnitAmount int64           `json:"unitAmount"`
	Currency   domain.Currency `json:"currency"`
}

type OrderEventRecord struct {
	Type           string             `json:"type"`
	OrderId        string             `json:"orderId"`
	PreviousStatus domain.OrderStatus `json:"previousStatus,omitempty"`
	TotalAmount    *domain.Money      `json:"totalAmount,omitempty"`
}

type OrderRecord struct {
	Id         string             `json:"id"`
	CustomerId string             `json:"customerId"`
	Status     domain.OrderStatus `json:"status"`
	Lines      []OrderLineRecord  `json:"lines"`
	Events     []OrderEventRecord `json:"events"`
}

func ToOrderRecord(order domain.Order) OrderRecord {
	lines := make([]OrderLineRecord, len(order.Lines))
	for i, l := range order.Lines {
		lines[i] = OrderLineRecord{
			ProductId:  l.ProductId.Value,
			Quantity:   l.Quantity.Value,
			UnitAmount: l.UnitPrice.Amount,
			Currency:   l.UnitPrice.Currency,
		}
	}
	events := make([]OrderEventRecord, len(order.Events))
	for i, e := range order.Events {
		events[i] = OrderEventRecord{
			Type:           e.Type,
			OrderId:        e.OrderId,
			PreviousStatus: e.PreviousStatus,
			TotalAmount:    e.TotalAmount,
		}
	}
	return OrderRecord{
		Id:         order.Id.Value,
		CustomerId: order.CustomerId.Value,
		Status:     order.Status,
		Lines:      lines,
		Events:     events,
	}
}

func FromOrderRecord(rec OrderRecord) domain.Result[domain.Order, domain.DomainError] {
	idRes := domain.CreateOrderId(rec.Id)
	if !idRes.Ok {
		return domain.Failure[domain.Order, domain.DomainError](domain.NewDomainError("REPOSITORY_ERROR", idRes.Error.Message))
	}
	custRes := domain.CreateCustomerId(rec.CustomerId)
	if !custRes.Ok {
		return domain.Failure[domain.Order, domain.DomainError](domain.NewDomainError("REPOSITORY_ERROR", custRes.Error.Message))
	}
	lines := make([]domain.OrderLine, 0, len(rec.Lines))
	for _, item := range rec.Lines {
		pRes := domain.CreateProductId(item.ProductId)
		if !pRes.Ok {
			return domain.Failure[domain.Order, domain.DomainError](domain.NewDomainError("REPOSITORY_ERROR", pRes.Error.Message))
		}
		qRes := domain.CreateQuantity(item.Quantity)
		if !qRes.Ok {
			return domain.Failure[domain.Order, domain.DomainError](domain.NewDomainError("REPOSITORY_ERROR", qRes.Error.Message))
		}
		mRes := domain.CreateMoney(item.UnitAmount, item.Currency)
		if !mRes.Ok {
			return domain.Failure[domain.Order, domain.DomainError](domain.NewDomainError("REPOSITORY_ERROR", mRes.Error.Message))
		}
		lines = append(lines, domain.OrderLine{ProductId: pRes.Value, Quantity: qRes.Value, UnitPrice: mRes.Value})
	}
	events := make([]domain.DomainEvent, len(rec.Events))
	for i, ev := range rec.Events {
		events[i] = domain.DomainEvent{
			Type:           ev.Type,
			OrderId:        ev.OrderId,
			PreviousStatus: ev.PreviousStatus,
			TotalAmount:    ev.TotalAmount,
		}
	}
	orderRes := domain.CreateOrder(idRes.Value, custRes.Value, lines, rec.Status, events)
	if !orderRes.Ok {
		return domain.Failure[domain.Order, domain.DomainError](domain.NewDomainError("REPOSITORY_ERROR", orderRes.Error.Message))
	}
	return orderRes
}
