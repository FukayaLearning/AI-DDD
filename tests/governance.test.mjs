import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verifyProject } from "../src/verifier.js";

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
