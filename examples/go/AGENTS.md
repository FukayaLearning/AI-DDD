# AGENTS.md — ordering-go (ordering Bounded Context)

## 1. Mandatory Default: Route All Change Requests Through OpenSpec Skills

In this `ddd-driven` OpenSpec repository, **every user request that modifies files, behavior, domain models, architecture, tests, or documentation MUST be translated into and executed via the appropriate OpenSpec skill workflow**, even when the user does **not** explicitly mention OpenSpec, a skill name (`openspec-*`), or a slash command (`/opsx-*`).

- **Override of built-in "Auto-selected" fallback**: The OpenSpec skill files contain an `Auto-selected` branch intended for uninitialized repositories (`"root": null`). Because this repository is OpenSpec-managed, **never fall back to bypassing OpenSpec**. Treat every change request as if the user explicitly invoked OpenSpec.
- **Read-only questions**: Purely informational, read-only requests (e.g., explaining code, checking status, summarizing files with zero edits) may be answered directly without creating an OpenSpec change.

### Intent-to-Skill Routing Table

| User Intent | Skill to Execute | Skill File |
| :--- | :--- | :--- |
| Investigate ideas, clarify domain rules, explore architecture | `openspec-explore` | `.agents/skills/openspec-explore/SKILL.md` |
| Propose a new feature or capability (`proposal`, `specs`, `design`, `test-plan`, `tasks`) | `openspec-propose` | `.agents/skills/openspec-propose/SKILL.md` |
| Modify scope, specs, design, or tasks of an active change | `openspec-update-change` | `.agents/skills/openspec-update-change/SKILL.md` |
| Implement code, fix bugs, write tests, or execute tasks | `openspec-apply-change` | `.agents/skills/openspec-apply-change/SKILL.md` |
| Sync delta specs into `openspec/specs/` | `openspec-sync-specs` | `.agents/skills/openspec-sync-specs/SKILL.md` |
| Finalize and archive a completed change | `openspec-archive-change` | `.agents/skills/openspec-archive-change/SKILL.md` |

- **When implementation is requested without an active plan/task**: Do **not** edit target files directly. First run `openspec-propose` (for a new change) or `openspec-update-change` (to add/revise artifacts and tasks in an existing change), then execute `openspec-apply-change`.
- **DDD Workflow Compliance**: Always follow `.agents/skills/ddd-workflow/SKILL.md` (1-Repo-1-Bounded-Context, 4-layer DDD, `Result<T, E>`, branchless `infrastructure/drivers/`, 100% C1 branch coverage outside exclusions, and 3-role multi-agent workflow).

---

## 2. Exception: Direct File Editing (Explicit Opt-Out Only)

You MAY edit files directly without running OpenSpec skills **ONLY IF** the user explicitly instructs you to omit or bypass OpenSpec in their prompt (for example: *"OpenSpec を省略して直接編集して"*, *"without OpenSpec"*, *"skip OpenSpec"*, *"edit directly without openspec"*).

- Absent an explicit opt-out from the user, direct ad-hoc file editing outside an OpenSpec change/task workflow is **prohibited**.

---

## 3. Git Branching & Per-Task Commit Discipline (`openspec-apply-change`)

When running `openspec-apply-change` (omit all Git steps if the workspace is not under Git control):

1. **Pre-Task Branch Hearing & Post-Propose Baseline Commit**:
   - Before starting the first pending task, confirm with the user whether to create/switch to a working branch (e.g., `feat/<change-name>`) or commit to the current branch.
   - Checkout the agreed branch and commit the pre-task state (all post-propose/post-update planning artifacts: `proposal.md`, `specs/`, `design.md`, `test-plan.md` if present, `tasks.md`) before executing Task 1.
2. **1-Task = 1-Commit Rule**:
   - Complete tasks sequentially. Immediately after each individual task is implemented, verified, and checked off (`- [ ]` -> `- [x]`) in `tasks.md`, commit that single task's changes (including the updated `tasks.md`) before moving to the next task.
