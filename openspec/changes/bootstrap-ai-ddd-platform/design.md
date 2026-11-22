# Design

## Context

This repository (`AI-DDD`) provides a reusable OpenSpec + DDD engineering platform across TypeScript, Python, Go, and Rust. Per project requirements, `AI-DDD` itself uses the standard `spec-driven` OpenSpec schema, while delivering the `ddd-driven` custom schema, a Node.js CLI initializer/verifier (`ai-ddd`), AI agent workflow skills, and four working Ordering Bounded Context reference examples.

## Goals / Non-Goals

**Goals:**
- Deliver a validated `ddd-driven` custom schema (`schemas/ddd-driven/`) preserving the 4-step artifact graph (`proposal -> specs -> design -> tasks`).
- Deliver a Node.js CLI (`bin/ai-ddd.js`) with `init` (creating clean, test-ready 4-layer skeletons without domain sample bloat, parameterized by language and distribution mode) and `verify` (enforcing layer dependencies, zero inline coverage ignores, and branchless `drivers/`).
- Deliver 4 working Ordering examples (`examples/{typescript,python,go,rust}/`) demonstrating 100% C1 branch coverage outside `infrastructure/drivers/` and `main`, Mock + headless Chromium Web UI rendering tests, and integration tests.

**Non-Goals:**
- Cross-repository OpenSpec `store` federation is explicitly `T.B.D.`.
- Skeletons emitted by `ai-ddd init` exclude business sample entities (those live exclusively in `examples/`).

## Decisions

1. **Zero-Network / Offline-Capable Verification**:
   - The environment provides Node.js `v22.23.4`, Python `3.12.3`, Rust `cargo 1.92.0`, and cached Playwright Chromium (`~/.cache/ms-playwright/chromium-1208` / `chromium_headless_shell-1208`).
   - Node.js CLI uses pure ESM built-in modules (`node:fs`, `node:path`, `node:child_process`, `node:readline/promises`) with zero external runtime dependencies.
   - TypeScript and Python examples support standard tooling configs (`vitest.config.ts` / `pyproject.toml`) AND zero-network executable C1 branch coverage + CDP/Playwright browser runners so full verification passes reliably offline as well as in CI.
   - Go example provides complete idiomatic Go 4-layer code, `go test` + AST C1 checker, and Playwright test runner verified statically by `ai-ddd verify` (and executable wherever `go` toolchain is installed).
   - Rust example uses standard library only (`cargo test --offline`) plus built-in MIR/source-level branch/unit tests and headless Chromium integration via `std::process::Command` / TCP/WebSocket CDP or Python/Node bridge when verifying browser rendering, plus `cargo llvm-cov` script support.

2. **AST / Lexical Governance Verifier (`ai-ddd verify`)**:
   - Parses imports/use statements per language to check the strict dependency matrix (`domain` -> none; `application` -> `domain`; `infrastructure` -> `domain, application`; `presentation` -> `application, domain` [no `infrastructure`]; `main` -> composition root).
   - Scans source files for inline coverage exclusion directives and scans `infrastructure/drivers/` for conditional branch constructs (`if`, `else`, `switch`, `match`, ternary `? :`).

3. **Presentation Mock + Browser C1 Coverage**:
   - In-process test harness starts the real HTTP SSR server wired with a DI mock of the Application UseCase while coverage instrumentation is active, executes real headless Chromium page navigations/form submissions via CDP/Playwright, and validates exact DOM text and C1 100% branch coverage.

## Risks / Trade-offs

- [Risk] Go compiler binary is not installed in the current container → [Mitigation] Generate valid Go source, unit tests, Playwright test harness, and AST C1 governance checks verified statically and ready for `go test` on developer/Docker environments.
- [Risk] `cargo-llvm-cov` binary may not be installed in offline sandbox → [Mitigation] Provide `scripts/test-coverage.sh` that runs `cargo llvm-cov --branch` when installed and falls back to `cargo test --offline` + Rust branch/coverage AST audit in offline sandbox, clearly reporting exact coverage tool used.
