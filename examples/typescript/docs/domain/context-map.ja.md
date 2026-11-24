<!-- ai-ddd-translation: source=context-map.md sha256=28c2c083527e9bb713ccad3620b9a303a7972a6113aa0db29b6907855b56cc5b locale=ja -->

# コンテキストマップ — ordering

- **所有する境界づけられたコンテキスト**: `ordering` (本リポジトリ: `ordering-ts`)
- **コアドメイン**: `ordering` — 注文ライフサイクル、不変条件、確定ポリシーが差別化要素である。
- **汎用 / 支援サブドメイン**: `inventory` と `payment` は別リポジトリが所有する外部コンテキストである。
- **共有カーネル**: 現時点ではなし。将来のコンテキスト間共有モデルはチーム間で明示的に合意し、ここに記録する。
- **リポジトリ間 OpenSpec 連携**: `T.B.D.`

## 外部コンテキストとの関係

| 上流 / 外部コンテキスト | リポジトリ | 関係 | 下流側パターン | ポート / ACL | 状態 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `inventory` | 別リポジトリ | Customer/Supplier（`inventory` が上流、`ordering` が下流） | 腐敗防止層 | `InventoryPort` (`application/ports/inventory/`) / `InventoryGateway` (`infrastructure/gateways/inventory/`) | `T.B.D.` (リポジトリ間仕様連携) |
| `payment` | 別リポジトリ | Customer/Supplier（`payment` が上流、`ordering` が下流） | 腐敗防止層 | `PaymentPort` (`application/ports/payment/`) / `PaymentGateway` (`infrastructure/gateways/payment/`) | `T.B.D.` (リポジトリ間仕様連携) |

## 関係パターンの決定

- **腐敗防止層を採用**: 外部モデル（在庫引当・決済捕捉）を `ordering` モデルへ漏らさないため、gateway が HTTP ステータスとペイロードを `InfrastructureError` に変換する。
- **順応者（Conformist）を却下**: 注文ライフサイクルを在庫・決済 API に従属させない。
- **別々の道（Separate Ways）を却下**: 確定には在庫引当と決済捕捉が必要である。
- **公表された言語 / 公開ホストサービス**: `T.B.D.`。外部コンテキストが安定した公開プロトコルを提供する場合、ACL 変換の一部を置き換えられる。
