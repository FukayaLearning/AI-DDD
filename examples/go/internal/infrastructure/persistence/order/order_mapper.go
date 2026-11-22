package order

import (
	domainorder "example.com/ordering-go/internal/domain/order"
	"example.com/ordering-go/internal/domain/shared"
)

type OrderLineRecord struct {
	ProductId  string          `json:"productId"`
	Quantity   int             `json:"quantity"`
	UnitAmount int64           `json:"unitAmount"`
	Currency   shared.Currency `json:"currency"`
}

type OrderEventRecord struct {
	Type           string             `json:"type"`
	OrderId        string             `json:"orderId"`
	PreviousStatus domainorder.OrderStatus `json:"previousStatus,omitempty"`
	TotalAmount    *shared.Money      `json:"totalAmount,omitempty"`
}

type OrderRecord struct {
	Id         string             `json:"id"`
	CustomerId string             `json:"customerId"`
	Status     domainorder.OrderStatus `json:"status"`
	Lines      []OrderLineRecord  `json:"lines"`
	Events     []OrderEventRecord `json:"events"`
}

func ToOrderRecord(order domainorder.Order) OrderRecord {
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

func FromOrderRecord(rec OrderRecord) shared.Result[domainorder.Order, shared.DomainError] {
	idRes := shared.CreateOrderId(rec.Id)
	if !idRes.Ok {
		return shared.Failure[domainorder.Order, shared.DomainError](shared.NewDomainError("REPOSITORY_ERROR", idRes.Error.Message))
	}
	custRes := shared.CreateCustomerId(rec.CustomerId)
	if !custRes.Ok {
		return shared.Failure[domainorder.Order, shared.DomainError](shared.NewDomainError("REPOSITORY_ERROR", custRes.Error.Message))
	}
	lines := make([]domainorder.OrderLine, 0, len(rec.Lines))
	for _, item := range rec.Lines {
		pRes := shared.CreateProductId(item.ProductId)
		if !pRes.Ok {
			return shared.Failure[domainorder.Order, shared.DomainError](shared.NewDomainError("REPOSITORY_ERROR", pRes.Error.Message))
		}
		qRes := shared.CreateQuantity(item.Quantity)
		if !qRes.Ok {
			return shared.Failure[domainorder.Order, shared.DomainError](shared.NewDomainError("REPOSITORY_ERROR", qRes.Error.Message))
		}
		mRes := shared.CreateMoney(item.UnitAmount, item.Currency)
		if !mRes.Ok {
			return shared.Failure[domainorder.Order, shared.DomainError](shared.NewDomainError("REPOSITORY_ERROR", mRes.Error.Message))
		}
		lines = append(lines, domainorder.OrderLine{ProductId: pRes.Value, Quantity: qRes.Value, UnitPrice: mRes.Value})
	}
	events := make([]domainorder.DomainEvent, len(rec.Events))
	for i, ev := range rec.Events {
		events[i] = domainorder.DomainEvent{
			Type:           ev.Type,
			OrderId:        ev.OrderId,
			PreviousStatus: ev.PreviousStatus,
			TotalAmount:    ev.TotalAmount,
		}
	}
	orderRes := domainorder.CreateOrder(idRes.Value, custRes.Value, lines, rec.Status, events)
	if !orderRes.Ok {
		return shared.Failure[domainorder.Order, shared.DomainError](shared.NewDomainError("REPOSITORY_ERROR", orderRes.Error.Message))
	}
	return orderRes
}
