# Proposal

## Why

Software teams adopting Domain-Driven Design (DDD) with OpenSpec need a repeatable workflow that connects strategic modeling (Bounded Contexts, Ubiquitous Language), tactical 4-layer architecture, strict C1 (branch) test coverage governance, and Web UI browser testing from specification through implementation. Without a unified custom schema, initializer CLI, and working multi-language references, each repository drifts in layer boundaries, error handling, and unverified branches.

## What Changes

- Introduce the `ddd-driven` OpenSpec custom schema (`schemas/ddd-driven/`) preserving the 4-stage workflow (`proposal -> specs -> design -> tasks`) enriched with strategic/tactical DDD rules, `Result<T, E>` error handling, 3-part Infrastructure separation, and 3-role multi-agent workflow guidance.
- Build a Node.js CLI installer and project initializer (`bin/ai-ddd.js`, `src/`) with `init` (interactive and flag-driven) and `verify` (static governance checker) commands for TypeScript, Python, Go, and Rust repositories across distribution targets (`docker`, `binary`, `library`).
- Provide reusable AI agent workflow skills (`skills/ddd-workflow/SKILL.md`) aligned with Antigravity, Claude Code, Hermes Agent, and GitHub Copilot.
- Implement full end-to-end "Ordering Context" reference examples (`examples/{typescript,python,go,rust}/`) demonstrating OpenSpec specs, 4-layer DDD, `Result<T, E>`, Infrastructure unit testing via minimal driver mocks, Presentation Web UI testing via Mock + headless Chromium/Playwright, 100% C1 branch coverage (excluding only `infrastructure/drivers/` and `main`), and distribution integration tests.

## Capabilities

### New Capabilities
- `ddd-schema`: Custom OpenSpec `ddd-driven` workflow schema, artifact templates, strategic DDD docs structure, and multi-agent 3-role orchestration rules.
- `cli-installer`: Node.js CLI (`ai-ddd init`, `ai-ddd verify`) for deploying the `ddd-driven` schema, initializing language-specific clean 4-layer DDD skeletons with distribution-aware integration tests, and enforcing static architecture and C1 coverage governance.
- `reference-examples`: Multi-language Ordering Bounded Context implementations (`typescript`, `python`, `go`, `rust`) proving end-to-end OpenSpec-to-DDD traceability, 100% C1 branch coverage outside exclusions, Mock-backed browser Web UI rendering tests, and distribution integration tests.

### Modified Capabilities
<!-- None: initial platform bootstrap -->

## Impact

- Root repository uses standard OpenSpec (`spec-driven`) to manage the platform itself.
- Adds `package.json`, `bin/ai-ddd.js`, `src/`, `schemas/ddd-driven/`, `skills/ddd-workflow/`, and `examples/{typescript,python,go,rust}/`.
