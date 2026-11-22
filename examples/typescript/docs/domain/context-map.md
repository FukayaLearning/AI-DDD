# Context Map — ordering

- **Owned Bounded Context**: `ordering` (this repository: `ordering-ts`)
- **Cross-Repository OpenSpec Federation**: `T.B.D.`

## External Context Relationships

| Upstream / External Context | Repository | Relationship / Pattern | Domain Port / ACL | Status |
| :--- | :--- | :--- | :--- | :--- |
| `inventory` | Separate Repository | Anti-Corruption Layer (Customer-Supplier) | `InventoryPort` / `InventoryGateway` | `T.B.D.` (cross-repo spec sync) |
| `payment` | Separate Repository | Anti-Corruption Layer (Customer-Supplier) | `PaymentPort` / `PaymentGateway` | `T.B.D.` (cross-repo spec sync) |
