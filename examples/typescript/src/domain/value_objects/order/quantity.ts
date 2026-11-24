import { domainError, type DomainError } from "../../shared/errors.ts";
import { err, ok, type Result } from "../../shared/result.ts";

export class Quantity {
  private readonly _brand = "Quantity";
  readonly value: number;

  private constructor(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      throw new Error("Quantity must be an integer between 1 and 100");
    }
    this.value = value;
  }

  static create(value: number): Result<Quantity, DomainError> {
    if (!Number.isInteger(value)) {
      return err(domainError("INVALID_QUANTITY", "Quantity must be an integer"));
    }
    if (value < 1) {
      return err(domainError("INVALID_QUANTITY", "Quantity must be at least 1"));
    }
    if (value > 100) {
      return err(domainError("INVALID_QUANTITY", "Quantity must be at most 100"));
    }
    return ok(new Quantity(value));
  }

  equals(other: Quantity): boolean {
    return this.value === other.value;
  }
}
