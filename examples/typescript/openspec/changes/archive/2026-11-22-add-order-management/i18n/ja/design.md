<!-- ai-ddd-translation: source=../../design.md sha256=ca2c42bea52cd12e9d994482f3162c240cee9d6381a0b2605232d91203797bb4 locale=ja -->

# 設計

## 戦略的 DDD 整合

- **境界づけられたコンテキスト**: `ordering`
- **コアドメイン**: `ordering`。`inventory` / `payment` は別リポジトリの汎用/支援サブドメイン。
- **蒸留**: 注文ライフサイクルと不変条件が差別化要素であり、外部コンテキストは ACL ポートの背後に隔離する。
- **ユビキタス言語**: `docs/domain/ubiquitous-language.md` と同期。
- **コンテキストマップ**: `docs/domain/context-map.md` と同期（Customer/Supplier の方向と下流 ACL。リポジトリ間 OpenSpec 連携は `T.B.D.`）。
- **共有カーネル**: 現時点ではなし。`domain/shared/` は同一コンテキスト内の共有コードであり、Shared Kernel ではない。

## 戦術的ドメインモデル（`domain/`）

- **値オブジェクト**: `OrderId`, `CustomerId`, `ProductId`, `Money`, `Quantity`。すべて不変・自己検証的で、不正な直接構築を拒否する。
- **エンティティと集約ルート**: `Order` 集約ルート（`Draft` | `Confirmed` | `Cancelled`）。`OrderLine` は集約内 Value Object。不変条件: 1〜5 明細、商品重複なし、通貨一致、`Draft` からのみ確定、`Cancelled` の再取消禁止。
- **集約のカプセル化**: 状態は非公開。振る舞いと読み取り専用アクセサのみ公開する。
- **Factory の分離**: `Order.create` は `Draft`・version 0・イベント空で新規生成。`Order.reconstitute` は永続状態を受け取り不変条件を検証する。
- **Entity 同一性**: `Order` の等価性は `OrderId` のみ。値オブジェクトは属性等価。
- **値オブジェクト検証**: コンストラクタとファクトリで不変条件を検証し、偽造された明細値も拒否する。
- **ドメインイベント**: `OrderConfirmedEvent`, `OrderCancelledEvent`。`pullEvents()` / `clearEvents()` で一時的なライフサイクルを持つ。
- **イベントライフサイクル**: 保存成功後に `DomainEventPublisher` で発行し、マッパーは一時イベントを永続化しない。
- **集約横断の整合性と補償**: 確定は在庫引当→決済→保存→発行。失敗時は在庫解放または返金。確定済み取消は在庫解放と返金を行ってから保存。`orderId` を冪等キーとする。
- **楽観的並行性**: `Order.version` を永続化し、古い保存を `CONFLICT` で拒否する。
- **ポート**: `OrderRepository`、`InventoryPort`、`PaymentPort`、`DomainEventPublisher`。
- **エラーモデリング**: `DomainError`（不変条件違反）と `InfrastructureError`（永続化/外部障害）を分離し、`Result<T, OrderError>` を返す。

## 4 層アーキテクチャとインフラ 3 分割

- **依存ルール**: `presentation -> application -> domain <- infrastructure`。`presentation` は `infrastructure` を import しない。`main.ts` が DI を配線する。
- **インフラ分割**:
  1. **純粋マッパー**: `toRecord` / `fromRecord`。イベントは永続化しない。
  2. **分岐なしドライバ**: 生のファイル KV と HTTP POST のみ。
  3. **DI リポジトリ/ゲートウェイ**: 欠落キー、破損 JSON、version 競合、タイムアウト、在庫不足、決済拒否、イベント発行を `Result` で扱う。
- **プレゼンテーション**: `OrderUseCases` を DI し、純粋なビュー関数で描画。Mock + Headless Chromium で検証する。

## 単体テスト除外と C1 100%

- **除外外**: 100% C1 ブランチカバレッジ必須。
- **インライン無視**: 禁止。
- **許可された除外**: `src/infrastructure/drivers/**`、`src/main.ts`（結合テストで検証）。

## 配布と結合テスト計画

- **配布形態**: `binary`（単体 Node.js プロセス）。
- **結合検証**: 在庫/決済スタブと実 `src/main.ts` を使い、1〜5 明細の作成→確定→取消、補償、version 永続化を検証する。
