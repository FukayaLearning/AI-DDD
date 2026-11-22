import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { Session } from "node:inspector/promises";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(rootDir, "c1-coverage.config.json"), "utf8"));

function matchesExclude(relPath) {
  return config.exclude.some((pat) => {
    if (pat.endsWith("/**")) {
      return relPath.startsWith(pat.slice(0, -3));
    }
    return relPath === pat;
  });
}

function collectFiles(dir, suffix) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full, suffix));
    else if (entry.name.endsWith(suffix)) out.push(full);
  }
  return out.sort();
}

const session = new Session();
session.connect();
await session.post("Profiler.enable");
await session.post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });

const testFiles = collectFiles(path.join(rootDir, "tests", "unit"), ".mjs");
assert.ok(testFiles.length > 0, "No unit test files found under tests/unit/");

for (const tf of testFiles) {
  const mod = await import(pathToFileURL(tf).href);
  if (typeof mod.run === "function") {
    await mod.run();
  }
}

const { result } = await session.post("Profiler.takePreciseCoverage");
await session.post("Profiler.stopPreciseCoverage");

const srcFiles = collectFiles(path.join(rootDir, "src"), ".ts").filter((f) => {
  const rel = path.relative(rootDir, f).replace(/\\/g, "/");
  return !matchesExclude(rel);
});

const uncovered = [];
for (const absFile of srcFiles) {
  const url = pathToFileURL(absFile).href;
  const rel = path.relative(rootDir, absFile).replace(/\\/g, "/");
  const entry = result.find((r) => r.url === url);
  const srcText = fs.readFileSync(absFile, "utf8");
  const executableNonEmpty = srcText.replace(/import\s+type\s+[^;]+;|export\s+(?:type|interface)\s+[^{;]+(?:\{[^}]*\}|=[^;]+;)/g, "").trim();
  if (!entry) {
    if (executableNonEmpty.length > 0) {
      uncovered.push(`${rel}: file was never loaded/executed`);
    }
    continue;
  }
  for (const fn of entry.functions) {
    for (const range of fn.ranges) {
      if (range.count === 0) {
        const snippet = srcText.slice(range.startOffset, Math.min(range.endOffset, range.startOffset + 80)).replace(/\s+/g, " ");
        const line = srcText.slice(0, range.startOffset).split("\n").length;
        uncovered.push(`${rel}:${line} [${fn.functionName || "<module>"}] uncovered branch: "${snippet}"`);
      }
    }
  }
}

if (uncovered.length > 0) {
  console.error("C1 Branch Coverage FAILED (must be 100% outside exclusions):");
  for (const item of uncovered) console.error("  -", item);
  process.exit(1);
}

console.log(`PASS: 100% C1 branch coverage verified across ${srcFiles.length} non-excluded TypeScript files.`);
