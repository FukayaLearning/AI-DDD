export interface OrderMessages {
  readonly locale: string;
  readonly placeOrderTitle: string;
  readonly placeOrderButton: string;
  readonly orderPrefix: string;
  readonly customerLabel: string;
  readonly statusLabel: string;
  readonly totalLabel: string;
  readonly confirmButton: string;
  readonly cancelButton: string;
  readonly orderNotFoundTitle: string;
  readonly notFoundTitle: string;
  readonly notFoundBody: string;
  readonly errorMessages: Readonly<Record<string, string>>;
}

export const enMessages: OrderMessages = {
  locale: "en",
  placeOrderTitle: "Place Order",
  placeOrderButton: "Place Order",
  orderPrefix: "Order",
  customerLabel: "Customer",
  statusLabel: "Status",
  totalLabel: "Total",
  confirmButton: "Confirm Order",
  cancelButton: "Cancel Order",
  orderNotFoundTitle: "Order Not Found",
  notFoundTitle: "Not Found",
  notFoundBody: "Page Not Found",
  errorMessages: {
    INVALID_ORDER_ID: "Order ID must not be empty",
    INVALID_CUSTOMER_ID: "Customer ID must not be empty",
    INVALID_PRODUCT_ID: "Product ID must not be empty",
    INVALID_QUANTITY: "Quantity must be between 1 and 100",
    INVALID_MONEY_AMOUNT: "Amount must be non-negative",
    CURRENCY_MISMATCH: "Currency mismatch",
    EMPTY_ORDER_LINES: "Order must contain at least one line",
    TOO_MANY_ORDER_LINES: "Order cannot exceed five lines",
    DUPLICATE_PRODUCT: "Duplicate product in order",
    INVALID_ORDER_STATE: "Invalid order state transition",
    ORDER_NOT_FOUND: "Order not found",
    REPOSITORY_ERROR: "Failed to access order storage",
    INSUFFICIENT_STOCK: "Insufficient stock",
    PAYMENT_DECLINED: "Payment was declined",
    EXTERNAL_TIMEOUT: "External service is unavailable",
    CONFLICT: "The order was modified concurrently",
    EVENT_PUBLISH_FAILED: "Domain events could not be published",
  },
};
