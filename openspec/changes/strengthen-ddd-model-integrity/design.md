# Design

## Context

`proposal.md` の Why を参照。現状は、4 言語のリファレンス実装がレイヤ構成・Repository 分離・ACL・`Result<T, E>` では書籍のパターンに沿っている一方、集約と値オブジェクトのカプセル化、Factory の生成/再構築分離、Entity 同一性、イベントライフサイクル、確定処理の整合性境界、戦略的蒸留が不足している。`ai-ddd verify` は構造・coverage・traceability を強制するが、モデルの意味的整合性は検証しない。

制約:
- 4 言語（TypeScript, Python, Go, Rust）で同一のモデル契約を保つ。
- `domain` の外部依存ゼロ、`infrastructure/drivers/` の分岐禁止、C1 100% coverage（drivers/main 除外）を維持する。
- 各リファレンス実装は独立した OpenSpec ルートを持ち、ルート変更からは `reference-examples` capability と各実装のタスクを通じて更新する。
- 既存の `REQ-ORD-001`〜`004` の外部振る舞い（Web UI の操作と応答）は維持する。

## Goals / Non-Goals

**Goals:**
- 集約ルートと値オブジェクトのカプセル化を言語機能で強制し、外部からの不変条件破壊を不可能にする。
- 新規生成と再構築を分離し、遷移を経ない `Confirmed`/`Cancelled` 集約の生成を禁止する。
- Entity の等価性を `OrderId` の同一性で定義する。
- ドメインイベントに発行・クリアのライフサイクルを与え、集約の永続状態から切り離す。
- 確定・取消の外部副作用に補償と冪等性の方針を与え、遷移後の集約を使用する。
- Core Domain / Generic Subdomain / Distillation を文書化し、Shared Kernel の誤用と Context Map の混在表記を修正する。
- `ai-ddd verify` と `ai-ddd trace --check` にモデル整合性の検証を追加する。
- 4 言語のリファレンス実装、仕様、ドメイン文書、アーカイブを現行 schema に適合させる。

**Non-Goals:**
- 本番用の分散トランザクション基盤（Saga エンジン、メッセージブローカー、本格的な outbox）の導入。
- 新しいビジネス機能（返品、請求、顧客管理など）の追加。
- 1 Repository = 1 Bounded Context というプラットフォーム規約の撤廃（規約であることを明記するに留める）。
- Web UI のデザイン変更（複数明細入力の機能追加を除く）。

## Decisions

### 1. 言語別のカプセル化戦略

- **Go**: `domain/entities/order` と `domain/value_objects/*` の構造体フィールドを非公開化し、`NewOrder` / `RehydrateOrder` と読み取りアクセサ（`ID()`, `Status()`, `Lines()`, `Amount()`, `Currency()`）を公開する。値オブジェクトは `Equals` を実装する。
- **Rust**: 構造体フィールドを非公開化し、`pub fn` アクセサを提供する。`Order` の `PartialEq` は `id` のみで実装し、値オブジェクトは全属性の `PartialEq` を維持する。値オブジェクトのコンストラクタは `DomainResult` を返す `new` に限定する。
- **Python**: `@dataclass(frozen=True, init=False)` と `__post_init__` による検証、または非公開クラスメソッド `_create` / `reconstitute` を用いる。値オブジェクトは `__post_init__` で不変条件を検証し、`Currency` の `Literal` を実行時にも検証する。
- **TypeScript**: 値オブジェクトを `private constructor` を持つクラス、または `unique symbol` ブランドを持つ型に変更し、`create*` ファクトリのみで生成する。`Order` は既存の `private constructor` を維持し、`equals` を追加する。

**代替案**: 現行の「インタフェース＋ファクトリ関数」を維持する。→ 構造的型付けにより不正な値オブジェクトを偽造でき、不変性を型で保証できないため却下。

### 2. Factory の生成/再構築分離

- `create(...)`: 新規注文専用。`status = Draft` 固定、`version = 0` 固定、`events = []` 固定。明細の不変条件（1〜5、重複商品なし、通貨一致）を検証する。
- `reconstitute(...)`: 永続化復元専用。`id` / `customerId` / `lines` / `status` / `version`（`version >= 0`）を受け取り、明細不変条件と `version` を検証し、未発行イベント `events = []` で集約を復元する（マッパーはイベントを永続化しないため、復元時の未発行イベントは常に空）。
- マッパーの復元経路は `reconstitute` を使用する。

**代替案**: 単一ファクトリに任意の `status` / `events` を受け取る。→ 遷移を経ない `Confirmed` 集約やイベント不整合を生成できるため却下。

### 3. Entity 同一性と Value Object 等価性

- `Order` の等価性は `OrderId` のみで判定する（`equals` / `Equals` / `__eq__` / `PartialEq`）。
- 値オブジェクトの等価性は全属性で判定する（Go は `Equals`、Rust/Python は derive、TypeScript は `equals`）。
- UL の `OrderLine` は「集約内の値オブジェクト」に再分類する（識別子を持たず、商品重複は集約の不変条件で扱う）。

