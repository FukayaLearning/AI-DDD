package ordervo

import "example.com/ordering-go/internal/domain/shared"

type Quantity struct{ Value int }

func (q Quantity) GetValue() int { return q.Value }

func CreateQuantity(value int) shared.Result[Quantity, shared.DomainError] {
	if value < 1 {
		return shared.Failure[Quantity, shared.DomainError](shared.NewDomainError("INVALID_QUANTITY", "Quantity must be at least 1"))
	}
	if value > 100 {
		return shared.Failure[Quantity, shared.DomainError](shared.NewDomainError("INVALID_QUANTITY", "Quantity must be at most 100"))
	}
	return shared.Success[Quantity, shared.DomainError](Quantity{Value: value})
}
