# Tasks

## 1. `ddd-driven` スキーマ v4 と配布スキルの更新

- [x] 1.1 `schemas/ddd-driven/schema.yaml` を `version: 4` に更新し、`design.md` テンプレートへ集約カプセル化・Factory 生成/再構築分離・Entity 同一性・値オブジェクト自己検証・ドメインイベントライフサイクル・集約横断の補償/結果整合・Core Domain/Distillation の節を追加し、`spec.md` instruction に実装詳細排除規約を追加し、`tasks.md` テンプレートにモデル整合性 TDD を追加する
- [x] 1.2 `skills/ddd-workflow/SKILL.md` および `.agents/`・`.claude/`・`.github/`・`.hermes/` 配下の配布スキルを更新し、Shared Kernel の定義修正、1 Repository = 1 Bounded Context がプラットフォーム規約である旨、戦略的蒸留、モデル整合性規約を反映する
- [x] 1.3 `openspec schema validate ddd-driven` を実行し、スキーマと 5 テンプレートが有効であることを確認する

## 2. `ai-ddd verify` / `ai-ddd trace` のモデル整合性検証

- [x] 2.1 `src/verifier.js` に集約/値オブジェクトのカプセル化、ドメインイベントライフサイクル、ユビキタス言語と識別子の一致の静的検証を追加し、誤検知を設定で無効化できるようにする
- [x] 2.2 `src/tracer.js` に Scenario ↔ Application UseCase の 1-to-1 対応検証を追加し、`UT-` ケースが複数 Scenario を参照する場合の違反を報告する
- [x] 2.3 `tests/` 配下のプラットフォーム単体テストに、新規検証の正常系・異常系ケースを追加し、`npm test` で通過することを確認する

## 3. TypeScript リファレンス実装のモデル整合性強化

- [x] 3.1 ドメイン層を更新する: 値オブジェクトをブランド型またはクラス化して構造的偽造を防ぎ、`Order.create` と `Order.reconstitute` を分離し、`equals` を `OrderId` で実装し、`pullEvents` / `clearEvents` を追加し、`totalAmount` を `Result` 化し、`DomainError` と `InfrastructureError` を分離し、`version` を追加する。対応する `UT-` テストを先に書き、100% C1 coverage を確認する
- [ ] 3.2 アプリケーション層を更新する: `DomainEventPublisher` ポートを追加し、`save` 成功後の発行とイベントクリアを実装し、確定/取消で遷移後の集約を使用し、`releaseStock` / `refund` による補償と冪等キーを実装する。Scenario ごとの 1-to-1 `UT-` テストを追加する
- [ ] 3.3 インフラストラクチャ層を更新する: マッパーからイベント永続化を除去し、`reconstitute` を使用し、`version` を含むレコードと競合検出を実装し、`LoggingEventPublisher` と補償用 gateway メソッドを追加する。モックドライバで異常系を含む `UT-` テストを追加する
- [ ] 3.4 Presentation 層を更新する: `canConfirm` / `canCancel` を参照し、入力解析の失敗を `Result` チャネルに乗せ、1〜5 明細の動的フォームを実装する。Mock × Playwright のブラウザテストを更新し、100% C1 coverage を確認する
- [ ] 3.5 `docs/domain/ubiquitous-language.md`・`context-map.md`・仕様・設計・トレーサビリティ・アーカイブ（`test-plan.md`、`REQ-`/`SCN-` ID、`i18n/ja/`）を更新し、`ai-ddd verify --target examples/typescript` と `ai-ddd trace --target examples/typescript --check` および全テストを通過させる

## 4. Python リファレンス実装のモデル整合性強化

- [ ] 4.1 ドメイン層を更新する: 値オブジェクトの `__post_init__` 検証と通貨の実行時検証、`Order.create` / `reconstitute` の分離、`__eq__` の `OrderId` 限定、`pull_events` / `clear_events`、`total_amount` の `Result` 化、エラー型分離、`version` 追加を実装し、`UT-` テストと 100% C1 coverage を確認する
- [ ] 4.2 アプリケーション層を更新する: `DomainEventPublisher` ポート、`save` 後の発行とクリア、遷移後の集約使用、`release_stock` / `refund` 補償、冪等キーを実装し、Scenario ごとの 1-to-1 `UT-` テストを追加する
- [ ] 4.3 インフラストラクチャ層を更新する: イベント永続化の除去、`reconstitute` 使用、`version` と競合検出、`LoggingEventPublisher`、補償 gateway を実装し、モックドライバの異常系 `UT-` テストを追加する
- [ ] 4.4 Presentation 層を更新する: `can_confirm` / `can_cancel`、安全な入力解析（`KeyError`/`ValueError` を 500 にしない）、1〜5 明細の動的フォームを実装し、ブラウザテストと 100% C1 coverage を確認する
- [ ] 4.5 ドメイン文書・仕様・設計・トレーサビリティ・アーカイブを更新し、`ai-ddd verify --target examples/python` と `trace --check` および全テストを通過させる

