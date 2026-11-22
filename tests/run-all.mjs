import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

console.log("=== 1. CLI & Skeleton Tests ===");
execFileSync(process.execPath, [path.join(ROOT, "tests", "cli.test.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
});
execFileSync(process.execPath, [path.join(ROOT, "tests", "governance.test.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
});

const examplesDir = path.join(ROOT, "examples");
if (fs.existsSync(examplesDir)) {
  const langs = ["typescript", "python", "go", "rust"];
  for (const lang of langs) {
    const target = path.join(examplesDir, lang);
    if (!fs.existsSync(target)) continue;
    console.log(`\n=== 2. Verifying example: ${lang} ===`);
    execFileSync(process.execPath, [path.join(ROOT, "bin", "ai-ddd.js"), "verify", "--target", target], {
      cwd: ROOT,
      stdio: "inherit",
    });
    const runAll = path.join(target, "scripts", "run-all.sh");
    if (fs.existsSync(runAll)) {
      execFileSync("bash", [runAll], { cwd: target, stdio: "inherit" });
    }
  }
}
