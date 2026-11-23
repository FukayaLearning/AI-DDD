package sharedvo

import (
	"strings"

	"example.com/ordering-go/internal/domain/shared"
)

type OrderId struct{ Value string }
type CustomerId struct{ Value string }
type ProductId struct{ Value string }

func CreateOrderId(raw string) shared.Result[OrderId, shared.DomainError] {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return shared.Failure[OrderId, shared.DomainError](shared.NewDomainError("INVALID_ORDER_ID", "OrderId must not be empty"))
	}
	return shared.Success[OrderId, shared.DomainError](OrderId{Value: trimmed})
}

func CreateCustomerId(raw string) shared.Result[CustomerId, shared.DomainError] {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return shared.Failure[CustomerId, shared.DomainError](shared.NewDomainError("INVALID_CUSTOMER_ID", "CustomerId must not be empty"))
	}
	return shared.Success[CustomerId, shared.DomainError](CustomerId{Value: trimmed})
}

func CreateProductId(raw string) shared.Result[ProductId, shared.DomainError] {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return shared.Failure[ProductId, shared.DomainError](shared.NewDomainError("INVALID_PRODUCT_ID", "ProductId must not be empty"))
	}
	return shared.Success[ProductId, shared.DomainError](ProductId{Value: trimmed})
}
