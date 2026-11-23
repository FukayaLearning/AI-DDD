# Design

## Context

`proposal.md` に記載の通り、現行のフォルダ構成では `domain/order/` の中に集約ルート・内部エンティティ・ドメインイベント・リポジトリインターフェースが混在し、`domain/shared/value_objects.ts` に全値オブジェクトが集約されていた。また `application`・`infrastructure`・`presentation` の各層も「集約が先か、役割パターンが先か」が層ごとに不統一であった。

エリック・エヴァンスの『ドメイン駆動設計』第 4 章〜第 6 章におけるレイヤ化アーキテクチャと戦術的パターン（Entities, Value Objects, Services, Repositories, Factories）をコードツリー上で直感的に表現するため、全 4 層を「**第 1 階層＝レイヤ、第 2 階層＝DDD 戦術的パターン／役割、第 3 階層＝集約／モジュール**」の統一 3 階層アーキテクチャに再設計する。

## Goals / Non-Goals

**Goals:**
- 全 4 層のディレクトリ階層を `<layer>/<tactical-pattern>/<aggregate-or-module>/` に統一する。
- `ai-ddd verify` により、第 1・第 2 階層の許可フォルダ名、直下ファイルの禁止、およびパターンフォルダを跨いだ集約間の直接依存禁止を静的に強制する。
- 4 言語（TypeScript, Python, Go, Rust）の `ai-ddd init` スケルトンおよび `examples/{typescript,python,go,rust}/` を新レイアウトへ移行し、C1 100% カバレッジ・Mock×Playwright テスト・結合テスト・トレーサビリティ・翻訳検証をすべて維持する。

**Non-Goals:**
- ドメインモデルの振る舞い・不変条件・HTTP エンドポイント仕様（`REQ-ORD-001`〜`004`）自体の変更は行わない。
- 1 リポジトリ＝1 境界づけられたコンテキストの戦略的原則は変更しない。

## Decisions

### 1. 統一 3 階層フォルダ構成（Layer -> Tactical Pattern -> Aggregate/Module）

```text
<src-or-internal>/
+-- domain/
|   +-- entities/
|   |   +-- <aggregate>/          # 集約ルート・内部エンティティ・ファクトリメソッド・ドメインイベント
|   +-- value_objects/
|   |   +-- shared/               # 他集約からも参照される識別子ID (OrderId, CustomerId, ProductId) や共通VO (Money, Currency)
|   |   +-- <aggregate>/          # 集約固有の値オブジェクト (Quantity, OrderStatus 等)
|   +-- services/
|   |   +-- <aggregate>/          # ドメインサービス（状態を持たない複数オブジェクト間のドメイン操作）
|   +-- repositories/
|   |   +-- <aggregate>/          # リポジトリインターフェース (OrderRepository)
|   +-- shared/                   # Result<T, E>, DomainError 等のドメイン層共通基底のみ
|
+-- application/
|   +-- services/
|   |   +-- <aggregate>/          # アプリケーションサービス (OrderApplicationService)
|   +-- ports/
|   |   +-- <external-or-shared>/ # 外部コンテキスト連携用ポート抽象 (InventoryPort, PaymentPort)
|   +-- dtos/
|       +-- <aggregate>/          # 入出力コマンド・DTO (PlaceOrderCommand, OrderSummaryDto)
|
+-- infrastructure/
|   +-- repositories/
|   |   +-- <aggregate>/          # リポジトリ実装 (DriverOrderRepository) - DriverをDI受け取りResultへ変換
|   +-- gateways/
|   |   +-- <external-context>/   # 外部コンテキストACL実装 (InventoryGateway, PaymentGateway)
|   +-- mappers/
|   |   +-- <aggregate-or-ext>/   # 副作用なしの純粋変換関数 (order_mapper, inventory_mapper, payment_mapper)
|   +-- drivers/
|       +-- <technology>/         # 分岐ゼロの生I/Oドライバ (kv_driver, http_driver) - C1除外対象
|
+-- presentation/
    +-- controllers/
    |   +-- <resource>/           # HTTPルーティング・リクエスト解釈・UseCase呼び出し (order_controller)
    +-- views/
    |   +-- <resource>/           # HTML SSR テンプレート・レンダリング純粋関数 (order_view)
    +-- i18n/                     # 多言語メッセージカタログ (en, ja 等; 直下または <resource>/ 配下)
```

