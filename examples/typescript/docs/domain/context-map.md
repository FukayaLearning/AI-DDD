# Context Map — ordering

- **Owned Bounded Context**: `ordering` (this repository: `ordering-ts`)
- **Core Domain**: `ordering` — order lifecycle, invariants, and confirmation policy are the differentiating domain.
- **Generic / Supporting Subdomains**: `inventory` and `payment` are external contexts owned by separate repositories.
- **Shared Kernel**: none currently; any future cross-context model subset must be agreed explicitly between teams and recorded here.
- **Cross-Repository OpenSpec Federation**: `T.B.D.`

## External Context Relationships

| Upstream / External Context | Repository | Relationship | Downstream Pattern | Domain Port / ACL | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `inventory` | Separate Repository | Customer/Supplier (`inventory` upstream, `ordering` downstream) | Anti-Corruption Layer | `InventoryPort` (`application/ports/inventory/`) / `InventoryGateway` (`infrastructure/gateways/inventory/`) | `T.B.D.` (cross-repo spec sync) |
| `payment` | Separate Repository | Customer/Supplier (`payment` upstream, `ordering` downstream) | Anti-Corruption Layer | `PaymentPort` (`application/ports/payment/`) / `PaymentGateway` (`infrastructure/gateways/payment/`) | `T.B.D.` (cross-repo spec sync) |

## Relationship Decisions

- **Anti-Corruption Layer chosen** because the external models (stock reservation, payment capture) must not leak into the `ordering` model; the gateway translates HTTP status and payloads into `InfrastructureError` values.
- **Conformist rejected** because the ordering lifecycle must not be constrained by inventory or payment APIs.
- **Separate Ways rejected** because confirmation requires stock reservation and payment capture.
- **Published Language / Open Host Service**: `T.B.D.`; if the external contexts expose a stable public protocol, it can replace part of the ACL translation.
