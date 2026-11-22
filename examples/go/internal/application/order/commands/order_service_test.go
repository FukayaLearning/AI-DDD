package commands_test

import (
	"testing"
	"example.com/ordering-go/internal/application/order/commands"
	domainorder "example.com/ordering-go/internal/domain/order"
	"example.com/ordering-go/internal/domain/shared"
)

type memRepo struct {
	data     map[string]domainorder.Order
	failSave bool
}

func (m *memRepo) Save(o domainorder.Order) shared.Result[struct{}, shared.DomainError] {
	if m.failSave {
		return shared.Failure[struct{}, shared.DomainError](shared.NewDomainError("REPOSITORY_ERROR", "db down"))
	}
	m.data[o.Id.Value] = o
	return shared.Success[struct{}, shared.DomainError](struct{}{})
}

func (m *memRepo) FindById(id shared.OrderId) shared.Result[domainorder.Order, shared.DomainError] {
	if o, ok := m.data[id.Value]; ok {
		return shared.Success[domainorder.Order, shared.DomainError](o)
	}
	return shared.Failure[domainorder.Order, shared.DomainError](shared.NewDomainError("ORDER_NOT_FOUND", "missing"))
}

type stubInv struct{ err *shared.DomainError }

func (s stubInv) ReserveStock(shared.OrderId, []domainorder.OrderLine) shared.Result[struct{}, shared.DomainError] {
	if s.err != nil {
		return shared.Failure[struct{}, shared.DomainError](*s.err)
	}
	return shared.Success[struct{}, shared.DomainError](struct{}{})
}

type stubPay struct{ err *shared.DomainError }

func (s stubPay) Charge(shared.OrderId, shared.Money) shared.Result[struct{}, shared.DomainError] {
	if s.err != nil {
		return shared.Failure[struct{}, shared.DomainError](*s.err)
	}
	return shared.Success[struct{}, shared.DomainError](struct{}{})
}

// UT-ORD-021, UT-ORD-022, UT-ORD-023, UT-ORD-024, UT-ORD-025, UT-ORD-026
func TestUT_ORD_021_OrderApplicationScenarios(t *testing.T) {
	repo := &memRepo{data: map[string]domainorder.Order{}}
	svc := commands.NewOrderApplicationService(repo, stubInv{}, stubPay{})

	if svc.PlaceOrder(commands.PlaceOrderCommand{OrderId: "", CustomerId: "C1"}).Error.Code != "INVALID_ORDER_ID" {
		t.Fatalf("expected INVALID_ORDER_ID")
	}
	if svc.PlaceOrder(commands.PlaceOrderCommand{OrderId: "O1", CustomerId: ""}).Error.Code != "INVALID_CUSTOMER_ID" {
		t.Fatalf("expected INVALID_CUSTOMER_ID")
	}
	if svc.PlaceOrder(commands.PlaceOrderCommand{OrderId: "O1", CustomerId: "C1", Lines: []commands.PlaceOrderLineInput{{ProductId: "", Quantity: 1, UnitAmount: 10, Currency: shared.CurrencyJPY}}}).Error.Code != "INVALID_PRODUCT_ID" {
		t.Fatalf("expected INVALID_PRODUCT_ID")
	}
	if svc.PlaceOrder(commands.PlaceOrderCommand{OrderId: "O1", CustomerId: "C1", Lines: []commands.PlaceOrderLineInput{{ProductId: "P1", Quantity: 0, UnitAmount: 10, Currency: shared.CurrencyJPY}}}).Error.Code != "INVALID_QUANTITY" {
		t.Fatalf("expected INVALID_QUANTITY")
	}
	if svc.PlaceOrder(commands.PlaceOrderCommand{OrderId: "O1", CustomerId: "C1", Lines: []commands.PlaceOrderLineInput{{ProductId: "P1", Quantity: 1, UnitAmount: -1, Currency: shared.CurrencyJPY}}}).Error.Code != "INVALID_MONEY_AMOUNT" {
		t.Fatalf("expected INVALID_MONEY_AMOUNT")
	}
	if svc.PlaceOrder(commands.PlaceOrderCommand{OrderId: "O1", CustomerId: "C1"}).Error.Code != "EMPTY_ORDER_LINES" {
		t.Fatalf("expected EMPTY_ORDER_LINES")
	}

	repo.failSave = true
	if svc.PlaceOrder(commands.PlaceOrderCommand{OrderId: "ORD-1", CustomerId: "C1", Lines: []commands.PlaceOrderLineInput{{ProductId: "P1", Quantity: 1, UnitAmount: 100, Currency: shared.CurrencyJPY}}}).Error.Code != "REPOSITORY_ERROR" {
		t.Fatalf("expected REPOSITORY_ERROR")
	}
	repo.failSave = false

	if res := svc.PlaceOrder(commands.PlaceOrderCommand{OrderId: "ORD-1", CustomerId: "C1", Lines: []commands.PlaceOrderLineInput{{ProductId: "P1", Quantity: 2, UnitAmount: 500, Currency: shared.CurrencyJPY}}}); !res.Ok {
		t.Fatalf("expected place ok")
	}

	if svc.GetOrder("").Error.Code != "INVALID_ORDER_ID" || svc.GetOrder("MISS").Error.Code != "ORDER_NOT_FOUND" || !svc.GetOrder("ORD-1").Ok {
		t.Fatalf("getOrder branches failed")
	}

	if svc.ConfirmOrder("").Error.Code != "INVALID_ORDER_ID" || svc.ConfirmOrder("MISS").Error.Code != "ORDER_NOT_FOUND" {
		t.Fatalf("confirmOrder lookup branches failed")
	}
	stockErr := shared.NewDomainError("INSUFFICIENT_STOCK", "short")
	if commands.NewOrderApplicationService(repo, stubInv{err: &stockErr}, stubPay{}).ConfirmOrder("ORD-1").Error.Code != "INSUFFICIENT_STOCK" {
		t.Fatalf("expected INSUFFICIENT_STOCK")
	}
	payErr := shared.NewDomainError("PAYMENT_DECLINED", "declined")
	if commands.NewOrderApplicationService(repo, stubInv{}, stubPay{err: &payErr}).ConfirmOrder("ORD-1").Error.Code != "PAYMENT_DECLINED" {
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
