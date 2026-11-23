package inventorygw_test

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	domainorder "example.com/ordering-go/internal/domain/entities/order"
	ordervo "example.com/ordering-go/internal/domain/value_objects/order"
	sharedvo "example.com/ordering-go/internal/domain/value_objects/shared"
	inventorygw "example.com/ordering-go/internal/infrastructure/gateways/inventory"
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
	oid := sharedvo.CreateOrderId("ORD-1").Value
	lines := []domainorder.OrderLine{{
		ProductId: sharedvo.CreateProductId("P1").Value,
		Quantity:  ordervo.CreateQuantity(1).Value,
		UnitPrice: sharedvo.CreateMoney(100, sharedvo.CurrencyJPY).Value,
	}}
	if !inventorygw.NewInventoryGateway(mockHttp{status: 200}, "http://inv").ReserveStock(oid, lines).Ok {
		t.Fatalf("expected ok")
	}
	if inventorygw.NewInventoryGateway(mockHttp{status: 409}, "http://inv").ReserveStock(oid, lines).Error.Code != "INSUFFICIENT_STOCK" {
		t.Fatalf("expected INSUFFICIENT_STOCK")
	}
	if inventorygw.NewInventoryGateway(mockHttp{status: 500}, "http://inv").ReserveStock(oid, lines).Error.Code != "EXTERNAL_TIMEOUT" {
		t.Fatalf("expected EXTERNAL_TIMEOUT")
	}
	if inventorygw.NewInventoryGateway(mockHttp{err: errors.New("timeout")}, "http://inv").ReserveStock(oid, lines).Error.Code != "EXTERNAL_TIMEOUT" {
		t.Fatalf("expected EXTERNAL_TIMEOUT")
	}
}
