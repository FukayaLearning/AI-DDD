import { domainError, type DomainError } from "../../shared/errors.ts";
import { err, ok, type Result } from "../../shared/result.ts";

export interface Quantity {
  readonly value: number;
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
