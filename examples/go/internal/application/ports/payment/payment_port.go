package paymentport

import (
	"example.com/ordering-go/internal/domain/shared"
	sharedvo "example.com/ordering-go/internal/domain/value_objects/shared"
)

type PaymentPort interface {
	Charge(orderId sharedvo.OrderId, amount sharedvo.Money) shared.Result[struct{}, shared.DomainError]
}
