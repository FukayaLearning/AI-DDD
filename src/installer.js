import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generateSkeletonFiles } from "./skeletons.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PLATFORM_ROOT = path.resolve(__dirname, "..");

const SUPPORTED_TOOLS = ["antigravity", "claude", "hermes", "github-copilot"];
const TOOL_SKILL_DIRS = {
  antigravity: ".agents/skills/ddd-workflow",
  claude: ".claude/skills/ddd-workflow",
  hermes: ".hermes/skills/ddd-workflow",
  "github-copilot": ".github/skills/ddd-workflow",
};

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function getGlobalSchemaDir() {
  const xdg = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(xdg, "openspec", "schemas", "ddd-driven");
}

export function installSchema({ targetDir, globalSchema = false }) {
  const srcSchemaDir = path.join(PLATFORM_ROOT, "schemas", "ddd-driven");
  const installedPaths = [];

  if (targetDir) {
    const destLocal = path.join(path.resolve(targetDir), "openspec", "schemas", "ddd-driven");
    copyDirRecursive(srcSchemaDir, destLocal);
    installedPaths.push(destLocal);
  }

  if (globalSchema) {
    const destGlobal = getGlobalSchemaDir();
    copyDirRecursive(srcSchemaDir, destGlobal);
    installedPaths.push(destGlobal);
  }

  return installedPaths;
}

export function buildOpenSpecConfig({ projectName, contextName, lang, dist }) {
  return `schema: ddd-driven

context: |
  Project: ${projectName}
  Bounded Context: ${contextName} (1 repository = 1 Bounded Context; cross-repo OpenSpec linking is T.B.D.)
  Language: ${lang}
  Distribution: ${dist}
  Error Handling: Result<T, E> everywhere for expected domain and infrastructure failures
  Layer Architecture: Layer-first 4-layer DDD (domain, application, infrastructure, presentation) + main composition root
  Testing & Coverage:
    - Domain, Application, Infrastructure (excluding drivers/), Presentation (Mock + Playwright/Chromium) MUST reach 100% C1 branch coverage
    - Only infrastructure/drivers/ and main may be excluded in centralized coverage config
    - Inline coverage ignore comments are strictly forbidden
    - infrastructure/drivers/ MUST remain branchless raw I/O
    - Excluded drivers/ and main are verified via ${dist} integration tests

rules:
  proposal:
    - Confirm alignment with docs/domain/ubiquitous-language.md and docs/domain/context-map.md
    - Name capabilities as ${contextName}/<capability> in kebab-case
  specs:
    - Express all requirements in Ubiquitous Language without framework or SQL/HTTP details
    - Map each #### Scenario 1-to-1 to Application UseCase and Presentation tests
  design:
    - Separate infrastructure into Pure Mappers/ACL, branchless drivers/, and DI Repositories/Gateways
    - Explicitly list unit-test exclusions (drivers/ and main only) and integration verification steps
  tasks:
    - Order TDD strictly: Strategic Docs -> Domain (100% C1) -> Infra Mock-Driver Abnormal (100% C1) -> Application Scenarios (100% C1) -> Presentation Mock x Playwright (100% C1) -> Verify & Integration -> Zero-Context Review

operations:
  apply:
    guidance:
      - Main Agent owns spec authoring, 4-layer implementation, and test authoring in one continuous context
      - Execution Subagent (lightweight model) runs builds, ai-ddd verify, unit+browser C1 tests, and integration tests
      - Independent Review Subagent (high-capability model, ZERO prior conversation context) audits final files against OpenSpec and C1 governance
      - "If the repository is under Git control (skip if not a Git repository): before starting the first task in openspec-apply, ask the user to confirm creating/switching to a working branch and commit the pre-task (post-propose) artifacts to that branch"
      - "If under Git control: commit after completing each individual task (including its tasks.md checkbox update) before proceeding to the next task"
`;
}

