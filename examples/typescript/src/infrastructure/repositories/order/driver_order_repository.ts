import { infrastructureError, type InfrastructureError } from "../../../domain/shared/errors.ts";
import type { Order } from "../../../domain/entities/order/order.ts";
import type { OrderRepository } from "../../../domain/repositories/order/order_repository.ts";
import { err, ok, type Result } from "../../../domain/shared/result.ts";
import type { OrderId } from "../../../domain/value_objects/shared/identifiers.ts";
import type { KeyValueStorageDriver } from "../../drivers/kv/kv_driver.ts";
import { fromOrderRecord, toOrderRecord, type OrderRecord } from "../../mappers/order/order_mapper.ts";

export class DriverOrderRepository implements OrderRepository {
  private readonly driver: KeyValueStorageDriver;

  constructor(driver: KeyValueStorageDriver) {
    this.driver = driver;
  }

  async save(order: Order): Promise<Result<void, InfrastructureError>> {
    let raw: string | null = null;
    try {
      raw = await this.driver.get(order.id.value);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "ENOENT") {
        return err(infrastructureError("REPOSITORY_ERROR", "Failed to read order before save"));
      }
    }

    let existing: OrderRecord | null = null;
    if (raw !== null) {
      try {
        existing = JSON.parse(raw) as OrderRecord;
      } catch {
        return err(infrastructureError("REPOSITORY_ERROR", "Corrupted order payload in storage"));
      }
    }

    if (existing) {
      const existingVersion = typeof existing.version === "number" ? existing.version : 0;
      if (existingVersion !== order.version) {
        return err(
          infrastructureError(
            "CONFLICT",
            `Version conflict: expected ${order.version}, found ${existingVersion}`
          )
        );
      }
    }

    const next: OrderRecord = { ...toOrderRecord(order), version: order.version + 1 };
    try {
      await this.driver.put(order.id.value, JSON.stringify(next));
      return ok(undefined);
    } catch {
      return err(infrastructureError("REPOSITORY_ERROR", "Failed to save order to storage"));
    }
  }

  async findById(orderId: OrderId): Promise<Result<Order, InfrastructureError>> {
    let raw: string;
    try {
      raw = await this.driver.get(orderId.value);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "ENOENT") {
        return err(infrastructureError("ORDER_NOT_FOUND", `Order not found: ${orderId.value}`));
      }
      return err(infrastructureError("REPOSITORY_ERROR", "Failed to read order from storage"));
    }

    let parsed: OrderRecord;
    try {
      parsed = JSON.parse(raw) as OrderRecord;
    } catch {
      return err(infrastructureError("REPOSITORY_ERROR", "Corrupted order payload in storage"));
    }

    return fromOrderRecord(parsed);
  }
}
