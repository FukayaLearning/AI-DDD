<!-- ai-ddd-translation: source=ubiquitous-language.md sha256=b2a8bfa0a4ff110577d05d6d2742d6f86f1565c1d5a2ca53e4b918e27148a172 locale=ja -->

# ユビキタス言語 — ordering

> 単一境界づけられたコンテキストリポジトリ: **ordering-ts** (`ordering`, `ORD`)
> ここに定義されたすべての用語は OpenSpec 仕様、ドメインコード、テストの識別子と一致させること。

| Term (English Identifier) | ドメイン上の意味 | 層 / パターン | 備考 |
| :--- | :--- | :--- | :--- |
| `Result<T, E>` | 明示的な成功 (`Ok`) または型付き失敗 (`Err`) | Domain Shared | `domain/shared/result.ts`。想定されるエラーはすべて値として返す |
| `Order` | 顧客注文を表す集約ルート | Domain Entity | `domain/entities/order/`。状態: `Draft`, `Confirmed`, `Cancelled` |
| `OrderLine` | 注文内の単一商品明細 | Domain Entity | `domain/entities/order/`。`ProductId`, `Quantity`, 単価 `Money` を保持 |
| `OrderId` | `Order` の一意識別子 | Domain Shared VO | `domain/value_objects/shared/`。空でないトリム済み文字列 |
| `CustomerId` | 注文顧客の識別子 | Domain Shared VO | `domain/value_objects/shared/`。空でないトリム済み文字列 |
| `ProductId` | 注文商品の識別子 | Domain Shared VO | `domain/value_objects/shared/`。`Order` 内で一意 |
| `Money` | 整数最小単位の金額 + `Currency` (`JPY` / `USD`) | Domain Shared VO | `domain/value_objects/shared/`。非負、演算時は同一通貨を強制 |
| `Quantity` | 注文明細の数量 | Domain Order VO | `domain/value_objects/order/`。`1..100` の整数 |
| `OrderConfirmedEvent` | `Draft -> Confirmed` 遷移時に発行されるイベント | Domain Order Event | `domain/entities/order/`。`orderId` と `totalAmount` を含む |
| `OrderCancelledEvent` | `Cancelled` 遷移時に発行されるイベント | Domain Order Event | `domain/entities/order/`。`orderId` と `previousStatus` を含む |
| `OrderRepository` | `Order` 集約の永続化ポート | Domain Order Repository Port | `domain/repositories/order/` で宣言し、`infrastructure/repositories/order/` で実装 |
| `InventoryPort` | 商品在庫を引き当てる ACL ポート | Application Port | `application/ports/inventory/` で宣言し、`infrastructure/gateways/inventory/` で実装 |
| `PaymentPort` | 決済を実行する ACL ポート | Application Port | `application/ports/payment/` で宣言し、`infrastructure/gateways/payment/` で実装 |
| `DomainError` | すべてのドメイン/インフラ障害の判別共用体 | Domain Shared Error | `domain/shared/errors.ts`。`Result.Err` 内で返却 |
