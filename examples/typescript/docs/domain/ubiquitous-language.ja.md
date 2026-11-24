<!-- ai-ddd-translation: source=ubiquitous-language.md sha256=1e4a96224d3b7885d69737154b6ac2db5fc1b467a05140c902d992557c207e60 locale=ja -->

# ユビキタス言語 — ordering

> 単一境界づけられたコンテキストリポジトリ: **ordering-ts** (`ordering`, `ORD`)
> 以下のドメイン用語は OpenSpec 仕様、ドメインコード、テストの識別子と一致させること。

## ドメイン用語

| Term (English Identifier) | ドメイン上の意味 | 層 / パターン | 備考 |
| :--- | :--- | :--- | :--- |
| `Order` | 顧客注文を表す集約ルート | Domain Entity | `domain/entities/order/`。状態: `Draft`, `Confirmed`, `Cancelled`。楽観的並行性のための `version` を持つ |
| `OrderLine` | 注文内の単一商品明細 | 集約内 Value Object | `domain/entities/order/`。`ProductId`, `Quantity`, 単価 `Money` を保持。自身の同一性は持たない |
| `OrderId` | `Order` の一意識別子 | Domain Shared VO | `domain/value_objects/shared/`。空でないトリム済み文字列 |
| `CustomerId` | 注文顧客の識別子 | Domain Shared VO | `domain/value_objects/shared/`。空でないトリム済み文字列 |
| `ProductId` | 注文商品の識別子 | Domain Shared VO | `domain/value_objects/shared/`。`Order` 内で一意 |
| `Money` | 整数最小単位の金額 + `Currency` (`JPY` / `USD`) | Domain Shared VO | `domain/value_objects/shared/`。非負、演算時は同一通貨とオーバーフローを検査 |
| `Quantity` | 注文明細の数量 | Domain Order VO | `domain/value_objects/order/`。`1..100` の整数 |
| `OrderStatus` | `Order` のライフサイクル状態 | Domain Order VO | `Draft` / `Confirmed` / `Cancelled` |
| `Currency` | 通貨 | Domain Shared VO | `JPY` / `USD` |
| `OrderConfirmedEvent` | `Draft -> Confirmed` 遷移時に記録されるイベント | Domain Order Event | `orderId` と `totalAmount` を含む |
| `OrderCancelledEvent` | `Cancelled` 遷移時に記録されるイベント | Domain Order Event | `orderId` と `previousStatus` を含む |

## 技術用語（ドメイン専門家の語彙ではない）

- `Result<T, E>`: 全層で使う明示的な成功または型付き失敗の値。
- `DomainError`: ドメイン不変条件の違反。
- `InfrastructureError`: 永続化または外部サービス障害。
- `OrderError`: `DomainError` と `InfrastructureError` の判別共用体。
- `OrderRepository`: ドメインが所有する永続化ポート。
- `InventoryPort` / `PaymentPort`: 外部コンテキスト連携用の Application ポート（ACL）。
- `DomainEventPublisher`: 引き出したドメインイベントを発行する Application ポート。
- `OrderSummaryDto` / `PlaceOrderCommand`: Application DTO。
