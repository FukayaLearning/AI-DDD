import { domainError, type DomainError } from "../../shared/errors.ts";
import { err, ok, type Result } from "../../shared/result.ts";

export class OrderId {
  private readonly _brand = "OrderId";
  readonly value: string;

  private constructor(value: string) {
    if (value.length === 0) throw new Error("OrderId must not be empty");
    this.value = value;
  }

  static create(raw: string): Result<OrderId, DomainError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return err(domainError("INVALID_ORDER_ID", "OrderId must not be empty"));
    }
    return ok(new OrderId(trimmed));
  }

  equals(other: OrderId): boolean {
    return this.value === other.value;
  }
}

export class CustomerId {
  private readonly _brand = "CustomerId";
  readonly value: string;

  private constructor(value: string) {
    if (value.length === 0) throw new Error("CustomerId must not be empty");
    this.value = value;
  }

  static create(raw: string): Result<CustomerId, DomainError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return err(domainError("INVALID_CUSTOMER_ID", "CustomerId must not be empty"));
    }
    return ok(new CustomerId(trimmed));
  }

  equals(other: CustomerId): boolean {
    return this.value === other.value;
  }
}

export class ProductId {
  private readonly _brand = "ProductId";
  readonly value: string;

  private constructor(value: string) {
    if (value.length === 0) throw new Error("ProductId must not be empty");
    this.value = value;
  }

  static create(raw: string): Result<ProductId, DomainError> {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return err(domainError("INVALID_PRODUCT_ID", "ProductId must not be empty"));
    }
    return ok(new ProductId(trimmed));
  }

  equals(other: ProductId): boolean {
    return this.value === other.value;
  }
}
