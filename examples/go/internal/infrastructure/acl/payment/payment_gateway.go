package payment

import (
	"encoding/json"
	"io"
	"net/http"
	"example.com/ordering-go/internal/domain/shared"
	httpdrv "example.com/ordering-go/internal/infrastructure/drivers/http"
)

func MapPaymentHttpStatus(status int) shared.Result[struct{}, shared.DomainError] {
	if status == http.StatusOK {
		return shared.Success[struct{}, shared.DomainError](struct{}{})
	}
	if status == http.StatusPaymentRequired {
		return shared.Failure[struct{}, shared.DomainError](shared.NewDomainError("PAYMENT_DECLINED", "Payment gateway declined the charge"))
	}
	return shared.Failure[struct{}, shared.DomainError](shared.NewDomainError("EXTERNAL_TIMEOUT", "Payment service error"))
}

type PaymentGateway struct {
	driver      httpdrv.HttpJsonDriver
	endpointUrl string
}

func NewPaymentGateway(driver httpdrv.HttpJsonDriver, endpointUrl string) *PaymentGateway {
	return &PaymentGateway{driver: driver, endpointUrl: endpointUrl}
}

func (g *PaymentGateway) Charge(orderId shared.OrderId, amount shared.Money) shared.Result[struct{}, shared.DomainError] {
	body, _ := json.Marshal(map[string]any{"orderId": orderId.Value, "amount": amount.Amount, "currency": amount.Currency})
	resp, err := g.driver.PostJson(g.endpointUrl, string(body))
	if err != nil {
		return shared.Failure[struct{}, shared.DomainError](shared.NewDomainError("EXTERNAL_TIMEOUT", "Payment service timed out"))
	}
	defer resp.Body.Close()
	_, _ = io.ReadAll(resp.Body)
	return MapPaymentHttpStatus(resp.StatusCode)
}
