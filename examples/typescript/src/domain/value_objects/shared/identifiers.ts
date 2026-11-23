import { domainError, type DomainError } from "../../shared/errors.ts";
import { err, ok, type Result } from "../../shared/result.ts";

export interface OrderId {
  readonly value: string;
}

export interface CustomerId {
  readonly value: string;
}

export interface ProductId {
  readonly value: string;
}

export function createOrderId(raw: string): Result<OrderId, DomainError> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return err(domainError("INVALID_ORDER_ID", "OrderId must not be empty"));
  }
  return ok({ value: trimmed });
}

export function createCustomerId(raw: string): Result<CustomerId, DomainError> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return err(domainError("INVALID_CUSTOMER_ID", "CustomerId must not be empty"));
  }
  return ok({ value: trimmed });
}

export function createProductId(raw: string): Result<ProductId, DomainError> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return err(domainError("INVALID_PRODUCT_ID", "ProductId must not be empty"));
  }
  return ok({ value: trimmed });
}
