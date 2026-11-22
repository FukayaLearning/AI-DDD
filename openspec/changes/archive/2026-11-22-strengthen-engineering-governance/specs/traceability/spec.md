# Spec Delta

## Purpose

要求・シナリオ・試験ケース・テストコード・実装を安定 ID で相互参照し、トレーサビリティマトリクスの生成と未カバー・孤立参照の機械的検出を可能にする。

## ADDED Requirements

### Requirement: Stable identifiers for requirements and scenarios
`ddd-driven` の仕様は、各 Requirement 見出しを `REQ-<CTX>-<NNN>` で、各 Scenario 見出しを親要求番号を含む `SCN-<CTX>-<NNN>-<NN>` で始め MUST する。`<CTX>` はプロジェクト設定の Bounded Context 略号とし、一度採番した ID は削除後も再利用してはならない（MUST NOT）。

#### Scenario: Spec headings carry identifiers
- **GIVEN** `ordering` コンテキスト（略号 `ORD`）の仕様
- **WHEN** 新しい要求とシナリオを追加する
- **THEN** 見出しは `### Requirement: REQ-ORD-004 <name>` と `#### Scenario: SCN-ORD-004-01 <name>` の形式となる

#### Scenario: Duplicate or malformed identifier is rejected
- **GIVEN** 同じ `SCN-` ID を持つシナリオが 2 つ、または ID のない Scenario 見出しがある
- **WHEN** `ai-ddd trace --target <dir> --check` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、重複・欠落した見出しを報告する

### Requirement: Test case and implementation annotations
試験仕様書の各ケースは `UT-<CTX>-<NNN>`（単体）または `IT-<CTX>-<NNN>`（結合）の ID と、検証対象の `REQ`/`SCN` ID または設計要素を記載 MUST する。自動テストはテスト名に試験ケース ID を含め MUST し、Application 層のユースケース実装は実現する `REQ` ID を `@implements` 注記で宣言 MUST する。

#### Scenario: Automated test references its test case
- **GIVEN** 試験仕様書に `IT-ORD-007`（`SCN-ORD-002-03` を検証）が定義されている
- **WHEN** 結合テストを実装する
- **THEN** テスト名に `IT-ORD-007` が含まれ、トレーサビリティマトリクスで `SCN-ORD-002-03` → `IT-ORD-007` → テストファイルが辿れる

### Requirement: Traceability matrix generation
CLI は `ai-ddd trace --target <dir>` で、要求 → シナリオ → 試験ケース → テストコード → 実装 の対応表を生成し `docs/traceability/matrix.md` に出力 SHALL する。`--format json` 指定時は同内容を JSON で標準出力に出力 SHALL する。生成物は手編集しない旨を明記する。

#### Scenario: Matrix lists every requirement with its coverage
- **GIVEN** ID 付きの仕様・試験仕様書・テストコード・実装を持つプロジェクト
- **WHEN** `ai-ddd trace --target <dir>` を実行する
- **THEN** `docs/traceability/matrix.md` に全 `REQ` 行が出力され、各行にシナリオ・UT/IT ケース・テストファイル・実装ファイルが列挙される

### Requirement: Traceability gap detection
`ai-ddd trace --check` は次の場合に終了コード 1 で失敗 MUST する: 結合テストケースのない Scenario、`@implements` のない Requirement、テストコードの存在しない試験ケース、存在しない ID を参照する試験ケース・テスト・注記。`ai-ddd verify` はこの検査を含め MUST する。

#### Scenario: Scenario without an integration test case
- **GIVEN** `SCN-ORD-003-02` を参照する `IT-` ケースが試験仕様書に存在しない
- **WHEN** `ai-ddd trace --target <dir> --check` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、未カバーの `SCN-ORD-003-02` を報告する

#### Scenario: Orphan reference in tests
- **GIVEN** テストコードが試験仕様書に存在しない `UT-ORD-099` を参照している
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、孤立参照のファイルと ID を報告する
