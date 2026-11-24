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
  | "INVALID_ORDER_STATE";

export type InfrastructureErrorCode =
  | "INSUFFICIENT_STOCK"
  | "PAYMENT_DECLINED"
  | "EXTERNAL_TIMEOUT"
  | "REPOSITORY_ERROR"
  | "ORDER_NOT_FOUND"
  | "CONFLICT"
  | "EVENT_PUBLISH_FAILED";

export interface DomainError {
  readonly kind: "domain";
  readonly code: DomainErrorCode;
  readonly message: string;
}

export interface InfrastructureError {
  readonly kind: "infrastructure";
  readonly code: InfrastructureErrorCode;
  readonly message: string;
}

export type OrderError = DomainError | InfrastructureError;

export function domainError(code: DomainErrorCode, message: string): DomainError {
  return { kind: "domain", code, message };
}

export function infrastructureError(
  code: InfrastructureErrorCode,
  message: string
): InfrastructureError {
  return { kind: "infrastructure", code, message };
}
