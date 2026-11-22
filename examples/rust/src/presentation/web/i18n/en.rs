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
};
