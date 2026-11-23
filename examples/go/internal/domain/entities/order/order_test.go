package order_test

import (
	"testing"

	domainorder "example.com/ordering-go/internal/domain/entities/order"
	ordervo "example.com/ordering-go/internal/domain/value_objects/order"
	sharedvo "example.com/ordering-go/internal/domain/value_objects/shared"
)

// UT-ORD-001, UT-ORD-002, UT-ORD-003, UT-ORD-004, UT-ORD-005, UT-ORD-006, UT-ORD-007, UT-ORD-008, UT-ORD-009, UT-ORD-010, UT-ORD-011, UT-ORD-012, UT-ORD-013
func TestUT_ORD_001_OrderingDomain(t *testing.T) {
	if sharedvo.CreateOrderId(" ").Ok {
		t.Fatalf("expected error on empty OrderId")
	}
	oid := sharedvo.CreateOrderId(" ORD-1 ").Value
	if sharedvo.CreateCustomerId(" ").Ok {
		t.Fatalf("expected error on empty CustomerId")
	}
	cid := sharedvo.CreateCustomerId(" CUST-1 ").Value
	if sharedvo.CreateProductId(" ").Ok {
		t.Fatalf("expected error on empty ProductId")
	}
	p1 := sharedvo.CreateProductId(" P1 ").Value
	p2 := sharedvo.CreateProductId(" P2 ").Value

	if ordervo.CreateQuantity(0).Ok || ordervo.CreateQuantity(101).Ok {
		t.Fatalf("expected quantity bounds errors")
	}
	q2 := ordervo.CreateQuantity(2).Value

	if sharedvo.CreateMoney(-1, sharedvo.CurrencyJPY).Ok || sharedvo.CreateMoney(10, sharedvo.Currency("EUR")).Ok {
		t.Fatalf("expected money validation errors")
	}
	jpy := sharedvo.CreateMoney(500, sharedvo.CurrencyJPY).Value
	usd := sharedvo.CreateMoney(5, sharedvo.CurrencyUSD).Value
	sub := sharedvo.MultiplyMoney(jpy, q2)
	if sub.Amount != 1000 || sharedvo.AddMoney(jpy, usd).Ok {
		t.Fatalf("unexpected money arithmetic")
	}
	if sum := sharedvo.AddMoney(jpy, sub); !sum.Ok || sum.Value.Amount != 1500 {
		t.Fatalf("expected 1500 JPY")
	}

	if res := domainorder.CreateOrder(oid, cid, nil, domainorder.StatusDraft, nil); res.Ok || res.Error.Code != "EMPTY_ORDER_LINES" {
		t.Fatalf("expected EMPTY_ORDER_LINES")
	}
	six := make([]domainorder.OrderLine, 6)
	for i := range six {
		six[i] = domainorder.OrderLine{ProductId: sharedvo.ProductId{Value: string(rune('A' + i))}, Quantity: q2, UnitPrice: jpy}
	}
	if res := domainorder.CreateOrder(oid, cid, six, domainorder.StatusDraft, nil); res.Ok || res.Error.Code != "TOO_MANY_ORDER_LINES" {
		t.Fatalf("expected TOO_MANY_ORDER_LINES")
	}
	if res := domainorder.CreateOrder(oid, cid, []domainorder.OrderLine{
		{ProductId: p1, Quantity: q2, UnitPrice: jpy},
		{ProductId: p1, Quantity: q2, UnitPrice: jpy},
	}, domainorder.StatusDraft, nil); res.Ok || res.Error.Code != "DUPLICATE_PRODUCT" {
		t.Fatalf("expected DUPLICATE_PRODUCT")
	}
	if res := domainorder.CreateOrder(oid, cid, []domainorder.OrderLine{
		{ProductId: p1, Quantity: q2, UnitPrice: jpy},
		{ProductId: p2, Quantity: q2, UnitPrice: usd},
	}, domainorder.StatusDraft, nil); res.Ok || res.Error.Code != "CURRENCY_MISMATCH" {
		t.Fatalf("expected CURRENCY_MISMATCH")
	}

	placed := domainorder.CreateOrder(oid, cid, []domainorder.OrderLine{{ProductId: p1, Quantity: q2, UnitPrice: jpy}}, domainorder.StatusDraft, nil).Value
	if placed.TotalAmount().Amount != 1000 {
		t.Fatalf("expected total 1000")
	}
	conf := placed.Confirm()
	if !conf.Ok || conf.Value.Status != domainorder.StatusConfirmed || conf.Value.Confirm().Ok {
		t.Fatalf("confirm invariant failed")
	}
	canc := conf.Value.Cancel()
	if !canc.Ok || canc.Value.Status != domainorder.StatusCancelled || canc.Value.Cancel().Ok {
		t.Fatalf("cancel invariant failed")
	}
}