export function buildAgentsMd({ projectName, contextName }) {
  return `# AGENTS.md — ${projectName} (${contextName} Bounded Context)

## 1. Mandatory Default: Route All Change Requests Through OpenSpec Skills

In this \`ddd-driven\` OpenSpec repository, **every user request that modifies files, behavior, domain models, architecture, tests, or documentation MUST be translated into and executed via the appropriate OpenSpec skill workflow**, even when the user does **not** explicitly mention OpenSpec, a skill name (\`openspec-*\`), or a slash command (\`/opsx-*\`).

- **Override of built-in "Auto-selected" fallback**: The OpenSpec skill files contain an \`Auto-selected\` branch intended for uninitialized repositories (\`"root": null\`). Because this repository is OpenSpec-managed, **never fall back to bypassing OpenSpec**. Treat every change request as if the user explicitly invoked OpenSpec.
- **Read-only questions**: Purely informational, read-only requests (e.g., explaining code, checking status, summarizing files with zero edits) may be answered directly without creating an OpenSpec change.

### Intent-to-Skill Routing Table

| User Intent | Skill to Execute | Skill File |
| :--- | :--- | :--- |
| Investigate ideas, clarify domain rules, explore architecture | \`openspec-explore\` | \`.agents/skills/openspec-explore/SKILL.md\` |
| Propose a new feature or capability (\`proposal\`, \`specs\`, \`design\`, \`tasks\`) | \`openspec-propose\` | \`.agents/skills/openspec-propose/SKILL.md\` |
| Modify scope, specs, design, or tasks of an active change | \`openspec-update-change\` | \`.agents/skills/openspec-update-change/SKILL.md\` |
| Implement code, fix bugs, write tests, or execute tasks | \`openspec-apply-change\` | \`.agents/skills/openspec-apply-change/SKILL.md\` |
| Sync delta specs into \`openspec/specs/\` | \`openspec-sync-specs\` | \`.agents/skills/openspec-sync-specs/SKILL.md\` |
| Finalize and archive a completed change | \`openspec-archive-change\` | \`.agents/skills/openspec-archive-change/SKILL.md\` |

- **When implementation is requested without an active plan/task**: Do **not** edit target files directly. First run \`openspec-propose\` (for a new change) or \`openspec-update-change\` (to add/revise artifacts and tasks in an existing change), then execute \`openspec-apply-change\`.
- **DDD Workflow Compliance**: Always follow \`.agents/skills/ddd-workflow/SKILL.md\` (1-Repo-1-Bounded-Context, 4-layer DDD, \`Result<T, E>\`, branchless \`infrastructure/drivers/\`, 100% C1 branch coverage outside exclusions, and 3-role multi-agent workflow).

---

## 2. Exception: Direct File Editing (Explicit Opt-Out Only)

You MAY edit files directly without running OpenSpec skills **ONLY IF** the user explicitly instructs you to omit or bypass OpenSpec in their prompt (for example: *"OpenSpec を省略して直接編集して"*, *"without OpenSpec"*, *"skip OpenSpec"*, *"edit directly without openspec"*).

- Absent an explicit opt-out from the user, direct ad-hoc file editing outside an OpenSpec change/task workflow is **prohibited**.

---

## 3. Git Branching & Per-Task Commit Discipline (\`openspec-apply-change\`)

When running \`openspec-apply-change\` (omit all Git steps if the workspace is not under Git control):

1. **Pre-Task Branch Hearing & Post-Propose Baseline Commit**:
   - Before starting the first pending task, confirm with the user whether to create/switch to a working branch (e.g., \`feat/<change-name>\`) or commit to the current branch.
   - Checkout the agreed branch and commit the pre-task state (all post-propose/post-update planning artifacts: \`proposal.md\`, \`specs/\`, \`design.md\`, \`tasks.md\`) before executing Task 1.
2. **1-Task = 1-Commit Rule**:
   - Complete tasks sequentially. Immediately after each individual task is implemented, verified, and checked off (\`- [ ]\` -> \`- [x]\`) in \`tasks.md\`, commit that single task's changes (including the updated \`tasks.md\`) before moving to the next task.
`;
}

