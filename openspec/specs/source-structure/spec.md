# source-structure Specification

## Purpose
DDD の Layer-first 4 層構造を維持したまま、各層内部を集約・ユースケース・外部コンテキスト・技術単位のモジュールに細分化し、ファイル数が増えても構造が保たれることを静的に検証する。

## Requirements

### Requirement: Module-subdivided layer layout
`ai-ddd init` が生成するスケルトンおよびリファレンスサンプルは、各層の内部を次のモジュール単位に分割 SHALL する: `domain` は `shared`（Shared Kernel）と集約ごと、`application` は集約ごとに `commands` / `queries`、`infrastructure` は `drivers/<technology>`・`persistence/<aggregate>`・`acl/<external-context>`、`presentation` は配信チャネルとリソースごと。

#### Scenario: Generated skeleton follows module layout
- **GIVEN** 任意の言語・配布形態の組み合わせ
- **WHEN** `ai-ddd init ... --yes` を実行する
- **THEN** 生成されたソースは `domain/shared/`・`domain/<aggregate>/`・`application/<aggregate>/commands/`・`application/<aggregate>/queries/`・`infrastructure/drivers/<technology>/`・`infrastructure/persistence/<aggregate>/`・`presentation/<channel>/<resource>/` に配置され、`ai-ddd verify` が成功する

### Requirement: No loose files at layer roots
`ai-ddd verify` は、`domain`・`application`・`infrastructure`・`presentation` の各層ルート直下に置かれたソースファイル（言語のモジュール宣言ファイルを除く）を構造違反として報告 MUST する。

#### Scenario: File placed directly under a layer root
- **GIVEN** `domain` 層ルート直下に集約の実装ファイルが置かれている
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、該当ファイルと配置すべきモジュール種別を報告する

### Requirement: Aggregate module isolation
`domain` 層の集約モジュールは自モジュールと `domain/shared` のみに依存 MUST し、`ai-ddd verify` は他の集約モジュールへの直接依存を違反として報告 MUST する。集約間の参照は識別子の値オブジェクトを `shared` に置いて行う。

#### Scenario: Aggregate imports another aggregate
- **GIVEN** `domain/order/` 内のファイルが `domain/customer/` のファイルを参照している
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、参照元・参照先モジュールを報告する

### Requirement: Directory size warning
`ai-ddd verify` は、1 ディレクトリ直下のソースファイル数がプロジェクト設定の閾値（既定 15）を超えた場合に、さらなる細分化を促す警告を出力 SHALL する。警告のみでは終了コードを失敗にしない。

#### Scenario: Module grows beyond the threshold
- **GIVEN** `application/order/commands/` に 16 個のソースファイルがある
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** 警告としてディレクトリ名とファイル数が出力され、他に違反がなければ終了コード 0 で終了する
