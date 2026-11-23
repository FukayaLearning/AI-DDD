package i18n

type OrderMessages struct {
	Locale             string
	PlaceOrderTitle    string
	PlaceOrderButton   string
	OrderPrefix        string
	CustomerLabel      string
	StatusLabel        string
	TotalLabel         string
	ConfirmButton      string
	CancelButton       string
	OrderNotFoundTitle string
	NotFoundTitle      string
	NotFoundBody       string
	ErrorMessages      map[string]string
}

var EnMessages = OrderMessages{
	Locale:             "en",
	PlaceOrderTitle:    "Place Order",
	PlaceOrderButton:   "Place Order",
	OrderPrefix:        "Order",
	CustomerLabel:      "Customer",
	StatusLabel:        "Status",
	TotalLabel:         "Total",
	ConfirmButton:      "Confirm Order",
	CancelButton:       "Cancel Order",
	OrderNotFoundTitle: "Order Not Found",
	NotFoundTitle:      "Not Found",
	NotFoundBody:       "Page Not Found",
	ErrorMessages: map[string]string{
		"INVALID_ORDER_ID":     "Order ID must not be empty",
		"INVALID_CUSTOMER_ID":  "Customer ID must not be empty",
		"INVALID_PRODUCT_ID":   "Product ID must not be empty",
		"INVALID_QUANTITY":     "Quantity must be between 1 and 100",
		"INVALID_MONEY_AMOUNT": "Amount must be non-negative",
		"CURRENCY_MISMATCH":    "Currency mismatch",
		"EMPTY_ORDER_LINES":    "Order must contain at least one line",
		"TOO_MANY_ORDER_LINES": "Order cannot exceed five lines",
		"DUPLICATE_PRODUCT":    "Duplicate product in order",
		"INVALID_ORDER_STATE":  "Invalid order state transition",
		"ORDER_NOT_FOUND":      "Order not found",
		"REPOSITORY_ERROR":     "Failed to access order storage",
		"INSUFFICIENT_STOCK":   "Insufficient stock",
		"PAYMENT_DECLINED":     "Payment was declined",
		"EXTERNAL_TIMEOUT":     "External service is unavailable",
	},
}
