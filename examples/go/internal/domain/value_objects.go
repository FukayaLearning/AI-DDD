package domain

import "strings"

type Currency string

const (
	CurrencyJPY Currency = "JPY"
	CurrencyUSD Currency = "USD"
)

type OrderId struct{ Value string }
type CustomerId struct{ Value string }
type ProductId struct{ Value string }
type Quantity struct{ Value int }
type Money struct {
	Amount   int64
	Currency Currency
}

func CreateOrderId(raw string) Result[OrderId, DomainError] {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return Failure[OrderId, DomainError](NewDomainError("INVALID_ORDER_ID", "OrderId must not be empty"))
	}
	return Success[OrderId, DomainError](OrderId{Value: trimmed})
}

func CreateCustomerId(raw string) Result[CustomerId, DomainError] {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return Failure[CustomerId, DomainError](NewDomainError("INVALID_CUSTOMER_ID", "CustomerId must not be empty"))
	}
	return Success[CustomerId, DomainError](CustomerId{Value: trimmed})
}

func CreateProductId(raw string) Result[ProductId, DomainError] {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return Failure[ProductId, DomainError](NewDomainError("INVALID_PRODUCT_ID", "ProductId must not be empty"))
	}
	return Success[ProductId, DomainError](ProductId{Value: trimmed})
}

func CreateQuantity(value int) Result[Quantity, DomainError] {
	if value < 1 {
		return Failure[Quantity, DomainError](NewDomainError("INVALID_QUANTITY", "Quantity must be at least 1"))
	}
	if value > 100 {
		return Failure[Quantity, DomainError](NewDomainError("INVALID_QUANTITY", "Quantity must be at most 100"))
	}
	return Success[Quantity, DomainError](Quantity{Value: value})
}

func CreateMoney(amount int64, currency Currency) Result[Money, DomainError] {
	if amount < 0 {
		return Failure[Money, DomainError](NewDomainError("INVALID_MONEY_AMOUNT", "Money amount must be non-negative"))
	}
	if currency != CurrencyJPY && currency != CurrencyUSD {
		return Failure[Money, DomainError](NewDomainError("CURRENCY_MISMATCH", "Unsupported currency"))
	}
	return Success[Money, DomainError](Money{Amount: amount, Currency: currency})
}

func MultiplyMoney(m Money, q Quantity) Money {
	return Money{Amount: m.Amount * int64(q.Value), Currency: m.Currency}
}

func AddMoney(left, right Money) Result[Money, DomainError] {
	if left.Currency != right.Currency {
		return Failure[Money, DomainError](NewDomainError("CURRENCY_MISMATCH", "Cannot add Money with different currencies"))
	}
	return Success[Money, DomainError](Money{Amount: left.Amount + right.Amount, Currency: left.Currency})
}
