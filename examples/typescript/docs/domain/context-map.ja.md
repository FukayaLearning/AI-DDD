<!-- ai-ddd-translation: source=context-map.md sha256=559ebef7150b4af4296f7048533b187629b787a0a4b89f53a4fc8868f10414e3 locale=ja -->

# コンテキストマップ — ordering

- **所有する境界づけられたコンテキスト**: `ordering` (本リポジトリ: `ordering-ts`)
- **リポジトリ間 OpenSpec 連携**: `T.B.D.`

## 外部コンテキストとの関係

| 上流 / 外部コンテキスト | リポジトリ | 関係 / パターン | ポート / ACL | 状態 |
| :--- | :--- | :--- | :--- | :--- |
| `inventory` | 別リポジトリ | 腐敗防止層 (Customer-Supplier) | `InventoryPort` (`application/ports/inventory/`) / `InventoryGateway` (`infrastructure/gateways/inventory/`) | `T.B.D.` (リポジトリ間仕様連携) |
| `payment` | 別リポジトリ | 腐敗防止層 (Customer-Supplier) | `PaymentPort` (`application/ports/payment/`) / `PaymentGateway` (`infrastructure/gateways/payment/`) | `T.B.D.` (リポジトリ間仕様連携) |
