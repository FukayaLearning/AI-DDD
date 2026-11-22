package inventory_test

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"example.com/ordering-go/internal/domain/order"
	"example.com/ordering-go/internal/domain/shared"
	"example.com/ordering-go/internal/infrastructure/acl/inventory"
)

type mockHttp struct {
	status int
	err    error
}

func (m mockHttp) PostJson(string, string) (*http.Response, error) {
	if m.err != nil {
		return nil, m.err
	}
	return &http.Response{StatusCode: m.status, Body: io.NopCloser(strings.NewReader("{}"))}, nil
}

// UT-ORD-017, UT-ORD-018
func TestUT_ORD_017_InventoryGateway(t *testing.T) {
	oid := shared.CreateOrderId("ORD-1").Value
	lines := []order.OrderLine{{
		ProductId: shared.CreateProductId("P1").Value,
		Quantity:  shared.CreateQuantity(1).Value,
		UnitPrice: shared.CreateMoney(100, shared.CurrencyJPY).Value,
	}}
	if !inventory.NewInventoryGateway(mockHttp{status: 200}, "http://inv").ReserveStock(oid, lines).Ok {
		t.Fatalf("expected ok")
	}
	if inventory.NewInventoryGateway(mockHttp{status: 409}, "http://inv").ReserveStock(oid, lines).Error.Code != "INSUFFICIENT_STOCK" {
		t.Fatalf("expected INSUFFICIENT_STOCK")
	}
	if inventory.NewInventoryGateway(mockHttp{status: 500}, "http://inv").ReserveStock(oid, lines).Error.Code != "EXTERNAL_TIMEOUT" {
		t.Fatalf("expected EXTERNAL_TIMEOUT")
	}
	if inventory.NewInventoryGateway(mockHttp{err: errors.New("timeout")}, "http://inv").ReserveStock(oid, lines).Error.Code != "EXTERNAL_TIMEOUT" {
		t.Fatalf("expected EXTERNAL_TIMEOUT")
	}
}