- **理由**:
  - どの層を開いてもまず「DDD／レイヤ内の役割パターン（entities, value_objects, services, repositories / services, ports, dtos / repositories, gateways, mappers, drivers / controllers, views, i18n）」が目に入り、その下に「集約／モジュール名」が並ぶため、認知負荷が最小化される。
  - `domain/repositories/<aggregate>/` と `infrastructure/repositories/<aggregate>/`、`application/ports/<ext>/` と `infrastructure/gateways/<ext>/` の対称性が明確になる。
  - `infrastructure/mappers/` を独立させたことで、「副作用なしの純粋変換関数」と「ドライバを DI して例外／ステータスを `Result<T, E>` に写像する Repository / Gateway 実装」という Infrastructure 3 分割の責務境界がフォルダ構造そのもので強制される。
  - `presentation` も `controllers/` と `views/` に分かれることで、エリック・エヴァンス本第 4 章の MVC（モデル／ビュー分離）に忠実になる。

### 2. `ai-ddd verify` における静的構造検証アルゴリズム（`src/verifier.js`）

1. **第 2 階層パターンフォルダのホワイトリスト検証**:
   - 各層の直下ディレクトリ `parts[0]` が以下の集合に含まれるかを検査する。
     - `domain`: `new Set(["entities", "value_objects", "services", "repositories", "shared"])`
     - `application`: `new Set(["services", "ports", "dtos"])`
     - `infrastructure`: `new Set(["repositories", "gateways", "mappers", "drivers"])`
     - `presentation`: `new Set(["controllers", "views", "i18n"])`
   - 含まれない場合は `[Unauthorized Pattern Folder]` エラーを報告する。
2. **第 1 階層・第 2 階層の直下ファイル禁止**:
   - 第 1 階層（`parts.length === 1`）に置かれたソースファイル（`mod.rs`, `lib.rs`, `__init__.py` を除く）は `[Loose Layer File]` エラーとする。
   - 第 2 階層（`parts.length === 2`）のうち、`domain/shared` と `presentation/i18n` 以外に直接置かれたソースファイル（`mod.rs`, `__init__.py` を除く）は `[Loose Pattern File]` エラーとし、第 3 階層（`<aggregate>` / `<external-context>` / `<technology>` / `<resource>`）のサブフォルダ配下に置くことを強制する。
3. **パターン横断の集約モジュール独立性検証**:
   - `domain/{entities,value_objects,services,repositories}/<selfAgg>/` 内のファイルが `domain/<anyPattern>/<otherAgg>/` をインポートしている場合、`<otherAgg>` が `<selfAgg>` でも `"shared"` でもなければ `[Aggregate Isolation Violation]` エラーとする。
   - これにより、`order` 集約が `domain/entities/order/`・`domain/value_objects/order/`・`domain/repositories/order/` に分かれていても、同じ `order` 集約内の相互参照と `domain/shared/`・`domain/value_objects/shared/` の参照のみが許可され、他集約（`customer` 等）への直接依存は確実にブロックされる。

### 3. スキーマバージョンとプロジェクト設定の互換性

- `schemas/ddd-driven/schema.yaml` の `version` を `2` から `3` に更新する。
- `ai-ddd init` が生成する `ai-ddd.config.json` の `schemaVersion` は引き続き `2` 以上（または `3`）とし、`strictV2` 以上のプロジェクトで上記の新フォルダ検証を有効化する。

## Risks / Trade-offs

- **[Risk] Go 言語におけるパッケージ循環参照と公開識別子** → Go ではディレクトリごとに別パッケージ（`package order` 等）となるため、`internal/domain/entities/order`・`internal/domain/value_objects/order`・`internal/domain/repositories/order` の間の依存方向を一方向（`value_objects/shared` <- `value_objects/order` <- `entities/order` <- `repositories/order`）に保つ。これにより Go のパッケージ循環参照を完全に回避できる。
- **[Risk] Rust における `mod.rs` の階層増加** → 第 2 階層（`entities/mod.rs` 等）と第 3 階層（`entities/order/mod.rs` 等）に `pub mod` を配置する。`MODULE_DECLARATION_FILES`（`mod.rs`, `lib.rs`, `__init__.py`）は直下ファイル禁止ルールから除外されているため問題なく機能する。
- **[Risk] 既存 `examples/*` の翻訳スタンプ更新漏れ** → `examples/*` の `design.md` やテスト仕様書内のファイルパス記載を更新した際、`ai-ddd i18n stamp` を全翻訳ファイルに対して実行し、`ai-ddd verify` でハッシュ一致を確認する。
