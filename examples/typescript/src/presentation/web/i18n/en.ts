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
};