**代替案**: 全属性比較を維持する。→ 同一 `OrderId` の状態違いを別物と判定し、書籍第5章の Entity 同一性に反するため却下。

### 4. ドメインイベントのライフサイクル

- 集約に `pullEvents()` / `clearEvents()` を追加し、イベントを一時的な状態として扱う。
- マッパーはイベントを永続化レコードに含めない。
- Application 層に `DomainEventPublisher` ポートを追加し、`save` 成功後に発行する。参照実装の Infrastructure 実装はイベントを標準出力またはインメモリシンクへ書き込む `LoggingEventPublisher` とし、テストでは記録用モックを使う。
- 発行失敗時は `Result` で返し、再試行可能であることをテストで確認する。参照実装ではプロセス内発行のため失敗しないが、ポート契約は失敗を表現できるようにする。

**代替案 A**: 「記録のみ」を仕様・設計に明記する。→ 仕様の "emits" を満たさず、イベントが死んだデータになるため、参照実装としては発行経路を実装する。
**代替案 B**: outbox パターン。→ 参照実装の範囲を超えるため、本番導入時の選択肢として design に注記するに留める。

### 5. 確定・取消の整合性境界と補償

- 確定: `load → confirm → reserveStock → charge → save → publish` の順。外部呼び出しには**遷移後の集約**の `id` と `totalAmount()` を使用する。
- 補償: 在庫予約成功後に決済が失敗した場合、`releaseStock` を呼ぶ。決済成功後に保存が失敗した場合、`refund` を呼ぶ。取消（`Confirmed`）では `releaseStock` と `refund` を実行してから保存する。
- `InventoryPort` に `releaseStock`、`PaymentPort` に `refund` を追加する。外部呼び出しの冪等キーは `orderId` とし、スタブは同一キーの重複呼び出しを冪等に扱う。
- 補償自体の失敗はログに記録し、`Result` で呼び出し元へ返す。

**代替案**: 外部呼び出しを保存後に行う。→ `Confirmed` を先に永続化してしまい、決済失敗時に不整合な確定注文が残るため却下。

### 6. 楽観的並行性制御

- `Order` に `version` を追加し、`reconstitute` で受け取る。
- Repository の `save` は既存レコードの `version` と期待値が一致しない場合に `CONFLICT` を返す。
- 全言語で `version` を永続化レコードに含め、結合テストで並行更新の競合を検証する。

**代替案**: 単一ライター前提を維持する。→ 参照実装が並行性の単位としての集約を示せないため却下。

### 7. エラー型の分離と `totalAmount` の `Result` 化

- `DomainError` はドメイン不変条件違反のみを表す。
- `InfrastructureError`（または `ApplicationError` の判別共用体）は永続化・外部障害を表す。
- Application の戻り値は `Result<T, OrderError>`（`OrderError = DomainError | InfrastructureError`）とする。
- `totalAmount()` は `Result<Money, DomainError>` を返し、`addMoney` / `multiplyMoney`（オーバーフロー検査付き `Result`）を経由する。TS の unsafe cast を排除する。

**代替案**: 単一の `DomainError` にインフラコードを混在させる。→ 書籍第4章のドメイン隔離に反するため却下。

### 8. Presentation のドメイン知識排除と入力防御

- `Order` に `canConfirm()` / `canCancel()` を追加し、View はこれを参照する。
- Controller はフォーム値を安全に解析し、欠落・非数値を通貨/数量/金額のドメイン検証エラーとして返す（500 にしない）。
- 注文作成フォームは 1〜5 明細の動的行をサポートし、サーバは繰り返しフィールドを解析する。

**代替案**: View で `status` を直接判定する。→ 状態遷移ルールが二重管理になるため却下。

### 9. 戦略的 DDD の修正

- `ordering` を Core Domain、`inventory` / `payment` を Generic/Supporting Subdomain（外部コンテキスト）として `docs/domain/context-map.md` に明記する。
- `domain/shared/` は「同一コンテキスト内の共有コード」と表現し、Shared Kernel は「Bounded Context 間で合意するモデルサブセット」として別途定義する。現時点で該当なし（`T.B.D.`）と記録する。
- Context Map は「上流 `inventory` / `payment` → 下流 `ordering` の Customer/Supplier 関係、下流側に ACL」と分離して記述する。Conformist / Separate Ways / Published Language / Open Host Service を検討した結果も記録する。
- 1 Repository = 1 Bounded Context はプラットフォーム規約であり、Evans の普遍原則ではないと schema / README / SKILL に明記する。

### 10. スキーマ・テンプレート・スキル

- `ddd-driven` schema を `version: 4` に更新する。
- `design.md` テンプレートに「Aggregate Encapsulation」「Factory Create/Reconstitute」「Entity Identity」「Value Object Validation」「Domain Event Lifecycle」「Cross-Aggregate Consistency & Compensation」「Core Domain / Distillation」の節を追加する。
- `spec.md` instruction に、内部クラス名・エラーコード・フレームワーク名・SQL/HTTP 詳細を避ける規約を追加する。
- `tasks.md` テンプレートに、集約カプセル化・イベントライフサイクル・補償・並行性の TDD タスクを追加する。
- `skills/ddd-workflow/SKILL.md` と配布コピー（`.agents/`, `.claude/`, `.github/`, `.hermes/`）を同期する。
- README のレイヤ構成・schema バージョン表記を実体に合わせる。

