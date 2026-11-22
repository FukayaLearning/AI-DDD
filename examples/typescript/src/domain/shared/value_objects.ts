import { domainError, type DomainError } from "./errors.ts";
import { err, ok, type Result } from "./result.ts";

export type Currency = "JPY" | "USD";

export interface OrderId {
  readonly value: string;
}

export interface CustomerId {
  readonly value: string;
}

export interface ProductId {
  readonly value: string;
}

export interface Quantity {
  readonly value: number;
}

export interface Money {
  readonly amount: number;
  readonly currency: Currency;
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

export function createQuantity(value: number): Result<Quantity, DomainError> {
  if (!Number.isInteger(value)) {
    return err(domainError("INVALID_QUANTITY", "Quantity must be an integer"));
  }
  if (value < 1) {
    return err(domainError("INVALID_QUANTITY", "Quantity must be at least 1"));
  }
  if (value > 100) {
    return err(domainError("INVALID_QUANTITY", "Quantity must be at most 100"));
  }
  return ok({ value });
}

export function createMoney(amount: number, currency: Currency): Result<Money, DomainError> {
  if (!Number.isInteger(amount)) {
    return err(domainError("INVALID_MONEY_AMOUNT", "Money amount must be an integer"));
  }
  if (amount < 0) {
    return err(domainError("INVALID_MONEY_AMOUNT", "Money amount must be non-negative"));
  }
  return ok({ amount, currency });
}

export function multiplyMoney(money: Money, quantity: Quantity): Money {
  return { amount: money.amount * quantity.value, currency: money.currency };
}

export function addMoney(left: Money, right: Money): Result<Money, DomainError> {
  if (left.currency !== right.currency) {
    return err(domainError("CURRENCY_MISMATCH", "Cannot add Money with different currencies"));
  }
  return ok({ amount: left.amount + right.amount, currency: left.currency });
}
