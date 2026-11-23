package paymentgw_test

import (
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"

	sharedvo "example.com/ordering-go/internal/domain/value_objects/shared"
	paymentgw "example.com/ordering-go/internal/infrastructure/gateways/payment"
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
	oid := sharedvo.CreateOrderId("ORD-1").Value
	amount := sharedvo.CreateMoney(100, sharedvo.CurrencyJPY).Value
	if !paymentgw.NewPaymentGateway(mockHttp{status: 200}, "http://pay").Charge(oid, amount).Ok {
		t.Fatalf("expected ok")
	}
	if paymentgw.NewPaymentGateway(mockHttp{status: 402}, "http://pay").Charge(oid, amount).Error.Code != "PAYMENT_DECLINED" {
		t.Fatalf("expected PAYMENT_DECLINED")
	}
	if paymentgw.NewPaymentGateway(mockHttp{status: 503}, "http://pay").Charge(oid, amount).Error.Code != "EXTERNAL_TIMEOUT" {
		t.Fatalf("expected EXTERNAL_TIMEOUT")
	}
	if paymentgw.NewPaymentGateway(mockHttp{err: errors.New("timeout")}, "http://pay").Charge(oid, amount).Error.Code != "EXTERNAL_TIMEOUT" {
		t.Fatalf("expected EXTERNAL_TIMEOUT")
	}
}
