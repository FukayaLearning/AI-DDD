# cli-installer Specification

## Purpose
Defines the Node.js CLI (`ai-ddd`) that initializes new or existing git repositories with OpenSpec (`ddd-driven`), strategic DDD docs, clean 4-layer language skeletons, distribution-aware integration harnesses, and static governance verification.

## Requirements

### Requirement: Interactive and non-interactive project initialization
The CLI SHALL provide an `ai-ddd init` command supporting both interactive prompts and non-interactive flags (`--target`, `--name`, `--context`, `--context-code`, `--lang`, `--dist`, `--locale`, `--tools`, `--global-schema`, `--yes`) to initialize a target repository for `typescript`, `python`, `go`, or `rust`, distribution mode `docker`, `binary`, or `library`, and a user locale (default `en`).

#### Scenario: Non-interactive initialization creates runnable clean skeleton
- **GIVEN** an empty or existing target directory
- **WHEN** `ai-ddd init --target <dir> --name <name> --context <ctx> --lang typescript --dist docker --yes` runs
- **THEN** `<dir>` receives `openspec/schemas/ddd-driven/`, `openspec/config.yaml` (`schema: ddd-driven`), AI tool configs, `docs/domain/`, `docs/testing/` test specification skeletons, a module-subdivided 4-layer skeleton with `Result<T, E>` and test case IDs, unit/C1 coverage config, Mock+Playwright test harness, and Docker integration test scaffolding ready to run immediately, and `ai-ddd verify` succeeds on it

#### Scenario: Global schema deployment option
- **GIVEN** `--global-schema` is passed to `ai-ddd init`
- **WHEN** initialization executes
- **THEN** the `ddd-driven` schema is also installed into `${XDG_DATA_HOME:-~/.local/share}/openspec/schemas/ddd-driven`

#### Scenario: Non-English locale initialization
- **GIVEN** `--locale ja` is passed to `ai-ddd init`
- **WHEN** initialization executes
- **THEN** the project configuration records master locale `en` and user locale `ja`, `docs/domain/*.ja.md` translations with source hashes are generated, and the Web UI skeleton includes `en` and `ja` message catalogs rendering in `ja`

#### Scenario: Invalid locale code is rejected
- **GIVEN** `--locale` is passed a value that is not a valid BCP 47 language tag
- **WHEN** `ai-ddd init` runs
- **THEN** the command exits with code 1 without writing files and reports the invalid locale

### Requirement: Static architecture and coverage governance verification
The CLI SHALL provide an `ai-ddd verify --target <dir>` command that exits non-zero if layer dependency violations, inline coverage-exclusion comments, or conditional branches inside `infrastructure/drivers/` are detected.

#### Scenario: Layer boundary violation is rejected
- **GIVEN** source code in `domain` importing from `application`, `infrastructure`, or `presentation` (or `application` importing `infrastructure`/`presentation`, or `presentation` importing `infrastructure`)
- **WHEN** `ai-ddd verify --target <dir>` runs
- **THEN** the command fails with exit code 1 and reports the violating file and dependency

#### Scenario: Inline coverage suppression and driver branching are rejected
- **GIVEN** an inline coverage ignore directive (`v8 ignore`, `istanbul ignore`, `pragma: no cover`, `#[coverage(off)]`) anywhere in source files or an `if`/`switch`/`match`/ternary branch inside `infrastructure/drivers/`
- **WHEN** `ai-ddd verify --target <dir>` runs
- **THEN** the command fails with exit code 1 and identifies the offending rule violation

### Requirement: Distributed copy drift detection
プラットフォームの検証（`npm run verify:examples`）は、各リファレンスサンプルに配置された `ddd-driven` スキーマ・テンプレートおよび各 AI ツール向け `ddd-workflow` スキルが、ルートの原本と内容一致することを検査し、差分があれば失敗 MUST する。

#### Scenario: Example schema diverges from the root schema
- **GIVEN** `examples/go/openspec/schemas/ddd-driven/templates/tasks.md` がルートの `schemas/ddd-driven/templates/tasks.md` と異なる
- **WHEN** `npm run verify:examples` を実行する
- **THEN** コマンドは非ゼロで終了し、差分のあるファイルと原本のパスを報告する
