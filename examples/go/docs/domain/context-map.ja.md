<!-- ai-ddd-translation: source=context-map.md sha256=1f06a8ae1176b87b73379877fcd851cca229c67035d5b908c5fb508da5ac92df locale=ja -->

# コンテキストマップ — ordering

- **所有する境界づけられたコンテキスト**: `ordering` (本リポジトリ: `ordering-go`)
- **リポジトリ間 OpenSpec 連携**: `T.B.D.`

## 外部コンテキストとの関係

| 上流 / 外部コンテキスト | リポジトリ | 関係 / パターン | ポート / ACL | 状態 |
| :--- | :--- | :--- | :--- | :--- |
| `inventory` | 別リポジトリ | 腐敗防止層 (Customer-Supplier) | `InventoryPort` / `InventoryGateway` | `T.B.D.` (リポジトリ間仕様連携) |
| `payment` | 別リポジトリ | 腐敗防止層 (Customer-Supplier) | `PaymentPort` / `PaymentGateway` | `T.B.D.` (リポジトリ間仕様連携) |
