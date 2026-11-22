import { domainError, type DomainError } from "../../../domain/shared/errors.ts";
import type { Order } from "../../../domain/order/order.ts";
import type { OrderRepository } from "../../../domain/order/order_repository.ts";
import { err, ok, type Result } from "../../../domain/shared/result.ts";
import type { OrderId } from "../../../domain/shared/value_objects.ts";
import type { KeyValueStorageDriver } from "../../drivers/kv/kv_driver.ts";
import { fromOrderRecord, toOrderRecord, type OrderRecord } from "./order_mapper.ts";

export class DriverOrderRepository implements OrderRepository {
  private readonly driver: KeyValueStorageDriver;

  constructor(driver: KeyValueStorageDriver) {
    this.driver = driver;
  }

  async save(order: Order): Promise<Result<void, DomainError>> {
    const payload = JSON.stringify(toOrderRecord(order));
    try {
      await this.driver.put(order.id.value, payload);
      return ok(undefined);
    } catch {
      return err(domainError("REPOSITORY_ERROR", "Failed to save order to storage"));
    }
  }

  async findById(orderId: OrderId): Promise<Result<Order, DomainError>> {
    let raw: string;
    try {
      raw = await this.driver.get(orderId.value);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "ENOENT") {
        return err(domainError("ORDER_NOT_FOUND", `Order not found: ${orderId.value}`));
      }
      return err(domainError("REPOSITORY_ERROR", "Failed to read order from storage"));
    }

    let parsed: OrderRecord;
    try {
      parsed = JSON.parse(raw) as OrderRecord;
    } catch {
      return err(domainError("REPOSITORY_ERROR", "Corrupted order payload in storage"));
    }

    return fromOrderRecord(parsed);
  }
}
