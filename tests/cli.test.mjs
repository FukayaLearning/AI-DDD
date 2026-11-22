import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CLI = path.join(ROOT, "bin", "ai-ddd.js");

function runNodeCli(args, cwd = ROOT) {
  return execFileSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runShell(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (e) {
    console.error(`Command failed: ${cmd} ${args.join(" ")}\nSTDOUT:\n${e.stdout}\nSTDERR:\n${e.stderr}`);
    throw e;
  }
}

// 1. Test TypeScript init (binary dist) -> verify -> unit+browser C1 100% -> integration
{
  const dir = makeTempDir("ai-ddd-ts-");
  try {
    const out = runNodeCli([
      "init",
      "--target", dir,
      "--name", "billing-ctx",
      "--context", "billing",
      "--lang", "typescript",
      "--dist", "binary",
      "--yes",
    ]);
    assert.match(out, /Initialized OpenSpec \+ DDD project/);
    assert.ok(fs.existsSync(path.join(dir, "openspec", "schemas", "ddd-driven", "schema.yaml")));
    assert.ok(fs.existsSync(path.join(dir, "docs", "domain", "ubiquitous-language.md")));
    assert.ok(fs.existsSync(path.join(dir, "docs", "domain", "context-map.md")));
    assert.ok(fs.existsSync(path.join(dir, ".agents", "skills", "ddd-workflow", "SKILL.md")));

    const schemaText = fs.readFileSync(path.join(dir, "openspec", "schemas", "ddd-driven", "schema.yaml"), "utf8");
    assert.match(schemaText, /Git Workflow/);
    assert.match(schemaText, /Pre-Task Branching & Baseline Commit/);
    assert.match(schemaText, /Per-Task Atomic Commit/);

    const configText = fs.readFileSync(path.join(dir, "openspec", "config.yaml"), "utf8");
    assert.match(configText, /working branch/);
    assert.match(configText, /completing each individual task/);

    const skillText = fs.readFileSync(path.join(dir, ".agents", "skills", "ddd-workflow", "SKILL.md"), "utf8");
    assert.match(skillText, /Git Branching & Per-Task Commit Discipline/);
    assert.match(skillText, /1-Task = 1-Commit Rule/);

    // Static verify passes
    const vOut = runNodeCli(["verify", "--target", dir]);
    assert.match(vOut, /PASS:/);

    // Unit + Browser + 100% C1 passes immediately
    runShell("npm", ["run", "test:unit"], dir);

    // Binary process integration test passes immediately
    runShell("npm", ["run", "test:integration"], dir);
    console.log("PASS: TypeScript skeleton init, verify, C1 100% browser unit test, and binary integration test");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 2. Test Python init (library dist) -> verify -> unit+browser C1 100% -> integration
{
  const dir = makeTempDir("ai-ddd-py-");
  try {
    runNodeCli([
      "init",
      "--target", dir,
      "--name", "shipping-ctx",
      "--context", "shipping",
      "--lang", "python",
      "--dist", "library",
      "--yes",
    ]);
    runNodeCli(["verify", "--target", dir]);
    runShell("bash", ["scripts/run-unit-tests.sh"], dir);
    runShell("bash", ["scripts/test-integration.sh"], dir);
    console.log("PASS: Python skeleton init, verify, C1 100% browser unit test, and library integration test");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 3. Test Go init (docker dist) -> Docker artifacts & verify pass
{
  const dir = makeTempDir("ai-ddd-go-");
  try {
    runNodeCli([
      "init",
      "--target", dir,
      "--name", "catalog-ctx",
      "--context", "catalog",
      "--lang", "go",
      "--dist", "docker",
      "--yes",
    ]);
    assert.ok(fs.existsSync(path.join(dir, "Dockerfile")));
    assert.ok(fs.existsSync(path.join(dir, "docker-compose.integration.yml")));
    runNodeCli(["verify", "--target", dir]);
    console.log("PASS: Go skeleton init (docker mode) and governance verify");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 4. Test Rust init (binary dist) -> verify -> cargo test --offline + browser -> integration
{
  const dir = makeTempDir("ai-ddd-rs-");
  try {
    runNodeCli([
      "init",
      "--target", dir,
      "--name", "ledger_ctx",
      "--context", "ledger",
      "--lang", "rust",
      "--dist", "binary",
      "--yes",
    ]);
    runNodeCli(["verify", "--target", dir]);
    runShell("bash", ["scripts/test-unit-c1.sh"], dir);
    runShell("bash", ["scripts/test-integration.sh"], dir);
    console.log("PASS: Rust skeleton init, verify, cargo test --offline + browser test, and binary integration test");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 5. Test verify rejects: (a) layer violation, (b) inline coverage ignore, (c) branch in drivers/, (d) unauthorized exclusion
{
  const dir = makeTempDir("ai-ddd-neg-");
  try {
    runNodeCli([
      "init",
      "--target", dir,
      "--name", "neg-ctx",
      "--context", "neg",
      "--lang", "typescript",
      "--dist", "library",
      "--yes",
    ]);

    // (a) presentation importing infrastructure
    fs.appendFileSync(
      path.join(dir, "src", "presentation", "web_server.ts"),
      '\nimport { SystemClockDriver } from "../infrastructure/drivers/clock_driver.ts";\n'
    );
    // (b) inline ignore comment
    fs.appendFileSync(
      path.join(dir, "src", "domain", "result.ts"),
      "\n// v8 ignore next\n"
    );
    // (c) branch in drivers/
    fs.writeFileSync(
      path.join(dir, "src", "infrastructure", "drivers", "clock_driver.ts"),
      'export class SystemClockDriver { async readSystemIso() { if (true) { return "x"; } return "y"; } }\n'
    );
    // (d) unauthorized coverage exclude
    fs.writeFileSync(
      path.join(dir, "c1-coverage.config.json"),
      JSON.stringify({ exclude: ["src/domain/**"] })
    );

    let failed = false;
    try {
      runNodeCli(["verify", "--target", dir, "--json"]);
    } catch (e) {
      failed = true;
      const report = JSON.parse(e.stdout);
      assert.equal(report.ok, false);
      assert.ok(report.errors.some((m) => m.includes("Layer Dependency Violation")));
      assert.ok(report.errors.some((m) => m.includes("Inline Coverage Ignore Forbidden")));
      assert.ok(report.errors.some((m) => m.includes("Branchless Driver Violation")));
      assert.ok(report.errors.some((m) => m.includes("Unauthorized Coverage Exclusion")));
    }
    assert.ok(failed, "Expected ai-ddd verify to exit non-zero on governance violations");
    console.log("PASS: ai-ddd verify rejects all 4 governance violations accurately");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