### 11. `ai-ddd verify` のモデル整合性検証

言語別の保守的ヒューリスティックを実装する:
- **集約/VO カプセル化**: Go の `domain/entities` / `domain/value_objects` 配下の構造体で公開フィールドを検出、Rust の `pub` フィールドを検出、Python の値オブジェクト dataclass に `__post_init__` または非公開 `init` がない場合を検出、TypeScript の値オブジェクトが `interface` で公開されている場合を検出。
- **イベントライフサイクル**: `domain/` にイベント記録がある場合、`pullEvents` / `clearEvents` / `publish` のいずれか、または `design.md` の record-only 宣言を要求する。
- **UL 整合**: `docs/domain/ubiquitous-language.md` の用語がソースツリーの識別子として存在するかを確認する。技術用語（`Result`, `DomainError`, ポート名）は除外リストで除外する。
- 誤検知を避けるため、検出ルールは設定で無効化できるようにし、違反はファイルと行を報告する。

**代替案**: 構文解析器（AST）を導入する。→ 4 言語分のパーサ依存が増えるため、正規表現ベースの保守的検出に留める。誤検知時は設定で除外する。

### 12. `ai-ddd trace` の Scenario ↔ UseCase 1-to-1

- 各 Scenario に対応する Application 層の `UT-` ケースが存在することを要求する。
- `UT-` ケースの `scnRefs` は 1 件のみを許可する（複数 Scenario をまとめる場合は `IT-` を使用する）。
- 1-to-1 の欠落を `[Scenario/UseCase Mismatch]` として報告する。

**代替案**: Scenario ごとに複数 UT を許可する。→ 1-to-1 の保証が弱くなるため、境界値テストは同一 Scenario の複数入力として 1 つの UT にまとめるか、`IT-` で扱う。

### 13. 参照実装とアーカイブの移行

- 4 言語を同一のモデル契約に揃える。言語ごとにタスクを分け、各言語で `ai-ddd verify` / `ai-ddd trace --check` / 単体・C1・ブラウザ・結合テストを通過させる。
- アーカイブ済み変更には `test-plan.md`、`REQ-`/`SCN-` ID、`i18n/ja/` を追補する。これは参照教材の完全性のための整備であり、本番履歴の改変ではない旨を design に記録する。
- 各実装の `openspec/schemas/ddd-driven/` コピーをルートと同期し、`npm run verify:examples` のドリフト検査を通す。

## Risks / Trade-offs

- **[Risk] カプセル化により既存テストの直接構築が壊れる** → テストをファクトリ/再構築経由に書き換え、値オブジェクトの境界値テストはファクトリで検証する。
- **[Risk] イベント発行ポートの追加で DI と結合テストの配線が増える** → 参照実装ではインメモリ/ログ実装を用意し、結合テストは発行ログまたはテスト用シンクで検証する。
- **[Risk] 補償ポート（`releaseStock` / `refund`）の追加でスタブと結合テストが増える** → スタブを冪等に実装し、異常系の結合テストを追加する。
- **[Risk] `version` 追加で永続化レコードの互換性が変わる** → 参照実装のデータファイルはテスト時に再生成し、旧レコードは `version: 0` として復元するマイグレーションをマッパーに実装する。
- **[Risk] verifier の正規表現ヒューリスティックが誤検知する** → ルールを設定で無効化可能にし、参照実装で回帰テストを用意する。
- **[Risk] Scenario ↔ UseCase 1-to-1 の厳格化で既存テストの分割が必要** → 既存の複数 Scenario をまとめた UT を分割し、境界値は 1 つの Scenario 内の複数ケースとして整理する。
- **[Risk] 変更範囲が 4 言語＋スキーマ＋CLI に及び、1 変更としては大きい** → タスクを「スキーマ/CLI」「TypeScript」「Python」「Go」「Rust」「文書/アーカイブ」に分割し、1 タスク 1 コミットで進める。
- **[Risk] アーカイブ追補が履歴改変と見なされる** → 参照教材の整備であることを design と tasks に明記し、本番プロジェクトには適用しない。

## Migration Plan

1. `ddd-driven` schema を v4 に更新し、テンプレート・スキル・配布コピーを同期する。
2. `src/verifier.js` / `src/tracer.js` とプラットフォーム単体テストを更新する。
3. TypeScript 実装を新しいモデル契約へ移行し、全テストを通過させる。
4. Python、Go、Rust を順に移行する（各言語で verify/trace/テストを通過）。
5. 4 言語のドメイン文書・仕様・設計・アーカイブ・トレーサビリティを更新する。
6. `npm run verify:examples` と `npm test` を実行し、全体のドリフトと回帰を確認する。

ロールバック: 各タスクは独立コミットとし、問題時は該当コミットを revert する。schema v4 から v3 への戻しは `ai-ddd install-schema` で旧版を再配置できるが、テンプレート変更を含むため参照実装も同時に revert する。
