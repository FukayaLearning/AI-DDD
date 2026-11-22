# Tasks

## 1. Custom Schema & AI Skills

- [x] 1.1 Create `schemas/ddd-driven/schema.yaml` and templates (`proposal.md`, `spec.md`, `design.md`, `tasks.md`) and verify with `openspec schema validate`
- [x] 1.2 Create `skills/ddd-workflow/SKILL.md` documenting strategic/tactical DDD, C1 100% rules, and 3-role multi-agent workflow

## 2. Node.js CLI Installer & Governance Verifier

- [x] 2.1 Implement `package.json`, `bin/ai-ddd.js`, `src/cli.js`, `src/installer.js`, `src/skeletons.js`, and `src/verifier.js` supporting `init` (interactive & flags, 4 languages, 3 distribution modes) and `verify`
- [x] 2.2 Add CLI tests verifying `ai-ddd init` skeleton generation across languages/distributions and `ai-ddd verify` failure/pass cases

## 3. Reference Examples (`examples/{typescript,python,go,rust}/`)

- [x] 3.1 Implement Ordering Context OpenSpec + 4-layer DDD + 100% C1 + Mock×Chromium browser UI + integration test in `examples/typescript/` and verify all tests pass
- [x] 3.2 Implement Ordering Context OpenSpec + 4-layer DDD + 100% C1 + Mock×Chromium browser UI + integration test in `examples/python/` and verify all tests pass
- [x] 3.3 Implement Ordering Context OpenSpec + 4-layer DDD + 100% C1 + Mock×Playwright + integration test in `examples/go/` and verify governance checks pass
- [x] 3.4 Implement Ordering Context OpenSpec + 4-layer DDD + 100% C1 + Mock×Chromium browser UI + integration test in `examples/rust/` and verify `cargo test --offline` and governance checks pass

## 4. End-to-End Platform Verification

- [ ] 4.1 Run `openspec validate bootstrap-ai-ddd-platform --strict`, `ai-ddd verify` across all examples, and end-to-end `ai-ddd init` smoke tests in `/tmp`
