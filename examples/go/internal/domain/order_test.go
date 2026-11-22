package domain_test

import (
	"testing"
	"example.com/ordering-go/internal/domain"
)

func TestOrderingDomain(t *testing.T) {
	if domain.CreateOrderId(" ").Ok {
		t.Fatalf("expected error on empty OrderId")
	}
	oid := domain.CreateOrderId(" ORD-1 ").Value
	if domain.CreateCustomerId(" ").Ok {
		t.Fatalf("expected error on empty CustomerId")
	}
	cid := domain.CreateCustomerId(" CUST-1 ").Value
	if domain.CreateProductId(" ").Ok {
		t.Fatalf("expected error on empty ProductId")
	}
	p1 := domain.CreateProductId(" P1 ").Value
	p2 := domain.CreateProductId(" P2 ").Value

	if domain.CreateQuantity(0).Ok || domain.CreateQuantity(101).Ok {
		t.Fatalf("expected quantity bounds errors")
	}
	q2 := domain.CreateQuantity(2).Value

	if domain.CreateMoney(-1, domain.CurrencyJPY).Ok || domain.CreateMoney(10, domain.Currency("EUR")).Ok {
		t.Fatalf("expected money validation errors")
	}
	jpy := domain.CreateMoney(500, domain.CurrencyJPY).Value
	usd := domain.CreateMoney(5, domain.CurrencyUSD).Value
	sub := domain.MultiplyMoney(jpy, q2)
	if sub.Amount != 1000 || domain.AddMoney(jpy, usd).Ok {
		t.Fatalf("unexpected money arithmetic")
	}
	if sum := domain.AddMoney(jpy, sub); !sum.Ok || sum.Value.Amount != 1500 {
		t.Fatalf("expected 1500 JPY")
	}

	if res := domain.CreateOrder(oid, cid, nil, domain.StatusDraft, nil); res.Ok || res.Error.Code != "EMPTY_ORDER_LINES" {
		t.Fatalf("expected EMPTY_ORDER_LINES")
	}
	six := make([]domain.OrderLine, 6)
	for i := range six {
		six[i] = domain.OrderLine{ProductId: domain.ProductId{Value: string(rune('A' + i))}, Quantity: q2, UnitPrice: jpy}
	}
	if res := domain.CreateOrder(oid, cid, six, domain.StatusDraft, nil); res.Ok || res.Error.Code != "TOO_MANY_ORDER_LINES" {
		t.Fatalf("expected TOO_MANY_ORDER_LINES")
	}
	if res := domain.CreateOrder(oid, cid, []domain.OrderLine{
		{ProductId: p1, Quantity: q2, UnitPrice: jpy},
		{ProductId: p1, Quantity: q2, UnitPrice: jpy},
	}, domain.StatusDraft, nil); res.Ok || res.Error.Code != "DUPLICATE_PRODUCT" {
		t.Fatalf("expected DUPLICATE_PRODUCT")
	}
	if res := domain.CreateOrder(oid, cid, []domain.OrderLine{
		{ProductId: p1, Quantity: q2, UnitPrice: jpy},
		{ProductId: p2, Quantity: q2, UnitPrice: usd},
	}, domain.StatusDraft, nil); res.Ok || res.Error.Code != "CURRENCY_MISMATCH" {
		t.Fatalf("expected CURRENCY_MISMATCH")
	}

	order := domain.CreateOrder(oid, cid, []domain.OrderLine{{ProductId: p1, Quantity: q2, UnitPrice: jpy}}, domain.StatusDraft, nil).Value
	if order.TotalAmount().Amount != 1000 {
		t.Fatalf("expected total 1000")
	}
	conf := order.Confirm()
	if !conf.Ok || conf.Value.Status != domain.StatusConfirmed || conf.Value.Confirm().Ok {
		t.Fatalf("confirm invariant failed")
	}
	canc := conf.Value.Cancel()
	if !canc.Ok || canc.Value.Status != domain.StatusCancelled || canc.Value.Cancel().Ok {
		t.Fatalf("cancel invariant failed")
	}
}
