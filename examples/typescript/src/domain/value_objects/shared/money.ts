import { domainError, type DomainError } from "../../shared/errors.ts";
import { err, ok, type Result } from "../../shared/result.ts";

export type Currency = "JPY" | "USD";

export class Money {
  private readonly _brand = "Money";
  readonly amount: number;
  readonly currency: Currency;

  private constructor(amount: number, currency: Currency) {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error("Money amount must be a non-negative integer");
    }
    if (currency !== "JPY" && currency !== "USD") {
      throw new Error("Unsupported currency");
    }
    this.amount = amount;
    this.currency = currency;
  }

  static zero(currency: Currency): Money {
    return new Money(0, currency);
  }

  static create(amount: number, currency: Currency): Result<Money, DomainError> {
    if (currency !== "JPY" && currency !== "USD") {
      return err(domainError("CURRENCY_MISMATCH", "Unsupported currency"));
    }
    if (!Number.isInteger(amount)) {
      return err(domainError("INVALID_MONEY_AMOUNT", "Money amount must be an integer"));
    }
    if (amount < 0) {
      return err(domainError("INVALID_MONEY_AMOUNT", "Money amount must be non-negative"));
    }
    return ok(new Money(amount, currency));
  }

  add(other: Money): Result<Money, DomainError> {
    if (this.currency !== other.currency) {
      return err(domainError("CURRENCY_MISMATCH", "Cannot add Money with different currencies"));
    }
    const sum = this.amount + other.amount;
    if (!Number.isSafeInteger(sum)) {
      return err(domainError("INVALID_MONEY_AMOUNT", "Money addition overflow"));
    }
    return ok(new Money(sum, this.currency));
  }

  multiply(quantity: { readonly value: number }): Result<Money, DomainError> {
    const product = this.amount * quantity.value;
    if (!Number.isSafeInteger(product)) {
      return err(domainError("INVALID_MONEY_AMOUNT", "Money multiplication overflow"));
    }
    return ok(new Money(product, this.currency));
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}

export function createMoney(amount: number, currency: Currency): Result<Money, DomainError> {
  return Money.create(amount, currency);
}

export function addMoney(left: Money, right: Money): Result<Money, DomainError> {
  return left.add(right);
}

export function multiplyMoney(
  money: Money,
  quantity: { readonly value: number }
): Result<Money, DomainError> {
  return money.multiply(quantity);
}
