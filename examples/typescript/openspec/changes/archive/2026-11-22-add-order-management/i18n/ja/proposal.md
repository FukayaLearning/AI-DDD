<!-- ai-ddd-translation: source=../../proposal.md sha256=86e938d8afd734e17f327bc551cb287e1a8e8b7813b2e44ce4539bcbf9153fb1 locale=ja -->

# 提案

## なぜ

Ordering 境界づけられたコンテキストには、注文作成、在庫引当と決済捕捉を伴う確定、キャンセル、Web UI での照会という完全な注文ライフサイクル能力が必要である。これを DDD に厳密に従ってモデル化し、C1 100% カバレッジで検証する。

## 境界づけられたコンテキストと言語

- **境界づけられたコンテキスト**: `ordering`（プラットフォーム規約: 1 リポジトリ = 1 境界づけられたコンテキスト）
- **コアドメイン**: `ordering`。`inventory` と `payment` は別リポジトリの汎用/支援サブドメイン（リポジトリ間 OpenSpec 連携は `T.B.D.`）で、腐敗防止層ポート経由でアクセスする。
- **共有カーネル**: 現時点ではなし。
- **新規/更新用語**（`docs/domain/ubiquitous-language.md` と同期）:
  - `Order`: `OrderLine` とライフサイクル（`Draft` -> `Confirmed` -> `Cancelled`）、楽観的並行性の `version` を管理する集約ルート。
  - `OrderId`, `CustomerId`, `ProductId`: 空でないことを検証する識別子 Value Object。
  - `Money`: 非負の整数最小単位金額と `Currency`（`JPY` | `USD`）。
  - `Quantity`: 1〜100 に制約された正の整数。
  - `OrderLine`: `ProductId`、`Quantity`、単価 `Money` を持つ集約内 Value Object。自身の同一性は持たない。
  - `OrderConfirmedEvent`, `OrderCancelledEvent`: 集約遷移時に記録され、保存成功後に発行されるドメインイベント。

## 何が変わるか

- 注文作成、確定（在庫・決済オーケストレーションと補償）、キャンセル（確定済みは在庫解放と返金）、詳細照会の能力を導入する。
- 分離された `DomainError` / `InfrastructureError` を用いる 4 層 DDD 実装（`domain`, `application`, `infrastructure`, `presentation`）を追加する。
- 注文作成（1〜5 明細）、照会、確定、キャンセルの Web UI を提供する。

## ケイパビリティ

### 新規ケイパビリティ
- `ordering/order-management`: 注文作成、在庫引当と決済捕捉を伴う確定、キャンセル、Web UI ライフサイクル管理。

### 変更ケイパビリティ
<!-- なし -->

## 影響

- **ドメインモデル**: `Order`, `OrderLine`, `OrderId`, `CustomerId`, `ProductId`, `Money`, `Quantity`, `OrderRepository`, `DomainError`, `InfrastructureError`。
- **アプリケーションユースケース**: `OrderApplicationService`（`placeOrder`, `confirmOrder`, `cancelOrder`, `getOrder`）と `DomainEventPublisher`。
- **インフラストラクチャ**: `OrderMapper`, `DriverOrderRepository`, `InventoryGateway`, `PaymentGateway`, `LoggingEventPublisher`, 分岐なし `drivers/`。
- **プレゼンテーション**: Web UI ルート（`GET /`, `GET /orders/:id`, `POST /orders`, `POST /orders/:id/confirm`, `POST /orders/:id/cancel`）。
- **配布/結合**: 実ファイル KV と HTTP ドライバを統合するバイナリ/プロセスサーバ起動。
