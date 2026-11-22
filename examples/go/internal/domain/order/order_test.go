package order_test

import (
	"testing"
	"example.com/ordering-go/internal/domain/order"
	"example.com/ordering-go/internal/domain/shared"
)

// UT-ORD-001, UT-ORD-002, UT-ORD-003, UT-ORD-004, UT-ORD-005, UT-ORD-006, UT-ORD-007, UT-ORD-008, UT-ORD-009, UT-ORD-010, UT-ORD-011, UT-ORD-012, UT-ORD-013
func TestUT_ORD_001_OrderingDomain(t *testing.T) {
	if shared.CreateOrderId(" ").Ok {
		t.Fatalf("expected error on empty OrderId")
	}
	oid := shared.CreateOrderId(" ORD-1 ").Value
	if shared.CreateCustomerId(" ").Ok {
		t.Fatalf("expected error on empty CustomerId")
	}
	cid := shared.CreateCustomerId(" CUST-1 ").Value
	if shared.CreateProductId(" ").Ok {
		t.Fatalf("expected error on empty ProductId")
	}
	p1 := shared.CreateProductId(" P1 ").Value
	p2 := shared.CreateProductId(" P2 ").Value

	if shared.CreateQuantity(0).Ok || shared.CreateQuantity(101).Ok {
		t.Fatalf("expected quantity bounds errors")
	}
	q2 := shared.CreateQuantity(2).Value

	if shared.CreateMoney(-1, shared.CurrencyJPY).Ok || shared.CreateMoney(10, shared.Currency("EUR")).Ok {
		t.Fatalf("expected money validation errors")
	}
	jpy := shared.CreateMoney(500, shared.CurrencyJPY).Value
	usd := shared.CreateMoney(5, shared.CurrencyUSD).Value
	sub := shared.MultiplyMoney(jpy, q2)
	if sub.Amount != 1000 || shared.AddMoney(jpy, usd).Ok {
		t.Fatalf("unexpected money arithmetic")
	}
	if sum := shared.AddMoney(jpy, sub); !sum.Ok || sum.Value.Amount != 1500 {
		t.Fatalf("expected 1500 JPY")
	}

	if res := shared.CreateOrder(oid, cid, nil, shared.StatusDraft, nil); res.Ok || res.Error.Code != "EMPTY_ORDER_LINES" {
		t.Fatalf("expected EMPTY_ORDER_LINES")
	}
	six := make([]order.OrderLine, 6)
	for i := range six {
		six[i] = order.OrderLine{ProductId: shared.ProductId{Value: string(rune('A' + i))}, Quantity: q2, UnitPrice: jpy}
	}
	if res := shared.CreateOrder(oid, cid, six, shared.StatusDraft, nil); res.Ok || res.Error.Code != "TOO_MANY_ORDER_LINES" {
		t.Fatalf("expected TOO_MANY_ORDER_LINES")
	}
	if res := shared.CreateOrder(oid, cid, []order.OrderLine{
		{ProductId: p1, Quantity: q2, UnitPrice: jpy},
		{ProductId: p1, Quantity: q2, UnitPrice: jpy},
	}, shared.StatusDraft, nil); res.Ok || res.Error.Code != "DUPLICATE_PRODUCT" {
		t.Fatalf("expected DUPLICATE_PRODUCT")
	}
	if res := shared.CreateOrder(oid, cid, []order.OrderLine{
		{ProductId: p1, Quantity: q2, UnitPrice: jpy},
		{ProductId: p2, Quantity: q2, UnitPrice: usd},
	}, shared.StatusDraft, nil); res.Ok || res.Error.Code != "CURRENCY_MISMATCH" {
		t.Fatalf("expected CURRENCY_MISMATCH")
	}

	order := shared.CreateOrder(oid, cid, []order.OrderLine{{ProductId: p1, Quantity: q2, UnitPrice: jpy}}, shared.StatusDraft, nil).Value
	if order.TotalAmount().Amount != 1000 {
		t.Fatalf("expected total 1000")
	}
	conf := order.Confirm()
	if !conf.Ok || conf.Value.Status != shared.StatusConfirmed || conf.Value.Confirm().Ok {
		t.Fatalf("confirm invariant failed")
	}
	canc := conf.Value.Cancel()
	if !canc.Ok || canc.Value.Status != shared.StatusCancelled || canc.Value.Cancel().Ok {
		t.Fatalf("cancel invariant failed")
	}
}
