# AI-DDD — OpenSpec × DDD Platform

A reusable **OpenSpec × Domain-Driven Design (DDD)** workflow platform combining a custom OpenSpec schema (`ddd-driven`), a Node.js initializer and governance verifier CLI (`ai-ddd`), multi-agent role rules (`skills/ddd-workflow/SKILL.md`), and end-to-end **Ordering Bounded Context** reference examples in **TypeScript, Python, Go, and Rust**.

## Key Architecture & Principles

- **1 Repository = 1 Bounded Context**: Cross-repository OpenSpec federation is documented as `T.B.D.` in `docs/domain/context-map.md`; specs live under `openspec/specs/<bounded-context>/<capability>/spec.md`.
- **4-Stage `ddd-driven` Schema**: Preserves `proposal -> specs -> design -> tasks` with embedded Strategic DDD (`docs/domain/ubiquitous-language.md`, `docs/domain/context-map.md`) and Tactical DDD design contracts.
- **Layer-First 4-Layer Architecture**: `domain` (zero dependencies), `application` (UseCases mapped 1-to-1 to OpenSpec `#### Scenario:`), `infrastructure`, `presentation` (Web UI), and `main` (composition root).
- **`Result<T, E>` Error Handling**: All expected domain and infrastructure failures are returned as typed values across all 4 languages.
- **3-Part Infrastructure Separation**:
  1. Pure Mappers / ACL converters (mock-free 100% C1 unit tests)
  2. Minimal branchless `infrastructure/drivers/` (raw I/O only; zero `if`/`switch`/`match` branches)
  3. DI Repositories & ACL Gateways (abnormal paths tested via mock drivers to 100% C1 coverage)
- **Presentation Web UI Testing (Mock × Headless Browser)**: Launch the real SSR HTTP server with DI-injected Mock UseCases, execute real headless Chromium/Playwright browser interactions across all UI and error branches, and capture C1 coverage directly.
- **C1 100% Governance (`ai-ddd verify`)**:
  - Zero inline coverage suppression directives (`v8 ignore`, `istanbul ignore`, `c8 ignore`, `pragma: no cover`, `#[coverage(off)]`, `//go:build ignore`)
  - Only `infrastructure/drivers/` and `main` may be excluded in centralized coverage config (verified in distribution integration tests)
  - Zero branching logic allowed inside `infrastructure/drivers/`
- **3-Role Multi-Agent Workflow**:
  - **Main Agent**: Continuous context authoring (`proposal` through 4-layer TDD implementation)
  - **Execution Subagent** (`flash`/`flash_lite`): Mechanical builds, `ai-ddd verify`, C1/browser suites, integration tests
  - **Independent Review Subagent** (`pro`, zero prior context): Unbiased file-only audit of specs, Ubiquitous Language, and C1 governance

## Repository Layout

- `schemas/ddd-driven/`: Custom OpenSpec schema and artifact templates (`proposal.md`, `spec.md`, `design.md`, `tasks.md`)
- `skills/ddd-workflow/SKILL.md`: AI agent workflow skill deployed to Antigravity, Claude Code, Hermes Agent, and GitHub Copilot
- `bin/ai-ddd.js`, `src/`: Zero-dependency Node.js CLI (`init`, `verify`, `install-schema`) and clean 4-language × 3-distribution (`docker`, `binary`, `library`) skeleton generators
- `examples/{typescript,python,go,rust}/`: Full Ordering Bounded Context reference implementations with archived OpenSpec specs, domain docs, 4-layer source, unit/browser tests, and integration tests
- `openspec/`: Standard `spec-driven` OpenSpec workspace managing the `AI-DDD` platform itself

## CLI Usage

```bash
# Link or invoke directly with Node.js >= 22
node bin/ai-ddd.js init \
  --target /path/to/my-context \
  --name my-context \
  --context my-context \
  --lang typescript \
  --dist docker \
  --yes

# Verify layer dependencies, zero inline coverage ignores, and branchless drivers/
node bin/ai-ddd.js verify --target /path/to/my-context
```

Supported flags for `init`:
- `--lang`: `typescript` | `python` | `go` | `rust`
- `--dist`: `docker` | `binary` | `library`
- `--tools`: Comma-separated list (default: `antigravity,claude,hermes,github-copilot`)
- `--global-schema`: Also deploy `ddd-driven` to `${XDG_DATA_HOME:-~/.local/share}/openspec/schemas/ddd-driven`

## Verification Commands

```bash
# Run CLI + skeleton tests and all reference example suites
npm test

# Verify governance across all four language examples
npm run verify:examples

# Validate root OpenSpec change
openspec validate bootstrap-ai-ddd-platform --strict
```
