package sharedvo

import "example.com/ordering-go/internal/domain/shared"

type Currency string

const (
	CurrencyJPY Currency = "JPY"
	CurrencyUSD Currency = "USD"
)

type Money struct {
	Amount   int64
	Currency Currency
}

// QuantityLike is the structural shape of the order Quantity value object,
// allowing shared Money arithmetic without depending on the order aggregate.
type QuantityLike interface{ GetValue() int }

func CreateMoney(amount int64, currency Currency) shared.Result[Money, shared.DomainError] {
	if amount < 0 {
		return shared.Failure[Money, shared.DomainError](shared.NewDomainError("INVALID_MONEY_AMOUNT", "Money amount must be non-negative"))
	}
	if currency != CurrencyJPY && currency != CurrencyUSD {
		return shared.Failure[Money, shared.DomainError](shared.NewDomainError("CURRENCY_MISMATCH", "Unsupported currency"))
	}
	return shared.Success[Money, shared.DomainError](Money{Amount: amount, Currency: currency})
}

func MultiplyMoney(m Money, quantity QuantityLike) Money {
	return Money{Amount: m.Amount * int64(quantity.GetValue()), Currency: m.Currency}
}

func AddMoney(left, right Money) shared.Result[Money, shared.DomainError] {
	if left.Currency != right.Currency {
		return shared.Failure[Money, shared.DomainError](shared.NewDomainError("CURRENCY_MISMATCH", "Cannot add Money with different currencies"))
	}
	return shared.Success[Money, shared.DomainError](Money{Amount: left.Amount + right.Amount, Currency: left.Currency})
}
