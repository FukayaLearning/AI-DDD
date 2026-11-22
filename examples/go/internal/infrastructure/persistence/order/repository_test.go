package order_test

import (
	"errors"
	"os"
	"testing"
	domainorder "example.com/ordering-go/internal/domain/order"
	"example.com/ordering-go/internal/domain/shared"
	persistence "example.com/ordering-go/internal/infrastructure/persistence/order"
)

type mockKv struct {
	data    map[string][]byte
	putErr  error
	getErr  error
}

func (m *mockKv) Put(k string, p []byte) error {
	if m.putErr != nil {
		return m.putErr
	}
	m.data[k] = p
	return nil
}

func (m *mockKv) Get(k string) ([]byte, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	v, ok := m.data[k]
	if !ok {
		return nil, os.ErrNotExist
	}
	return v, nil
}

// UT-ORD-014, UT-ORD-015, UT-ORD-016
func TestUT_ORD_014_MapperAndRepository(t *testing.T) {
	oid := shared.CreateOrderId("ORD-1").Value
	cid := shared.CreateCustomerId("C1").Value
	pid := shared.CreateProductId("P1").Value
	qty := shared.CreateQuantity(2).Value
	price := shared.CreateMoney(100, shared.CurrencyJPY).Value
	order := domainorder.CreateOrder(oid, cid, []domainorder.OrderLine{{ProductId: pid, Quantity: qty, UnitPrice: price}}, domainorder.StatusDraft, nil).Value.Confirm().Value

	rec := persistence.ToOrderRecord(order)
	if !persistence.FromOrderRecord(rec).Ok {
		t.Fatalf("expected valid roundtrip")
	}
	badId := rec; badId.Id = ""
	if persistence.FromOrderRecord(badId).Ok { t.Fatalf("expected err") }
	badCust := rec; badCust.CustomerId = ""
	if persistence.FromOrderRecord(badCust).Ok { t.Fatalf("expected err") }
	badProd := rec; badProd.Lines = []persistence.OrderLineRecord{{ProductId: "", Quantity: 1, UnitAmount: 10, Currency: shared.CurrencyJPY}}
	if persistence.FromOrderRecord(badProd).Ok { t.Fatalf("expected err") }
	badQty := rec; badQty.Lines = []persistence.OrderLineRecord{{ProductId: "P1", Quantity: 0, UnitAmount: 10, Currency: shared.CurrencyJPY}}
	if persistence.FromOrderRecord(badQty).Ok { t.Fatalf("expected err") }
	badAmt := rec; badAmt.Lines = []persistence.OrderLineRecord{{ProductId: "P1", Quantity: 1, UnitAmount: -1, Currency: shared.CurrencyJPY}}
	if persistence.FromOrderRecord(badAmt).Ok { t.Fatalf("expected err") }
	badLines := rec; badLines.Lines = nil
	if persistence.FromOrderRecord(badLines).Ok { t.Fatalf("expected err") }

	kv := &mockKv{data: map[string][]byte{}}
	repo := persistence.NewDriverOrderRepository(kv)
	if !repo.Save(order).Ok || !repo.FindById(oid).Ok {
		t.Fatalf("save/find failed")
	}
	if repo.FindById(shared.CreateOrderId("MISS").Value).Error.Code != "ORDER_NOT_FOUND" {
		t.Fatalf("expected ORDER_NOT_FOUND")
	}

	kv.putErr = errors.New("disk full")
	if repo.Save(order).Error.Code != "REPOSITORY_ERROR" {
		t.Fatalf("expected REPOSITORY_ERROR")
	}
	kv.getErr = errors.New("io error")
	if repo.FindById(oid).Error.Code != "REPOSITORY_ERROR" {
		t.Fatalf("expected REPOSITORY_ERROR")
	}
	kv.getErr = nil
	kv.data["CORRUPT"] = []byte("{bad-json")
	if repo.FindById(shared.CreateOrderId("CORRUPT").Value).Error.Code != "REPOSITORY_ERROR" {
		t.Fatalf("expected REPOSITORY_ERROR on bad json")
	}
}
