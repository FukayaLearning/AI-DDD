package acl

import (
	"encoding/json"
	"io"
	"net/http"
	"example.com/ordering-go/internal/domain"
	"example.com/ordering-go/internal/infrastructure/drivers"
)

func MapInventoryHttpStatus(status int) domain.Result[struct{}, domain.DomainError] {
	if status == http.StatusOK {
		return domain.Success[struct{}, domain.DomainError](struct{}{})
	}
	if status == http.StatusConflict {
		return domain.Failure[struct{}, domain.DomainError](domain.NewDomainError("INSUFFICIENT_STOCK", "Requested inventory is unavailable"))
	}
	return domain.Failure[struct{}, domain.DomainError](domain.NewDomainError("EXTERNAL_TIMEOUT", "Inventory service error"))
}

func MapPaymentHttpStatus(status int) domain.Result[struct{}, domain.DomainError] {
	if status == http.StatusOK {
		return domain.Success[struct{}, domain.DomainError](struct{}{})
	}
	if status == http.StatusPaymentRequired {
		return domain.Failure[struct{}, domain.DomainError](domain.NewDomainError("PAYMENT_DECLINED", "Payment gateway declined the charge"))
	}
	return domain.Failure[struct{}, domain.DomainError](domain.NewDomainError("EXTERNAL_TIMEOUT", "Payment service error"))
}

type InventoryGateway struct {
	driver      drivers.HttpJsonDriver
	endpointUrl string
}

func NewInventoryGateway(driver drivers.HttpJsonDriver, endpointUrl string) *InventoryGateway {
	return &InventoryGateway{driver: driver, endpointUrl: endpointUrl}
}

func (g *InventoryGateway) ReserveStock(orderId domain.OrderId, lines []domain.OrderLine) domain.Result[struct{}, domain.DomainError] {
	type reqItem struct {
		ProductId string `json:"productId"`
		Quantity  int    `json:"quantity"`
	}
	items := make([]reqItem, len(lines))
	for i, l := range lines {
		items[i] = reqItem{ProductId: l.ProductId.Value, Quantity: l.Quantity.Value}
	}
	body, _ := json.Marshal(map[string]any{"orderId": orderId.Value, "items": items})
	resp, err := g.driver.PostJson(g.endpointUrl, string(body))
	if err != nil {
		return domain.Failure[struct{}, domain.DomainError](domain.NewDomainError("EXTERNAL_TIMEOUT", "Inventory service timed out"))
	}
	defer resp.Body.Close()
	_, _ = io.ReadAll(resp.Body)
	return MapInventoryHttpStatus(resp.StatusCode)
}

type PaymentGateway struct {
	driver      drivers.HttpJsonDriver
	endpointUrl string
}

func NewPaymentGateway(driver drivers.HttpJsonDriver, endpointUrl string) *PaymentGateway {
	return &PaymentGateway{driver: driver, endpointUrl: endpointUrl}
}

func (g *PaymentGateway) Charge(orderId domain.OrderId, amount domain.Money) domain.Result[struct{}, domain.DomainError] {
	body, _ := json.Marshal(map[string]any{"orderId": orderId.Value, "amount": amount.Amount, "currency": amount.Currency})
	resp, err := g.driver.PostJson(g.endpointUrl, string(body))
	if err != nil {
		return domain.Failure[struct{}, domain.DomainError](domain.NewDomainError("EXTERNAL_TIMEOUT", "Payment service timed out"))
	}
	defer resp.Body.Close()
	_, _ = io.ReadAll(resp.Body)
	return MapPaymentHttpStatus(resp.StatusCode)
}
