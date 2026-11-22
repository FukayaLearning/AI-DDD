<!-- ai-ddd-translation: source=context-map.md sha256=11a5cf9ede1c7cc6850c60a74ff75a44571300d4d6938c08ae3e2fd3e1c151d6 locale=ja -->

# コンテキストマップ — ordering

- **所有する境界づけられたコンテキスト**: `ordering` (本リポジトリ: `ordering-py`)
- **リポジトリ間 OpenSpec 連携**: `T.B.D.`

## 外部コンテキストとの関係

| 上流 / 外部コンテキスト | リポジトリ | 関係 / パターン | ポート / ACL | 状態 |
| :--- | :--- | :--- | :--- | :--- |
| `inventory` | 別リポジトリ | 腐敗防止層 (Customer-Supplier) | `InventoryPort` / `InventoryGateway` | `T.B.D.` (リポジトリ間仕様連携) |
| `payment` | 別リポジトリ | 腐敗防止層 (Customer-Supplier) | `PaymentPort` / `PaymentGateway` | `T.B.D.` (リポジトリ間仕様連携) |
