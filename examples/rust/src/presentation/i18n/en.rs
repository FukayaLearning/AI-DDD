pub struct OrderMessages {
    pub locale: &'static str,
    pub place_order_title: &'static str,
    pub place_order_button: &'static str,
    pub order_prefix: &'static str,
    pub customer_label: &'static str,
    pub status_label: &'static str,
    pub total_label: &'static str,
    pub confirm_button: &'static str,
    pub cancel_button: &'static str,
    pub order_not_found_title: &'static str,
    pub not_found_title: &'static str,
    pub not_found_body: &'static str,
    pub error_messages: &'static [(&'static str, &'static str)],
}

impl OrderMessages {
    pub fn error_message(&self, code: &str) -> Option<&'static str> {
        self.error_messages
            .iter()
            .find(|(c, _)| *c == code)
            .map(|(_, message)| *message)
    }
}

pub const EN_MESSAGES: OrderMessages = OrderMessages {
    locale: "en",
    place_order_title: "Place Order",
    place_order_button: "Place Order",
    order_prefix: "Order",
    customer_label: "Customer",
    status_label: "Status",
    total_label: "Total",
    confirm_button: "Confirm Order",
    cancel_button: "Cancel Order",
    order_not_found_title: "Order Not Found",
    not_found_title: "Not Found",
    not_found_body: "Page Not Found",
    error_messages: &[
        ("INVALID_ORDER_ID", "Order ID must not be empty"),
        ("INVALID_CUSTOMER_ID", "Customer ID must not be empty"),
        ("INVALID_PRODUCT_ID", "Product ID must not be empty"),
        ("INVALID_QUANTITY", "Quantity must be between 1 and 100"),
        ("INVALID_MONEY_AMOUNT", "Amount must be non-negative"),
        ("CURRENCY_MISMATCH", "Currency mismatch"),
        ("EMPTY_ORDER_LINES", "Order must contain at least one line"),
        ("TOO_MANY_ORDER_LINES", "Order cannot exceed five lines"),
        ("DUPLICATE_PRODUCT", "Duplicate product in order"),
        ("INVALID_ORDER_STATE", "Invalid order state transition"),
        ("ORDER_NOT_FOUND", "Order not found"),
        ("REPOSITORY_ERROR", "Failed to access order storage"),
        ("INSUFFICIENT_STOCK", "Insufficient stock"),
        ("PAYMENT_DECLINED", "Payment was declined"),
        ("EXTERNAL_TIMEOUT", "External service is unavailable"),
    ],
};