## 5. Go リファレンス実装のモデル整合性強化

- [ ] 5.1 ドメイン層を更新する: 集約・値オブジェクトのフィールド非公開化とアクセサ、`NewOrder` / `RehydrateOrder` の分離、`Equals` の `OrderId` 限定、`PullEvents` / `ClearEvents`、`TotalAmount` の `Result` 化、エラー型分離、`Version` 追加を実装し、`UT-` テストと 100% C1 coverage を確認する
- [ ] 5.2 アプリケーション層を更新する: `DomainEventPublisher` ポート、`Save` 後の発行とクリア、遷移後の集約使用、`ReleaseStock` / `Refund` 補償、冪等キーを実装し、Scenario ごとの 1-to-1 `UT-` テストを追加する
- [ ] 5.3 インフラストラクチャ層を更新する: イベント永続化の除去、`RehydrateOrder` 使用、`Version` と競合検出、`LoggingEventPublisher`、補償 gateway を実装し、モックドライバの異常系 `UT-` テストを追加する
- [ ] 5.4 Presentation 層を更新する: `CanConfirm` / `CanCancel`、入力解析エラーの `Result` 化、1〜5 明細の動的フォームを実装し、ブラウザテストと 100% C1 coverage を確認する
- [ ] 5.5 ドメイン文書・仕様・設計・トレーサビリティ・アーカイブを更新し、`ai-ddd verify --target examples/go` と `trace --check` および全テストを通過させる

## 6. Rust リファレンス実装のモデル整合性強化

- [ ] 6.1 ドメイン層を更新する: 集約・値オブジェクトのフィールド非公開化とアクセサ、`Order::create` / `Order::reconstitute` の分離、`PartialEq` の `id` 限定、`pull_events` / `clear_events`、`total_amount` の `DomainResult` 化、エラー型分離、`version` 追加を実装し、`UT-` テストと 100% C1 coverage を確認する
- [ ] 6.2 アプリケーション層を更新する: `DomainEventPublisher` ポート、`save` 後の発行とクリア、遷移後の集約使用、`release_stock` / `refund` 補償、冪等キーを実装し、Scenario ごとの 1-to-1 `UT-` テストを追加する
- [ ] 6.3 インフラストラクチャ層を更新する: イベント永続化の除去、`reconstitute` 使用、`version` と競合検出、`LoggingEventPublisher`、補償 gateway を実装し、モックドライバの異常系 `UT-` テストを追加する
- [ ] 6.4 Presentation 層を更新する: `can_confirm` / `can_cancel`、安全な入力解析（通貨の無言補正を廃止）、1〜5 明細の動的フォームを実装し、ブラウザテストと 100% C1 coverage を確認する
- [ ] 6.5 ドメイン文書・仕様・設計・トレーサビリティ・アーカイブを更新し、`ai-ddd verify --target examples/rust` と `trace --check` および全テストを通過させる

## 7. プラットフォーム文書・アーカイブ整合と全体検証

- [ ] 7.1 `README.md` のレイヤ構成・schema バージョン表記を実体（`version: 4`、`application/{services,ports,dtos}`、`infrastructure/{repositories,gateways,mappers,drivers}`）に合わせ、1 Repository = 1 Bounded Context がプラットフォーム規約である旨を明記する
- [ ] 7.2 4 言語のアーカイブ済み変更に `test-plan.md`、`REQ-`/`SCN-` ID、`i18n/ja/` を追補し、現行 schema v4 に適合させる（参照教材の整備であり、本番履歴の改変ではない）
- [ ] 7.3 各実装の `openspec/schemas/ddd-driven/` コピーをルートと同期し、`npm run verify:examples` でドリフトがないことを確認する
- [ ] 7.4 `npm test` と `npm run verify:examples` を実行し、全スイート・全リファレンス実装・トレーサビリティ・翻訳検証がエラーなしで通過することを確認する
