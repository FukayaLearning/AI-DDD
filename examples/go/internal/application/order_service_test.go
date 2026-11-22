package application_test

import (
	"testing"
	"example.com/ordering-go/internal/application"
	"example.com/ordering-go/internal/domain"
)

type memRepo struct {
	data     map[string]domain.Order
	failSave bool
}

func (m *memRepo) Save(o domain.Order) domain.Result[struct{}, domain.DomainError] {
	if m.failSave {
		return domain.Failure[struct{}, domain.DomainError](domain.NewDomainError("REPOSITORY_ERROR", "db down"))
	}
	m.data[o.Id.Value] = o
	return domain.Success[struct{}, domain.DomainError](struct{}{})
}

func (m *memRepo) FindById(id domain.OrderId) domain.Result[domain.Order, domain.DomainError] {
	if o, ok := m.data[id.Value]; ok {
		return domain.Success[domain.Order, domain.DomainError](o)
	}
	return domain.Failure[domain.Order, domain.DomainError](domain.NewDomainError("ORDER_NOT_FOUND", "missing"))
}

type stubInv struct{ err *domain.DomainError }

func (s stubInv) ReserveStock(domain.OrderId, []domain.OrderLine) domain.Result[struct{}, domain.DomainError] {
	if s.err != nil {
		return domain.Failure[struct{}, domain.DomainError](*s.err)
	}
	return domain.Success[struct{}, domain.DomainError](struct{}{})
}

type stubPay struct{ err *domain.DomainError }

func (s stubPay) Charge(domain.OrderId, domain.Money) domain.Result[struct{}, domain.DomainError] {
	if s.err != nil {
		return domain.Failure[struct{}, domain.DomainError](*s.err)
	}
	return domain.Success[struct{}, domain.DomainError](struct{}{})
}

func TestOrderApplicationScenarios(t *testing.T) {
	repo := &memRepo{data: map[string]domain.Order{}}
	svc := application.NewOrderApplicationService(repo, stubInv{}, stubPay{})

	if svc.PlaceOrder(application.PlaceOrderCommand{OrderId: "", CustomerId: "C1"}).Error.Code != "INVALID_ORDER_ID" {
		t.Fatalf("expected INVALID_ORDER_ID")
	}
	if svc.PlaceOrder(application.PlaceOrderCommand{OrderId: "O1", CustomerId: ""}).Error.Code != "INVALID_CUSTOMER_ID" {
		t.Fatalf("expected INVALID_CUSTOMER_ID")
	}
	if svc.PlaceOrder(application.PlaceOrderCommand{OrderId: "O1", CustomerId: "C1", Lines: []application.PlaceOrderLineInput{{ProductId: "", Quantity: 1, UnitAmount: 10, Currency: domain.CurrencyJPY}}}).Error.Code != "INVALID_PRODUCT_ID" {
		t.Fatalf("expected INVALID_PRODUCT_ID")
	}
	if svc.PlaceOrder(application.PlaceOrderCommand{OrderId: "O1", CustomerId: "C1", Lines: []application.PlaceOrderLineInput{{ProductId: "P1", Quantity: 0, UnitAmount: 10, Currency: domain.CurrencyJPY}}}).Error.Code != "INVALID_QUANTITY" {
		t.Fatalf("expected INVALID_QUANTITY")
	}
	if svc.PlaceOrder(application.PlaceOrderCommand{OrderId: "O1", CustomerId: "C1", Lines: []application.PlaceOrderLineInput{{ProductId: "P1", Quantity: 1, UnitAmount: -1, Currency: domain.CurrencyJPY}}}).Error.Code != "INVALID_MONEY_AMOUNT" {
		t.Fatalf("expected INVALID_MONEY_AMOUNT")
	}
	if svc.PlaceOrder(application.PlaceOrderCommand{OrderId: "O1", CustomerId: "C1"}).Error.Code != "EMPTY_ORDER_LINES" {
		t.Fatalf("expected EMPTY_ORDER_LINES")
	}

	repo.failSave = true
	if svc.PlaceOrder(application.PlaceOrderCommand{OrderId: "ORD-1", CustomerId: "C1", Lines: []application.PlaceOrderLineInput{{ProductId: "P1", Quantity: 1, UnitAmount: 100, Currency: domain.CurrencyJPY}}}).Error.Code != "REPOSITORY_ERROR" {
		t.Fatalf("expected REPOSITORY_ERROR")
	}
	repo.failSave = false

	if res := svc.PlaceOrder(application.PlaceOrderCommand{OrderId: "ORD-1", CustomerId: "C1", Lines: []application.PlaceOrderLineInput{{ProductId: "P1", Quantity: 2, UnitAmount: 500, Currency: domain.CurrencyJPY}}}); !res.Ok {
		t.Fatalf("expected place ok")
	}

	if svc.GetOrder("").Error.Code != "INVALID_ORDER_ID" || svc.GetOrder("MISS").Error.Code != "ORDER_NOT_FOUND" || !svc.GetOrder("ORD-1").Ok {
		t.Fatalf("getOrder branches failed")
	}

	if svc.ConfirmOrder("").Error.Code != "INVALID_ORDER_ID" || svc.ConfirmOrder("MISS").Error.Code != "ORDER_NOT_FOUND" {
		t.Fatalf("confirmOrder lookup branches failed")
	}
	stockErr := domain.NewDomainError("INSUFFICIENT_STOCK", "short")
	if application.NewOrderApplicationService(repo, stubInv{err: &stockErr}, stubPay{}).ConfirmOrder("ORD-1").Error.Code != "INSUFFICIENT_STOCK" {
		t.Fatalf("expected INSUFFICIENT_STOCK")
	}
	payErr := domain.NewDomainError("PAYMENT_DECLINED", "declined")
	if application.NewOrderApplicationService(repo, stubInv{}, stubPay{err: &payErr}).ConfirmOrder("ORD-1").Error.Code != "PAYMENT_DECLINED" {
		t.Fatalf("expected PAYMENT_DECLINED")
	}
	repo.failSave = true
	if svc.ConfirmOrder("ORD-1").Error.Code != "REPOSITORY_ERROR" {
		t.Fatalf("expected confirm REPOSITORY_ERROR")
	}
	repo.failSave = false
	if !svc.ConfirmOrder("ORD-1").Ok || svc.ConfirmOrder("ORD-1").Error.Code != "INVALID_ORDER_STATE" {
		t.Fatalf("confirm transition branches failed")
	}

	if svc.CancelOrder("").Error.Code != "INVALID_ORDER_ID" || svc.CancelOrder("MISS").Error.Code != "ORDER_NOT_FOUND" {
		t.Fatalf("cancel lookup branches failed")
	}
	repo.failSave = true
	if svc.CancelOrder("ORD-1").Error.Code != "REPOSITORY_ERROR" {
		t.Fatalf("expected cancel REPOSITORY_ERROR")
	}
	repo.failSave = false
	if !svc.CancelOrder("ORD-1").Ok || svc.CancelOrder("ORD-1").Error.Code != "INVALID_ORDER_STATE" {
		t.Fatalf("cancel transition branches failed")
	}
}
