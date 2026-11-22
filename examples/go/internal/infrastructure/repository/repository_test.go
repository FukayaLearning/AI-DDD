package repository_test

import (
	"errors"
	"os"
	"testing"
	"example.com/ordering-go/internal/domain"
	"example.com/ordering-go/internal/infrastructure/repository"
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

func TestMapperAndRepository(t *testing.T) {
	oid := domain.CreateOrderId("ORD-1").Value
	cid := domain.CreateCustomerId("C1").Value
	pid := domain.CreateProductId("P1").Value
	qty := domain.CreateQuantity(2).Value
	price := domain.CreateMoney(100, domain.CurrencyJPY).Value
	order := domain.CreateOrder(oid, cid, []domain.OrderLine{{ProductId: pid, Quantity: qty, UnitPrice: price}}, domain.StatusDraft, nil).Value.Confirm().Value

	rec := repository.ToOrderRecord(order)
	if !repository.FromOrderRecord(rec).Ok {
		t.Fatalf("expected valid roundtrip")
	}
	badId := rec; badId.Id = ""
	if repository.FromOrderRecord(badId).Ok { t.Fatalf("expected err") }
	badCust := rec; badCust.CustomerId = ""
	if repository.FromOrderRecord(badCust).Ok { t.Fatalf("expected err") }
	badProd := rec; badProd.Lines = []repository.OrderLineRecord{{ProductId: "", Quantity: 1, UnitAmount: 10, Currency: domain.CurrencyJPY}}
	if repository.FromOrderRecord(badProd).Ok { t.Fatalf("expected err") }
	badQty := rec; badQty.Lines = []repository.OrderLineRecord{{ProductId: "P1", Quantity: 0, UnitAmount: 10, Currency: domain.CurrencyJPY}}
	if repository.FromOrderRecord(badQty).Ok { t.Fatalf("expected err") }
	badAmt := rec; badAmt.Lines = []repository.OrderLineRecord{{ProductId: "P1", Quantity: 1, UnitAmount: -1, Currency: domain.CurrencyJPY}}
	if repository.FromOrderRecord(badAmt).Ok { t.Fatalf("expected err") }
	badLines := rec; badLines.Lines = nil
	if repository.FromOrderRecord(badLines).Ok { t.Fatalf("expected err") }

	kv := &mockKv{data: map[string][]byte{}}
	repo := repository.NewDriverOrderRepository(kv)
	if !repo.Save(order).Ok || !repo.FindById(oid).Ok {
		t.Fatalf("save/find failed")
	}
	if repo.FindById(domain.CreateOrderId("MISS").Value).Error.Code != "ORDER_NOT_FOUND" {
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
	if repo.FindById(domain.CreateOrderId("CORRUPT").Value).Error.Code != "REPOSITORY_ERROR" {
		t.Fatalf("expected REPOSITORY_ERROR on bad json")
	}
}
