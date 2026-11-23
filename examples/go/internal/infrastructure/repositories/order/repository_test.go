package orderrepo_test

import (
	"errors"
	"os"
	"testing"

	domainorder "example.com/ordering-go/internal/domain/entities/order"
	ordervo "example.com/ordering-go/internal/domain/value_objects/order"
	sharedvo "example.com/ordering-go/internal/domain/value_objects/shared"
	ordermapper "example.com/ordering-go/internal/infrastructure/mappers/order"
	orderrepo "example.com/ordering-go/internal/infrastructure/repositories/order"
)

type mockKv struct {
	data   map[string][]byte
	putErr error
	getErr error
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
	oid := sharedvo.CreateOrderId("ORD-1").Value
	cid := sharedvo.CreateCustomerId("C1").Value
	pid := sharedvo.CreateProductId("P1").Value
	qty := ordervo.CreateQuantity(2).Value
	price := sharedvo.CreateMoney(100, sharedvo.CurrencyJPY).Value
	order := domainorder.CreateOrder(oid, cid, []domainorder.OrderLine{{ProductId: pid, Quantity: qty, UnitPrice: price}}, domainorder.StatusDraft, nil).Value.Confirm().Value

	rec := ordermapper.ToOrderRecord(order)
	if !ordermapper.FromOrderRecord(rec).Ok {
		t.Fatalf("expected valid roundtrip")
	}
	badId := rec
	badId.Id = ""
	if ordermapper.FromOrderRecord(badId).Ok {
		t.Fatalf("expected err")
	}
	badCust := rec
	badCust.CustomerId = ""
	if ordermapper.FromOrderRecord(badCust).Ok {
		t.Fatalf("expected err")
	}
	badProd := rec
	badProd.Lines = []ordermapper.OrderLineRecord{{ProductId: "", Quantity: 1, UnitAmount: 10, Currency: sharedvo.CurrencyJPY}}
	if ordermapper.FromOrderRecord(badProd).Ok {
		t.Fatalf("expected err")
	}
	badQty := rec
	badQty.Lines = []ordermapper.OrderLineRecord{{ProductId: "P1", Quantity: 0, UnitAmount: 10, Currency: sharedvo.CurrencyJPY}}
	if ordermapper.FromOrderRecord(badQty).Ok {
		t.Fatalf("expected err")
	}
	badAmt := rec
	badAmt.Lines = []ordermapper.OrderLineRecord{{ProductId: "P1", Quantity: 1, UnitAmount: -1, Currency: sharedvo.CurrencyJPY}}
	if ordermapper.FromOrderRecord(badAmt).Ok {
		t.Fatalf("expected err")
	}
	badLines := rec
	badLines.Lines = nil
	if ordermapper.FromOrderRecord(badLines).Ok {
		t.Fatalf("expected err")
	}

	kv := &mockKv{data: map[string][]byte{}}
	repo := orderrepo.NewDriverOrderRepository(kv)
	if !repo.Save(order).Ok || !repo.FindById(oid).Ok {
		t.Fatalf("save/find failed")
	}
	if repo.FindById(sharedvo.CreateOrderId("MISS").Value).Error.Code != "ORDER_NOT_FOUND" {
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
	if repo.FindById(sharedvo.CreateOrderId("CORRUPT").Value).Error.Code != "REPOSITORY_ERROR" {
		t.Fatalf("expected REPOSITORY_ERROR on bad json")
	}
}
