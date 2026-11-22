# Spec Delta

## Purpose

英語をマスター言語とした上で、ユーザー指定言語の翻訳成果物（仕様書・設計書・試験仕様書・ドメイン文書）と Web UI 表示言語を管理し、翻訳の陳腐化を検出できるようにする。

## ADDED Requirements

### Requirement: Project locale configuration
`ai-ddd` で初期化されたプロジェクトは、マスター言語を常に英語（`en`）とし、ユーザー指定言語（ロケールコード）をプロジェクト設定ファイルに 1 つ記録 SHALL する。ユーザー言語未指定時は `en` とみなす。

#### Scenario: Locale is recorded at initialization
- **GIVEN** 空のターゲットディレクトリ
- **WHEN** `ai-ddd init --locale ja ... --yes` を実行する
- **THEN** プロジェクト設定にマスター言語 `en` とユーザー言語 `ja` が記録され、生成された `AGENTS.md` と OpenSpec 設定の context に「成果物は英語マスターで作成し `ja` 翻訳を併置する」旨が記載される

#### Scenario: Default locale is English only
- **GIVEN** `--locale` を指定しない初期化
- **WHEN** 初期化が完了する
- **THEN** ユーザー言語は `en` として記録され、翻訳ファイルは要求されない

### Requirement: Translated artifacts alongside English masters
ユーザー言語が `en` 以外の場合、ワークフローは英語マスターごとに翻訳ファイルを作成 MUST する。変更内成果物（`proposal`・`specs`・`design`・`test-plan`）は変更ディレクトリ内の `i18n/<locale>/` に同じ相対パスで、永続文書（メイン仕様・`docs/domain/`・試験仕様書）は同じディレクトリに `<basename>.<locale>.md` として置く。翻訳は ID・識別子・GIVEN/WHEN/THEN 構造をマスターと一致させ MUST する。

#### Scenario: Japanese translation is created for each change artifact
- **GIVEN** ユーザー言語 `ja` のプロジェクトで変更の `proposal.md` と `specs/<context>/<capability>/spec.md` が作成された
- **WHEN** 成果物作成ステップが完了する
- **THEN** 変更ディレクトリに `i18n/ja/proposal.md` と `i18n/ja/specs/<context>/<capability>/spec.md` が存在し、Requirement / Scenario の ID と英語識別子がマスターと一致する

#### Scenario: Persistent documents keep sibling translations
- **GIVEN** ユーザー言語 `ja` のプロジェクトで変更がアーカイブされメイン仕様が更新された
- **WHEN** 翻訳同期ステップが完了する
- **THEN** `openspec/specs/<context>/<capability>/spec.ja.md` と `docs/domain/ubiquitous-language.ja.md` がマスターと同じディレクトリに存在し、最新マスターのハッシュを記録している

#### Scenario: OpenSpec validation ignores translation files
- **GIVEN** マスター `spec.md` と翻訳 `spec.ja.md` を含む変更
- **WHEN** `openspec validate --strict` を実行する
- **THEN** マスター仕様のみが検証対象となり、翻訳ファイルによる重複・形式エラーは発生しない

### Requirement: Stale translation detection
各翻訳ファイルは翻訳元マスターの内容ハッシュを記録 SHALL し、`ai-ddd verify` はマスターのハッシュと一致しない、または対応するマスターが存在しない翻訳ファイルを違反として報告 MUST する。ユーザー言語が `en` 以外で必須翻訳が欠落している場合も違反とする。

#### Scenario: Master edited without updating translation
- **GIVEN** `design.md` 更新後に `design.ja.md` の記録ハッシュが更新されていない
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、陳腐化した翻訳ファイルと翻訳元を報告する

#### Scenario: Required translation is missing
- **GIVEN** ユーザー言語 `ja` のプロジェクトで `docs/domain/ubiquitous-language.ja.md` が存在しない
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、欠落している翻訳ファイルを報告する

### Requirement: Localized Web UI
Presentation 層の Web UI は、利用者に表示するすべての文言をロケール別メッセージカタログから取得し、プロジェクトのユーザー言語で表示 SHALL する。HTML の言語属性は表示ロケールと一致 MUST し、ユーザー言語以外に英語カタログを常に保持 MUST する。

#### Scenario: UI renders in the configured locale
- **GIVEN** ユーザー言語 `ja` で起動した Web UI
- **WHEN** 利用者が注文画面およびエラー画面を表示する
- **THEN** 見出し・ボタン・エラーメッセージが日本語カタログの文言で表示され、HTML の言語属性が `ja` である

#### Scenario: Catalog key mismatch is rejected
- **GIVEN** 英語カタログに存在するキーが日本語カタログに存在しない
- **WHEN** `ai-ddd verify --target <dir>` を実行する
- **THEN** コマンドは終了コード 1 で失敗し、欠落キーとカタログを報告する
