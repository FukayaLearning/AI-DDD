import fs from "node:fs";
import path from "node:path";

const CHECKLIST_CATEGORIES = [
  { key: "input boundary", label: "Input boundary & invalid values" },
  { key: "invalid state transition", label: "Invalid state transition" },
  { key: "external dependency failure", label: "External dependency failure" },
  { key: "persistence", label: "Persistence / storage failure" },
  { key: "duplicate", label: "Duplicate / concurrent conflict" },
  { key: "target not found", label: "Target not found" },
  { key: "locale", label: "Locale-specific rendering" },
];

const CASE_ID_IN_TEXT = /\b(?:UT|IT)-[A-Z]{2,5}-\d{3}\b/;
const CASE_ID_NORMALIZED = /(?:UT|IT)[_-][A-Z]{2,5}[_-]\d{3}/i;

function isTranslationMd(rel) {
  return /\.[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]+)*\.md$/.test(rel);
}

function walkFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      ["node_modules", ".git", "target", "__pycache__", ".venv", "dist", "coverage"].includes(
        entry.name
      )
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, results);
    } else {
      results.push(full);
    }
  }
  return results;
}

export function verifyIntegrationChecklists(absTarget) {
  const errors = [];
  const intDir = path.join(absTarget, "docs", "testing", "integration");
  if (!fs.existsSync(intDir)) return errors;

  const files = walkFiles(intDir).filter(
    (f) => f.endsWith(".md") && !isTranslationMd(path.relative(absTarget, f))
  );

  for (const f of files) {
    const rel = path.relative(absTarget, f).replace(/\\/g, "/");
    const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
    const foundCategories = new Map();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|")) continue;
      const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.length < 3) continue;
      const catCell = cells[0].toLowerCase();
      for (const cat of CHECKLIST_CATEGORIES) {
        if (catCell.includes(cat.key)) {
          foundCategories.set(cat.key, {
            caseIds: cells[1],
            naReason: cells[2],
          });
        }
      }
    }

    for (const cat of CHECKLIST_CATEGORIES) {
      const entry = foundCategories.get(cat.key);
      if (!entry) {
        errors.push(
          `[Incomplete Abnormal-Path Checklist] ${rel}: missing checklist row for '${cat.label}'`
        );
        continue;
      }
      const hasCaseId = CASE_ID_IN_TEXT.test(entry.caseIds);
      const hasNa = entry.naReason.length > 0 && entry.naReason !== "-";
      if (!hasCaseId && !hasNa) {
        errors.push(
          `[Incomplete Abnormal-Path Checklist] ${rel}: category '${cat.label}' requires IT-* case IDs or an N/A reason`
        );
      }
    }
  }

  return errors;
}

function isUnitOrBrowserTestFile(rel) {
  return (
    (/\.(test|spec)\.(ts|mts|js|mjs)$/.test(rel) ||
      /_test\.(py|go)$/.test(rel) ||
      /\/test_[^/]+\.py$/.test(rel) ||
      /^test_[^/]+\.py$/.test(rel) ||
      (rel.startsWith("tests/") && rel.endsWith(".rs"))) &&
    !rel.startsWith("scripts/")
  );
}

export function verifyTestCaseIds(absTarget) {
  const errors = [];
  const files = walkFiles(absTarget);

  for (const f of files) {
    const rel = path.relative(absTarget, f).replace(/\\/g, "/");
    const ext = path.extname(f);
    if (!isUnitOrBrowserTestFile(rel) && ext !== ".rs") continue;
    if (ext === ".rs" && !rel.startsWith("tests/")) {
      // Check inline #[cfg(test)] in src/ only if #[test] is present
      const raw = fs.readFileSync(f, "utf8");
      if (!raw.includes("#[test]")) continue;
    }

    const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);

    if (ext === ".ts" || ext === ".mts" || ext === ".js" || ext === ".mjs") {
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^\s*(?:test|it)\s*\(\s*["'`]([^"'`]+)["'`]/);
        if (m && !CASE_ID_IN_TEXT.test(m[1])) {
          errors.push(
            `[Missing Test Case ID] ${rel}:${i + 1}: test '${m[1]}' has no UT-*/IT-* specification ID`
          );
        }
      }
    } else if (ext === ".py") {
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^\s*(?:async\s+)?def\s+(test_[a-zA-Z0-9_]+)\s*\(/);
        if (!m) continue;
        const snippet = lines.slice(Math.max(0, i - 1), i + 3).join("\n");
        if (!CASE_ID_NORMALIZED.test(m[1]) && !CASE_ID_IN_TEXT.test(snippet)) {
          errors.push(
            `[Missing Test Case ID] ${rel}:${i + 1}: test '${m[1]}' has no UT-*/IT-* specification ID`
          );
        }
      }
    } else if (ext === ".go") {
      for (let i = 0; i < lines.length; i++) {
        const tm = lines[i].match(/^\s*func\s+(Test[a-zA-Z0-9_]+)\s*\(/);
        if (tm) {
          const prev = i > 0 ? lines[i - 1] : "";
          const blockSlice = lines.slice(i, i + 10).join("\n");
          // If it delegates to t.Run subtests, subtests carry the IDs
          if (blockSlice.includes("t.Run(")) continue;
          if (!CASE_ID_NORMALIZED.test(tm[1]) && !CASE_ID_IN_TEXT.test(prev)) {
            errors.push(
              `[Missing Test Case ID] ${rel}:${i + 1}: test '${tm[1]}' has no UT-*/IT-* specification ID`
            );
          }
          continue;
        }
        const rm = lines[i].match(/\bt\.Run\(\s*"([^"]+)"/);
        if (rm && !CASE_ID_IN_TEXT.test(rm[1])) {
          errors.push(
            `[Missing Test Case ID] ${rel}:${i + 1}: subtest '${rm[1]}' has no UT-*/IT-* specification ID`
          );
        }
      }
    } else if (ext === ".rs") {
      for (let i = 0; i < lines.length; i++) {
        if (!/^\s*#\[test\]/.test(lines[i])) continue;
        let fnName = "";
        let fnLine = i;
        for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
          const fm = lines[j].match(/\bfn\s+([a-zA-Z0-9_]+)\s*\(/);
          if (fm) {
            fnName = fm[1];
            fnLine = j;
            break;
          }
        }
        const preLines = [];
        for (let k = i - 1; k >= Math.max(0, i - 4); k--) {
          const t = lines[k].trim();
          if (t === "" || t.endsWith("}") || t.startsWith("fn ")) break;
          preLines.push(t);
        }
        const betweenLines = lines.slice(i, fnLine + 1);
        const context = [...preLines, ...betweenLines].join("\n");
        if (fnName && !CASE_ID_NORMALIZED.test(fnName) && !CASE_ID_IN_TEXT.test(context)) {
          errors.push(
            `[Missing Test Case ID] ${rel}:${i + 1}: test '${fnName}' has no UT-*/IT-* specification ID`
          );
        }
      }
    }
  }

  return errors;
}
