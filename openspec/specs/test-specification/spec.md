# test-specification Specification

## Purpose
設計段階で試験計画を立案し、結合テスト仕様書（正常系＋体系的に導出した異常系）と単体テスト仕様書を維持することで、カバレッジ達成ではなく仕様・設計の検証をテストの目的とする。

## Requirements

### Requirement: Test plan artifact at design time
`ddd-driven` の変更は、`specs` と `design` の完了後かつ `tasks` の前に `test-plan.md` を作成 MUST する。試験計画は、対象範囲、試験レベル（単体・結合）、試験環境、開始・終了条件、非機能試験の要否、および本変更で追加・変更・廃止する試験ケース ID の一覧を含め MUST する。

#### Scenario: Tasks are blocked until the test plan exists
- **GIVEN** `proposal`・`specs`・`design` が完了し `test-plan.md` が未作成の変更
- **WHEN** `openspec status --change <name>` を実行する
- **THEN** `test-plan` が作成可能（ready）、`tasks` が未解決依存（blocked）として表示される

### Requirement: Integration test specification with normal-path cases
各 capability の結合テスト仕様書は、すべての Scenario について、GIVEN を前提条件、WHEN を操作手順、THEN を期待結果とする正常系 `IT-` ケースを 1 件以上定義 MUST する。各ケースは利用者が観測できる振る舞い（画面・応答・永続化結果）を期待結果として記載する。

#### Scenario: Scenario becomes an integration test case
- **GIVEN** `SCN-ORD-001-01`（有効な下書き注文の作成）
- **WHEN** 結合テスト仕様書を作成する
- **THEN** 前提条件・操作手順・期待結果がシナリオの GIVEN/WHEN/THEN と対応する `IT-` ケースが存在し、配布形態の実バイナリ／コンテナ／ライブラリに対して実行される

### Requirement: Systematic abnormal-path derivation
結合テスト仕様書は capability ごとに異常系導出チェックリスト（入力値の境界・不正値、不正な状態遷移、外部依存の障害〈タイムアウト・拒否・利用不可〉、永続化障害、重複・競合操作、対象未存在、ロケール別表示）の全項目について、`IT-` ケースを定義するか、非該当理由を明記 MUST する。各ケースには適用した試験設計技法を記載する。

#### Scenario: Unaddressed checklist item is rejected
- **GIVEN** 結合テスト仕様書で「外部依存の障害」項目にケースも非該当理由も記載されていない
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、未対応のチェックリスト項目と仕様書ファイルを報告する

#### Scenario: External dependency failure is tested end-to-end
- **GIVEN** 決済サービスが拒否応答を返すよう設定した結合テスト環境
- **WHEN** 利用者が下書き注文を確定する
- **THEN** 結合テストは画面にエラーが表示され注文が `Draft` のまま保存されていることを検証する

### Requirement: Unit test specification per design element
単体テスト仕様書は、層・モジュールごとに設計要素（値オブジェクト、集約の不変条件と状態遷移、マッパー、ゲートウェイのエラー変換、Presentation の分岐）を列挙し、各 `UT-` ケースについて試験設計技法・入力・期待結果・期待結果の根拠（対応する `REQ`/`SCN` または設計判断）を記載 MUST する。

#### Scenario: Unit test case documents its rationale
- **GIVEN** `Quantity` 値オブジェクト（1..100）
- **WHEN** 単体テスト仕様書を作成する
- **THEN** 境界値分析により 0・1・100・101 を入力とする `UT-` ケースが、期待結果と根拠となる要求 ID とともに記載される

### Requirement: Coverage as an exit criterion, not the objective
試験計画の終了条件は、全試験ケースの合格、トレーサビリティ検査の合格、C1 100% の 3 条件をすべて含め MUST する。試験仕様書に対応しないテスト（ケース ID を持たないテスト）は、カバレッジ計上の有無にかかわらず違反として報告 MUST する。

#### Scenario: Coverage-only test without a test case ID
- **GIVEN** 分岐を通過させるだけでケース ID を持たない単体テストが存在する
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、試験仕様書に紐付かないテストを報告する