export function initProject(options) {
  const {
    targetDir,
    projectName,
    contextName,
    lang,
    dist,
    tools = SUPPORTED_TOOLS,
    globalSchema = false,
  } = options;

  const absTarget = path.resolve(targetDir);
  fs.mkdirSync(absTarget, { recursive: true });

  // 1. Initialize git repository if missing
  if (!fs.existsSync(path.join(absTarget, ".git"))) {
    execFileSync("git", ["init"], { cwd: absTarget, stdio: "pipe" });
  }

  // 2. Run openspec init for selected AI tools
  const toolsArg = tools.length > 0 ? tools.join(",") : "none";
  execFileSync(
    "openspec",
    ["init", "--tools", toolsArg, "--force", "--no-animation", absTarget],
    { cwd: absTarget, stdio: "pipe" }
  );

  // 3. Deploy ddd-driven schema locally (and globally if requested)
  const schemaPaths = installSchema({ targetDir: absTarget, globalSchema });

  // 4. Write DDD-configured openspec/config.yaml
  const configPath = path.join(absTarget, "openspec", "config.yaml");
  fs.writeFileSync(
    configPath,
    buildOpenSpecConfig({ projectName, contextName, lang, dist }),
    "utf8"
  );

  // 5. Deploy ddd-workflow skill to selected AI tool skill dirs
  const skillSrc = path.join(PLATFORM_ROOT, "skills", "ddd-workflow", "SKILL.md");
  const skillContent = fs.readFileSync(skillSrc, "utf8");
  for (const tool of tools) {
    const relSkillDir = TOOL_SKILL_DIRS[tool];
    if (relSkillDir) {
      const destSkillDir = path.join(absTarget, relSkillDir);
      fs.mkdirSync(destSkillDir, { recursive: true });
      fs.writeFileSync(path.join(destSkillDir, "SKILL.md"), skillContent, "utf8");
    }
  }

  // 5b. Write root AGENTS.md enforcing OpenSpec skill routing & Git commit rules
  fs.writeFileSync(
    path.join(absTarget, "AGENTS.md"),
    buildAgentsMd({ projectName, contextName }),
    "utf8"
  );

  // 6. Generate strategic DDD docs (Ubiquitous Language & Context Map)
  const domainDocsDir = path.join(absTarget, "docs", "domain");
  fs.mkdirSync(domainDocsDir, { recursive: true });

  fs.writeFileSync(
    path.join(domainDocsDir, "ubiquitous-language.md"),
    `# Ubiquitous Language — ${contextName}

> Single Bounded Context repository: **${projectName}** (\`${contextName}\`)
> Every term defined here MUST match identifiers in OpenSpec specs, domain code, and tests.

| Term (English Identifier) | Domain Meaning | Layer / Pattern | Notes |
| :--- | :--- | :--- | :--- |
| \`Result<T, E>\` | Explicit success (\`Ok\`) or typed failure (\`Err\`) | Domain Base | All expected errors are values |
| \`HealthStatus\` | Operational status of this Bounded Context service | Domain Value Object | Clean skeleton baseline |
`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(domainDocsDir, "context-map.md"),
    `# Context Map — ${contextName}

- **Owned Bounded Context**: \`${contextName}\` (this repository: \`${projectName}\`)
- **Cross-Repository OpenSpec Federation**: \`T.B.D.\`

## External Context Relationships

| Upstream / External Context | Repository | Relationship / Pattern | Domain Port / ACL | Status |
| :--- | :--- | :--- | :--- | :--- |
| *(Add external Bounded Contexts here as ports are introduced)* | Separate Repository | ACL / Customer-Supplier | \`domain/ports\` | \`T.B.D.\` |
`,
    "utf8"
  );

  // 7. Generate clean 4-layer skeleton for selected language & distribution mode
  const skeletonFiles = generateSkeletonFiles({
    projectName,
    contextName,
    lang,
    dist,
    cliPath: path.join(PLATFORM_ROOT, "bin", "ai-ddd.js"),
  });

  for (const [relPath, content] of Object.entries(skeletonFiles)) {
    const fullPath = path.join(absTarget, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf8");
    if (relPath.endsWith(".sh")) {
      fs.chmodSync(fullPath, 0o755);
    }
  }

  // 8. Validate schema via OpenSpec CLI
  execFileSync("openspec", ["schema", "validate", "ddd-driven"], {
    cwd: absTarget,
    stdio: "pipe",
  });

  return {
    targetDir: absTarget,
    schemaPaths,
    filesCreated: Object.keys(skeletonFiles).length,
  };
}
