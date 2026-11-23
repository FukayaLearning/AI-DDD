import { domainError, type DomainError } from "../../shared/errors.ts";
import { err, ok, type Result } from "../../shared/result.ts";

export type Currency = "JPY" | "USD";

export interface Money {
  readonly amount: number;
  readonly currency: Currency;
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

export function multiplyMoney(money: Money, quantity: { readonly value: number }): Money {
  return { amount: money.amount * quantity.value, currency: money.currency };
}

export function addMoney(left: Money, right: Money): Result<Money, DomainError> {
  if (left.currency !== right.currency) {
    return err(domainError("CURRENCY_MISMATCH", "Cannot add Money with different currencies"));
  }
  return ok({ amount: left.amount + right.amount, currency: left.currency });
}
