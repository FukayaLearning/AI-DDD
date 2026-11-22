package payment_test

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"example.com/ordering-go/internal/domain/shared"
	"example.com/ordering-go/internal/infrastructure/acl/payment"
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

// UT-ORD-019, UT-ORD-020
func TestUT_ORD_019_PaymentGateway(t *testing.T) {
	oid := shared.CreateOrderId("ORD-1").Value
	amount := shared.CreateMoney(100, shared.CurrencyJPY).Value
	if !payment.NewPaymentGateway(mockHttp{status: 200}, "http://pay").Charge(oid, amount).Ok {
		t.Fatalf("expected ok")
	}
	if payment.NewPaymentGateway(mockHttp{status: 402}, "http://pay").Charge(oid, amount).Error.Code != "PAYMENT_DECLINED" {
		t.Fatalf("expected PAYMENT_DECLINED")
	}
	if payment.NewPaymentGateway(mockHttp{status: 503}, "http://pay").Charge(oid, amount).Error.Code != "EXTERNAL_TIMEOUT" {
		t.Fatalf("expected EXTERNAL_TIMEOUT")
	}
	if payment.NewPaymentGateway(mockHttp{err: errors.New("timeout")}, "http://pay").Charge(oid, amount).Error.Code != "EXTERNAL_TIMEOUT" {
		t.Fatalf("expected EXTERNAL_TIMEOUT")
	}
}
