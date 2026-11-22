export type DomainErrorCode =
  | "INVALID_ORDER_ID"
  | "INVALID_CUSTOMER_ID"
  | "INVALID_PRODUCT_ID"
  | "INVALID_MONEY_AMOUNT"
  | "CURRENCY_MISMATCH"
  | "INVALID_QUANTITY"
  | "EMPTY_ORDER_LINES"
  | "TOO_MANY_ORDER_LINES"
  | "DUPLICATE_PRODUCT"
  | "INVALID_ORDER_STATE"
  | "INSUFFICIENT_STOCK"
  | "PAYMENT_DECLINED"
  | "EXTERNAL_TIMEOUT"
  | "REPOSITORY_ERROR"
  | "ORDER_NOT_FOUND";

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
}

export function domainError(code: DomainErrorCode, message: string): DomainError {
  return { code, message };
}
