package acl_test

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"example.com/ordering-go/internal/domain"
	"example.com/ordering-go/internal/infrastructure/acl"
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

func TestAclGateways(t *testing.T) {
	oid := domain.CreateOrderId("ORD-1").Value
	lines := []domain.OrderLine{{
		ProductId: domain.CreateProductId("P1").Value,
		Quantity:  domain.CreateQuantity(1).Value,
		UnitPrice: domain.CreateMoney(100, domain.CurrencyJPY).Value,
	}}
	amount := domain.CreateMoney(100, domain.CurrencyJPY).Value

	if !acl.NewInventoryGateway(mockHttp{status: 200}, "http://inv").ReserveStock(oid, lines).Ok {
		t.Fatalf("expected ok")
	}
	if acl.NewInventoryGateway(mockHttp{status: 409}, "http://inv").ReserveStock(oid, lines).Error.Code != "INSUFFICIENT_STOCK" {
		t.Fatalf("expected INSUFFICIENT_STOCK")
	}
	if acl.NewInventoryGateway(mockHttp{status: 500}, "http://inv").ReserveStock(oid, lines).Error.Code != "EXTERNAL_TIMEOUT" {
		t.Fatalf("expected EXTERNAL_TIMEOUT")
	}
	if acl.NewInventoryGateway(mockHttp{err: errors.New("timeout")}, "http://inv").ReserveStock(oid, lines).Error.Code != "EXTERNAL_TIMEOUT" {
		t.Fatalf("expected EXTERNAL_TIMEOUT")
	}

	if !acl.NewPaymentGateway(mockHttp{status: 200}, "http://pay").Charge(oid, amount).Ok {
		t.Fatalf("expected ok")
	}
	if acl.NewPaymentGateway(mockHttp{status: 402}, "http://pay").Charge(oid, amount).Error.Code != "PAYMENT_DECLINED" {
		t.Fatalf("expected PAYMENT_DECLINED")
	}
	if acl.NewPaymentGateway(mockHttp{status: 503}, "http://pay").Charge(oid, amount).Error.Code != "EXTERNAL_TIMEOUT" {
		t.Fatalf("expected EXTERNAL_TIMEOUT")
	}
	if acl.NewPaymentGateway(mockHttp{err: errors.New("timeout")}, "http://pay").Charge(oid, amount).Error.Code != "EXTERNAL_TIMEOUT" {
		t.Fatalf("expected EXTERNAL_TIMEOUT")
	}
}
