# cli-installer Spec Delta

## MODIFIED Requirements

### Requirement: Static architecture and coverage governance verification
The CLI SHALL provide an `ai-ddd verify --target <dir>` command that exits non-zero if layer dependency violations, inline coverage-exclusion comments, conditional branches inside `infrastructure/drivers/`, or DDD model-integrity violations are detected. Model-integrity checks SHALL cover aggregate and value-object field encapsulation, the presence of a domain-event dispatch or explicit record-only declaration, and consistency between ubiquitous-language terms and domain identifiers.

#### Scenario: Layer boundary violation is rejected
- **GIVEN** source code in `domain` importing from `application`, `infrastructure`, or `presentation` (or `application` importing `infrastructure`/`presentation`, or `presentation` importing `infrastructure`)
- **WHEN** `ai-ddd verify --target <dir>` runs
- **THEN** the command fails with exit code 1 and reports the violating file and dependency

#### Scenario: Inline coverage suppression and driver branching are rejected
- **GIVEN** an inline coverage ignore directive (`v8 ignore`, `istanbul ignore`, `pragma: no cover`, `#[coverage(off)]`) anywhere in source files or an `if`/`switch`/`match`/ternary branch inside `infrastructure/drivers/`
- **WHEN** `ai-ddd verify --target <dir>` runs
- **THEN** the command fails with exit code 1 and identifies the offending rule violation

#### Scenario: Aggregate or value-object encapsulation violation is reported
- **GIVEN** a domain aggregate or value object whose mutable state is exposed through exported/public fields in Go or Rust
- **WHEN** `ai-ddd verify --target <dir>` runs
- **THEN** the command fails with exit code 1 and reports the type and field that bypass the aggregate or factory boundary

#### Scenario: Domain events without a dispatch or record-only declaration are reported
- **GIVEN** a domain aggregate that records events but the project defines neither a dispatch/outbox path nor an explicit record-only declaration
- **WHEN** `ai-ddd verify --target <dir>` runs
- **THEN** the command fails with exit code 1 and reports the aggregate and the missing event lifecycle

#### Scenario: Ubiquitous-language term mismatch is reported
- **GIVEN** a term declared in `docs/domain/ubiquitous-language.md` that does not appear as a domain identifier in the source tree
- **WHEN** `ai-ddd verify --target <dir>` runs
- **THEN** the command fails with exit code 1 and reports the unmatched term
