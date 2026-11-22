import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const EXAMPLES = ["typescript", "python", "go", "rust"];
const TOOL_SKILLS = [
  ".agents/skills/ddd-workflow/SKILL.md",
  ".claude/skills/ddd-workflow/SKILL.md",
  ".github/skills/ddd-workflow/SKILL.md",
  ".hermes/skills/ddd-workflow/SKILL.md",
];

function listFiles(dir, base = dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFiles(full, base, results);
    } else {
      results.push(path.relative(base, full).replace(/\\/g, "/"));
    }
  }
  return results.sort();
}

const rootSchemaDir = path.join(ROOT, "schemas", "ddd-driven");
const rootSchemaFiles = listFiles(rootSchemaDir);
const rootSkillPath = path.join(ROOT, "skills", "ddd-workflow", "SKILL.md");
const rootSkillContent = fs.readFileSync(rootSkillPath, "utf8").replace(/\r\n/g, "\n");

const drifts = [];

for (const ex of EXAMPLES) {
  const exDir = path.join(ROOT, "examples", ex);
  if (!fs.existsSync(exDir)) continue;

  const exSchemaDir = path.join(exDir, "openspec", "schemas", "ddd-driven");
  const exSchemaFiles = fs.existsSync(exSchemaDir) ? listFiles(exSchemaDir) : [];

  for (const rel of rootSchemaFiles) {
    const src = path.join(rootSchemaDir, rel);
    const dst = path.join(exSchemaDir, rel);
    if (!fs.existsSync(dst)) {
      drifts.push(`Missing schema file in ${ex}: openspec/schemas/ddd-driven/${rel} (master: schemas/ddd-driven/${rel})`);
      continue;
    }
    const a = fs.readFileSync(src, "utf8").replace(/\r\n/g, "\n");
    const b = fs.readFileSync(dst, "utf8").replace(/\r\n/g, "\n");
    if (a !== b) {
      drifts.push(`Schema drift in ${ex}: openspec/schemas/ddd-driven/${rel} differs from schemas/ddd-driven/${rel}`);
    }
  }
  for (const rel of exSchemaFiles) {
    if (!rootSchemaFiles.includes(rel)) {
      drifts.push(`Extra schema file in ${ex}: openspec/schemas/ddd-driven/${rel} not in schemas/ddd-driven/`);
    }
  }

  for (const relSkill of TOOL_SKILLS) {
    const dst = path.join(exDir, relSkill);
    if (!fs.existsSync(dst)) {
      drifts.push(`Missing skill file in ${ex}: ${relSkill} (master: skills/ddd-workflow/SKILL.md)`);
      continue;
    }
    const b = fs.readFileSync(dst, "utf8").replace(/\r\n/g, "\n");
    if (b !== rootSkillContent) {
      drifts.push(`Skill drift in ${ex}: ${relSkill} differs from skills/ddd-workflow/SKILL.md`);
    }
  }
}

if (drifts.length > 0) {
  console.error("FAIL: Distributed copy drift detected:");
  for (const d of drifts) console.error("  -", d);
  process.exit(1);
}

console.log(`PASS: Zero drift across ${EXAMPLES.length} examples (schemas/ddd-driven & ddd-workflow skills).`);
