<!-- ai-ddd-translation: source=context-map.md sha256=95612cbb718f5c5bb56b743008671f5db6db95718b30e4a5d7c1562c5af504a6 locale=ja -->

# コンテキストマップ — ordering

- **所有する境界づけられたコンテキスト**: `ordering` (本リポジトリ: `ordering-rs`)
- **リポジトリ間 OpenSpec 連携**: `T.B.D.`

## 外部コンテキストとの関係

| 上流 / 外部コンテキスト | リポジトリ | 関係 / パターン | ポート / ACL | 状態 |
| :--- | :--- | :--- | :--- | :--- |
| `inventory` | 別リポジトリ | 腐敗防止層 (Customer-Supplier) | `InventoryPort` (`application/ports/inventory/`) / `InventoryGateway` (`infrastructure/gateways/inventory/`) | `T.B.D.` (リポジトリ間仕様連携) |
| `payment` | 別リポジトリ | 腐敗防止層 (Customer-Supplier) | `PaymentPort` (`application/ports/payment/`) / `PaymentGateway` (`infrastructure/gateways/payment/`) | `T.B.D.` (リポジトリ間仕様連携) |
