import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyProject } from "../src/verifier.js";
import { stampTranslationFile } from "../src/i18n.js";
import { analyzeTraceability, writeTraceabilityMatrix } from "../src/tracer.js";
import { verifyIntegrationChecklists, verifyTestCaseIds } from "../src/test-spec.js";

function makeFixture(opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-ddd-gov-"));
  fs.mkdirSync(path.join(dir, "openspec"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs", "domain"), { recursive: true });
  fs.writeFileSync(path.join(dir, "openspec", "config.yaml"), "schema: ddd-driven\n");
  fs.writeFileSync(path.join(dir, "docs", "domain", "ubiquitous-language.md"), "# UL\n");
  fs.writeFileSync(path.join(dir, "docs", "domain", "context-map.md"), "# CM\n");
  fs.writeFileSync(
    path.join(dir, "ai-ddd.config.json"),
    JSON.stringify({
      schemaVersion: opts.schemaVersion ?? 2,
      context: { name: "ordering", code: "ORD" },
      locale: { master: "en", user: opts.userLocale ?? "en" },
      structure: { maxFilesPerDirectory: opts.maxFiles ?? 15 },
      coverage: { configFile: "c1-coverage.config.json" },
    })
  );
  return dir;
}

function writeFile(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

// 1. Structure rules: valid subdivided layout passes
{
  const dir = makeFixture();
  try {
    writeFile(dir, "src/domain/shared/result.ts", "export const ok = true;\n");
    writeFile(
      dir,
      "src/domain/order/order.ts",
      'import { ok } from "../shared/result.ts";\nexport const x = ok;\n'
    );
    writeFile(
      dir,
      "src/application/order/commands/place_order.ts",
      'import { x } from "../../../domain/order/order.ts";\nexport const y = x;\n'
    );
    const report = verifyProject(dir);
    assert.equal(report.ok, true, JSON.stringify(report.errors));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 2. Structure rules: loose file at layer root & aggregate cross-dependency fail
{
  const dir = makeFixture();
  try {
    writeFile(dir, "src/domain/loose.ts", "export const a = 1;\n");
    writeFile(dir, "src/domain/customer/customer.ts", "export const c = 1;\n");
    writeFile(
      dir,
      "src/domain/order/order.ts",
      'import { c } from "../customer/customer.ts";\nexport const o = c;\n'
    );
    const report = verifyProject(dir);
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => e.includes("[Loose Layer File]") && e.includes("src/domain/loose.ts")));
    assert.ok(
      report.errors.some(
        (e) =>
          e.includes("[Aggregate Isolation Violation]") &&
          e.includes("domain/order/") &&
          e.includes("domain/customer/")
      )
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 3. Structure rules: module declaration files allowed; directory size warning does not fail
{
  const dir = makeFixture({ maxFiles: 3 });
  try {
    writeFile(dir, "src/domain/mod.rs", "pub mod shared;\n");
    writeFile(dir, "src/domain/shared/a.rs", "pub fn a() {}\n");
    writeFile(dir, "src/domain/shared/b.rs", "pub fn b() {}\n");
    writeFile(dir, "src/domain/shared/c.rs", "pub fn c() {}\n");
    writeFile(dir, "src/domain/shared/d.rs", "pub fn d() {}\n");
    const report = verifyProject(dir);
    assert.equal(report.ok, true, JSON.stringify(report.errors));
    assert.ok(
      report.warnings.some((w) => w.includes("[Directory Size Warning]") && w.includes("src/domain/shared"))
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log("PASS: governance structure verification tests");

// 4. Localization: missing translation, stale translation, stamp fix, orphan translation, UI catalog mismatch
{
  const dir = makeFixture({ userLocale: "ja" });
  try {
    writeFile(dir, "src/domain/shared/result.ts", "export const ok = true;\n");
    writeFile(dir, "src/presentation/web/i18n/en.ts", 'export const en = { title: "Order", submit: "Go" };\n');
    writeFile(dir, "src/presentation/web/i18n/ja.ts", 'export const ja = { title: "注文" };\n');
    writeFile(
      dir,
      "docs/domain/orphan.ja.md",
      "<!-- ai-ddd-translation: source=orphan.md sha256=" + "0".repeat(64) + " locale=ja -->\n# orphan\n"
    );

    const r1 = verifyProject(dir);
    assert.equal(r1.ok, false);
    assert.ok(r1.errors.some((e) => e.includes("[Missing Translation]") && e.includes("ubiquitous-language.ja.md")));
    assert.ok(r1.errors.some((e) => e.includes("[Orphan Translation]") && e.includes("orphan.ja.md")));
    assert.ok(r1.errors.some((e) => e.includes("[I18n Catalog Mismatch]") && e.includes("submit")));

    // Fix missing translations, stamp them, fix UI catalog
    fs.rmSync(path.join(dir, "docs/domain/orphan.ja.md"));
    writeFile(dir, "docs/domain/ubiquitous-language.ja.md", "# UL (JA)\n");
    writeFile(dir, "docs/domain/context-map.ja.md", "# CM (JA)\n");
    stampTranslationFile(dir, "docs/domain/ubiquitous-language.ja.md");
    stampTranslationFile(dir, "docs/domain/context-map.ja.md");
    writeFile(dir, "src/presentation/web/i18n/ja.ts", 'export const ja = { title: "注文", submit: "送信" };\n');

    const r2 = verifyProject(dir);
    assert.equal(r2.ok, true, JSON.stringify(r2.errors));

    // Edit master without re-stamping -> stale translation detected
    writeFile(dir, "docs/domain/ubiquitous-language.md", "# UL updated\n");
    const r3 = verifyProject(dir);
    assert.equal(r3.ok, false);
    assert.ok(r3.errors.some((e) => e.includes("[Stale Translation]") && e.includes("ubiquitous-language.ja.md")));

    // Re-stamp -> passes again
    stampTranslationFile(dir, "docs/domain/ubiquitous-language.ja.md");
    const r4 = verifyProject(dir);
    assert.equal(r4.ok, true, JSON.stringify(r4.errors));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log("PASS: governance localization & i18n catalog verification tests");

// 5. Gradual migration & schema version warning: v1 warns and passes (exit 0), v2 errors (exit 1)
{
  const v1Dir = makeFixture({ schemaVersion: 1 });
  try {
    writeFile(v1Dir, "openspec/schemas/ddd-driven/schema.yaml", "name: ddd-driven\nversion: 1\n");
    writeFile(v1Dir, "src/domain/loose.ts", "export const a = 1;\n");
    const rV1 = verifyProject(v1Dir);
    assert.equal(rV1.ok, true, JSON.stringify(rV1.errors));
    assert.ok(rV1.warnings.some((w) => w.includes("[Outdated Schema]") && w.includes("version 1")));
    assert.ok(rV1.warnings.some((w) => w.includes("[Loose Layer File]")));

    // Upgrade config to schemaVersion 2 -> same loose file becomes error
    writeFile(
      v1Dir,
      "ai-ddd.config.json",
      JSON.stringify({ schemaVersion: 2, context: { name: "ordering", code: "ORD" }, locale: { master: "en", user: "en" } })
    );
    const rV2 = verifyProject(v1Dir);
    assert.equal(rV2.ok, false);
    assert.ok(rV2.errors.some((e) => e.includes("[Loose Layer File]")));
  } finally {
    fs.rmSync(v1Dir, { recursive: true, force: true });
  }
}

console.log("PASS: governance gradual migration & schema version warning tests");

// 6. Traceability: IDs, missing/duplicate IDs, uncovered SCN, unimplemented REQ, missing test, orphan ref, matrix generation
{
  const dir = makeFixture();
  try {
    writeFile(dir, "src/domain/shared/result.ts", "export const ok = true;\n");
    writeFile(
      dir,
      "openspec/specs/ordering/order/spec.md",
      `# Spec
### Requirement: Place order without ID
The system SHALL x.
#### Scenario: Missing scenario ID
- **WHEN** x
- **THEN** y
### Requirement: REQ-ORD-001 Place order
The system SHALL place.
#### Scenario: SCN-ORD-001-01 Valid order
- **WHEN** valid
- **THEN** placed
#### Scenario: SCN-ORD-001-01 Duplicate scenario
- **WHEN** dup
- **THEN** dup
`
    );
    writeFile(
      dir,
      "docs/testing/unit/domain/order.md",
      "| ID | Design Element | Technique | Input | Expected | Rationale | Automated Test |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n| `UT-ORD-001` | Order | BVA | valid | ok | `REQ-ORD-001` | `tests/unit/domain.test.mjs` |\n| `UT-ORD-002` | Order | BVA | bad | err | `REQ-ORD-001` | `tests/unit/domain.test.mjs` |\n"
    );
    writeFile(
      dir,
      "tests/unit/domain.test.mjs",
      'import test from "node:test";\ntest("UT-ORD-001 valid", () => {});\ntest("UT-ORD-099 orphan", () => {});\n'
    );

    const bad = analyzeTraceability(dir);
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((e) => e.includes("[Missing Requirement ID]")));
    assert.ok(bad.errors.some((e) => e.includes("[Missing Scenario ID]")));
    assert.ok(bad.errors.some((e) => e.includes("[Duplicate Scenario ID]") && e.includes("SCN-ORD-001-01")));
    assert.ok(bad.errors.some((e) => e.includes("[Unimplemented Requirement]") && e.includes("REQ-ORD-001")));
    assert.ok(bad.errors.some((e) => e.includes("[Uncovered Scenario]") && e.includes("SCN-ORD-001-01")));
    assert.ok(bad.errors.some((e) => e.includes("[Missing Automated Test]") && e.includes("UT-ORD-002")));
    assert.ok(bad.errors.some((e) => e.includes("[Orphan Test Case Reference]") && e.includes("UT-ORD-099")));

    // Fix all gaps
    writeFile(
      dir,
      "openspec/specs/ordering/order/spec.md",
      `# Spec
### Requirement: REQ-ORD-001 Place order
The system SHALL place.
#### Scenario: SCN-ORD-001-01 Valid order
- **WHEN** valid
- **THEN** placed
`
    );
    writeFile(
      dir,
      "src/application/order/commands/place_order.ts",
      "// @implements REQ-ORD-001\nexport function placeOrder() {}\n"
    );
    writeFile(
      dir,
      "docs/testing/integration/order.md",
      "| ID | Title | Traces (SCN) | Technique | Preconditions (GIVEN) | Steps (WHEN) | Expected (THEN) | Priority | Automated Test |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n| `IT-ORD-001` | Place | `SCN-ORD-001-01` | Scenario E2E | valid | submit | saved | P1 | `scripts/test-integration.sh` |\n"
    );
    writeFile(
      dir,
      "tests/unit/domain.test.mjs",
      'import test from "node:test";\ntest("UT-ORD-001 valid", () => {});\ntest("UT-ORD-002 bad", () => {});\n'
    );
    writeFile(dir, "scripts/test-integration.sh", "#!/usr/bin/env bash\n# IT-ORD-001\n");

    const good = analyzeTraceability(dir);
    assert.equal(good.ok, true, JSON.stringify(good.errors));
    const matrixPath = writeTraceabilityMatrix(dir, good);
    const matrixText = fs.readFileSync(matrixPath, "utf8");
    assert.match(matrixText, /generated by ai-ddd trace; do not edit/);
    assert.match(matrixText, /REQ-ORD-001.*SCN-ORD-001-01.*UT-ORD-001.*IT-ORD-001/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log("PASS: governance traceability analysis & matrix tests");

// 7. Test specification checklist & 4-language test case ID enforcement
{
  const dir = makeFixture();
  try {
    // Incomplete checklist (missing N/A or IT IDs for External dependency failure & missing Locale row)
    writeFile(
      dir,
      "docs/testing/integration/order.md",
      `# Integration Test Spec
| Category | Case IDs | N/A Reason |
| :--- | :--- | :--- |
| Input boundary & invalid values | \`IT-ORD-002\` | |
| Invalid state transition | \`IT-ORD-003\` | |
| External dependency failure | | |
| Persistence / storage failure | \`IT-ORD-004\` | |
| Duplicate / concurrent conflict | | Single-writer local KV |
| Target not found | \`IT-ORD-005\` | |
`
    );
    const clBad = verifyIntegrationChecklists(dir);
    assert.ok(clBad.some((e) => e.includes("External dependency failure")));
    assert.ok(clBad.some((e) => e.includes("Locale-specific rendering")));

    // Complete checklist passes
    writeFile(
      dir,
      "docs/testing/integration/order.md",
      `# Integration Test Spec
| Category | Case IDs | N/A Reason |
| :--- | :--- | :--- |
| Input boundary & invalid values | \`IT-ORD-002\` | |
| Invalid state transition | \`IT-ORD-003\` | |
| External dependency failure | \`IT-ORD-006\` | |
| Persistence / storage failure | \`IT-ORD-004\` | |
| Duplicate / concurrent conflict | | Single-writer local KV |
| Target not found | \`IT-ORD-005\` | |
| Locale-specific rendering | \`IT-ORD-007\` | |
`
    );
    assert.deepEqual(verifyIntegrationChecklists(dir), []);

    // 4-language test ID detection (positive and negative)
    writeFile(
      dir,
      "tests/unit/domain.test.mjs",
      'test("UT-ORD-001 valid", () => {});\ntest("coverage only without id", () => {});\n'
    );
    writeFile(
      dir,
      "tests/unit/test_order.py",
      'def test_ut_ord_002_ok():\n    pass\ndef test_missing_id():\n    pass\n'
    );
    writeFile(
      dir,
      "internal/domain/order/order_test.go",
      'package order\nfunc TestUT_ORD_003(t *testing.T) {}\nfunc TestNoId(t *testing.T) {}\n'
    );
    writeFile(
      dir,
      "tests/order_test.rs",
      '#[test]\n/// UT-ORD-004\nfn valid_case() {}\n#[test]\nfn bare_case() {}\n'
    );

    const idErrs = verifyTestCaseIds(dir);
    assert.equal(idErrs.length, 4, JSON.stringify(idErrs));
    assert.ok(idErrs.some((e) => e.includes("coverage only without id")));
    assert.ok(idErrs.some((e) => e.includes("test_missing_id")));
    assert.ok(idErrs.some((e) => e.includes("TestNoId")));
    assert.ok(idErrs.some((e) => e.includes("bare_case")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log("PASS: governance test-spec checklist & 4-language test ID tests");
