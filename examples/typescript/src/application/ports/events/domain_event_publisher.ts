import type { DomainEvent } from "../../../domain/entities/order/order.ts";
import type { InfrastructureError } from "../../../domain/shared/errors.ts";
import type { Result } from "../../../domain/shared/result.ts";

export interface DomainEventPublisher {
  publish(events: readonly DomainEvent[]): Promise<Result<void, InfrastructureError>>;
}
