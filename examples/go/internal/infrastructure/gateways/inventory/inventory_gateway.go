package inventorygw

import (
	"encoding/json"
	"io"
	"net/http"

	domainorder "example.com/ordering-go/internal/domain/entities/order"
	"example.com/ordering-go/internal/domain/shared"
	sharedvo "example.com/ordering-go/internal/domain/value_objects/shared"
	httpdrv "example.com/ordering-go/internal/infrastructure/drivers/http"
)

func MapInventoryHttpStatus(status int) shared.Result[struct{}, shared.DomainError] {
	if status == http.StatusOK {
		return shared.Success[struct{}, shared.DomainError](struct{}{})
	}
	if status == http.StatusConflict {
		return shared.Failure[struct{}, shared.DomainError](shared.NewDomainError("INSUFFICIENT_STOCK", "Requested inventory is unavailable"))
	}
	return shared.Failure[struct{}, shared.DomainError](shared.NewDomainError("EXTERNAL_TIMEOUT", "Inventory service error"))
}

type InventoryGateway struct {
	driver      httpdrv.HttpJsonDriver
	endpointUrl string
}

func NewInventoryGateway(driver httpdrv.HttpJsonDriver, endpointUrl string) *InventoryGateway {
	return &InventoryGateway{driver: driver, endpointUrl: endpointUrl}
}

func (g *InventoryGateway) ReserveStock(orderId sharedvo.OrderId, lines []domainorder.OrderLine) shared.Result[struct{}, shared.DomainError] {
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
		return shared.Failure[struct{}, shared.DomainError](shared.NewDomainError("EXTERNAL_TIMEOUT", "Inventory service timed out"))
	}
	defer resp.Body.Close()
	_, _ = io.ReadAll(resp.Body)
	return MapInventoryHttpStatus(resp.StatusCode)
}
