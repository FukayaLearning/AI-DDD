package i18n

type OrderMessages struct {
	Locale            string
	PlaceOrderTitle   string
	PlaceOrderButton  string
	OrderPrefix       string
	CustomerLabel     string
	StatusLabel       string
	TotalLabel        string
	ConfirmButton     string
	CancelButton      string
	OrderNotFoundTitle string
	NotFoundTitle     string
	NotFoundBody      string
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
}
