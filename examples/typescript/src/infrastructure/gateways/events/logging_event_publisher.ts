import type { DomainEventPublisher } from "../../../application/ports/events/domain_event_publisher.ts";
import type { DomainEvent } from "../../../domain/entities/order/order.ts";
import type { InfrastructureError } from "../../../domain/shared/errors.ts";
import { ok, type Result } from "../../../domain/shared/result.ts";

export class LoggingEventPublisher implements DomainEventPublisher {
  async publish(events: readonly DomainEvent[]): Promise<Result<void, InfrastructureError>> {
    for (const event of events) {
      console.log(`DOMAIN_EVENT ${JSON.stringify(event)}`);
    }
    return ok(undefined);
  }
}
