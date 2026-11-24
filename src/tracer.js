import fs from "node:fs";
import path from "node:path";
import { loadProjectConfig } from "./config.js";

const REQ_HEADING_RE = /^###\s+Requirement:\s*(.+)$/;
const SCN_HEADING_RE = /^####\s+Scenario:\s*(.+)$/;
const REQ_ID_RE = /^(REQ-[A-Z]{2,5}-\d{3})\b/;
const SCN_ID_RE = /^(SCN-[A-Z]{2,5}-\d{3}-\d{2})\b/;
const CASE_ID_RE = /\b((?:UT|IT)-[A-Z]{2,5}-\d{3})\b/g;
const REQ_REF_RE = /\b(REQ-[A-Z]{2,5}-\d{3})\b/g;
const SCN_REF_RE = /\b(SCN-[A-Z]{2,5}-\d{3}-\d{2})\b/g;
const IMPLEMENTS_RE = /@implements\s+(REQ-[A-Z]{2,5}-\d{3})\b/g;

const SOURCE_EXTS = new Set([".ts", ".mts", ".js", ".mjs", ".py", ".go", ".rs", ".sh"]);

function walk(dir, filterFn, results = []) {
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
      walk(full, filterFn, results);
    } else if (filterFn(full, entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function isTranslationMd(rel) {
  return /\.[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]+)*\.md$/.test(rel);
}

function isTestFilePath(rel) {
  return (
    rel.startsWith("tests/") ||
    rel.includes("/tests/") ||
    /\.(test|spec)\.(ts|mts|js|mjs)$/.test(rel) ||
    /_test\.(py|go)$/.test(rel) ||
    /\/test_[^/]+\.py$/.test(rel) ||
    /^test_[^/]+\.py$/.test(rel) ||
    rel === "scripts/test-integration.sh"
  );
}

function parseSpecFiles(absTarget, includeChanges, expectedContextCode) {
  const specFiles = [];
  const mainSpecsDir = path.join(absTarget, "openspec", "specs");
  for (const f of walk(mainSpecsDir, (p, n) => n.endsWith(".md"))) {
    const rel = path.relative(absTarget, f).replace(/\\/g, "/");
    if (!isTranslationMd(rel)) specFiles.push(f);
  }
  if (includeChanges) {
    const changesDir = path.join(absTarget, "openspec", "changes");
    if (fs.existsSync(changesDir)) {
      for (const entry of fs.readdirSync(changesDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name === "archive") continue;
        const cSpecs = path.join(changesDir, entry.name, "specs");
        for (const f of walk(cSpecs, (p, n) => n.endsWith(".md"))) {
          specFiles.push(f);
        }
      }
    }
  }

  const requirements = new Map();
  const scenarios = new Map();
  const errors = [];

  for (const f of specFiles) {
    const rel = path.relative(absTarget, f).replace(/\\/g, "/");
    const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
    let currentReqId = null;

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const rm = line.match(REQ_HEADING_RE);
      if (rm) {
        const title = rm[1].trim();
        const idm = title.match(REQ_ID_RE);
        if (!idm) {
          errors.push(`[Missing Requirement ID] ${rel}:${idx + 1}: '${title}' must start with REQ-<CTX>-<NNN>`);
          currentReqId = null;
        } else {
          const id = idm[1];
          const reqCtx = id.split("-")[1];
          if (expectedContextCode && reqCtx !== expectedContextCode) {
            errors.push(
              `[Context Code Mismatch] ${rel}:${idx + 1}: '${id}' does not match configured context code '${expectedContextCode}'`
            );
          }
          if (requirements.has(id)) {
            errors.push(`[Duplicate Requirement ID] ${rel}:${idx + 1}: '${id}' already defined in ${requirements.get(id).file}`);
          } else {
            requirements.set(id, { id, title, file: rel, line: idx + 1, scenarios: [] });
          }
          currentReqId = id;
        }
        continue;
      }

      const sm = line.match(SCN_HEADING_RE);
      if (sm) {
        const title = sm[1].trim();
        const idm = title.match(SCN_ID_RE);
        if (!idm) {
          errors.push(`[Missing Scenario ID] ${rel}:${idx + 1}: '${title}' must start with SCN-<CTX>-<NNN>-<NN>`);
        } else {
          const id = idm[1];
          if (currentReqId) {
            const expectedPrefix = `SCN-${currentReqId.slice(4)}-`;
            if (!id.startsWith(expectedPrefix)) {
              errors.push(
                `[Scenario Parent Mismatch] ${rel}:${idx + 1}: '${id}' must start with '${expectedPrefix}' under '${currentReqId}'`
              );
            }
          }
          if (scenarios.has(id)) {
            errors.push(`[Duplicate Scenario ID] ${rel}:${idx + 1}: '${id}' already defined in ${scenarios.get(id).file}`);
          } else {
            scenarios.set(id, { id, title, reqId: currentReqId, file: rel, line: idx + 1 });
            if (currentReqId && requirements.has(currentReqId)) {
              requirements.get(currentReqId).scenarios.push(id);
            }
          }
        }
      }
    }
  }

  return { requirements, scenarios, errors };
}

function parseTestSpecTables(absTarget) {
  const testCases = new Map();
  const errors = [];
  const testingDir = path.join(absTarget, "docs", "testing");
  const files = walk(testingDir, (p, n) => n.endsWith(".md") && !isTranslationMd(path.relative(absTarget, p)));

  for (const f of files) {
    const rel = path.relative(absTarget, f).replace(/\\/g, "/");
    const level = rel.includes("/integration/") ? "IT" : "UT";
    const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx].trim();
      if (!line.startsWith("|")) continue;
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.length < 3) continue;
      const idMatch = cells[0].match(/`?((?:UT|IT)-[A-Z]{2,5}-\d{3})`?/);
      if (!idMatch) continue;
      const id = idMatch[1];
      if (testCases.has(id)) {
        errors.push(`[Duplicate Test Case ID] ${rel}:${idx + 1}: '${id}' already defined in ${testCases.get(id).file}`);
        continue;
      }
      const reqRefs = [...new Set(line.match(REQ_REF_RE) || [])];
      const scnRefs = [...new Set(line.match(SCN_REF_RE) || [])];
      testCases.set(id, { id, level, file: rel, line: idx + 1, reqRefs, scnRefs });
    }
  }

  return { testCases, errors };
}

function scanCodeAndTests(absTarget) {
  const testRefs = new Map(); // caseId -> Set<relFile>
  const implRefs = new Map(); // reqId -> Set<relFile>

  const allFiles = walk(absTarget, (full) => SOURCE_EXTS.has(path.extname(full)));
  for (const f of allFiles) {
    const rel = path.relative(absTarget, f).replace(/\\/g, "/");
    const content = fs.readFileSync(f, "utf8");

    if (isTestFilePath(rel) || rel.endsWith(".rs")) {
      let m;
      CASE_ID_RE.lastIndex = 0;
      while ((m = CASE_ID_RE.exec(content)) !== null) {
        if (!testRefs.has(m[1])) testRefs.set(m[1], new Set());
        testRefs.get(m[1]).add(rel);
      }
    }

    if (!isTestFilePath(rel)) {
      let m;
      IMPLEMENTS_RE.lastIndex = 0;
      while ((m = IMPLEMENTS_RE.exec(content)) !== null) {
        if (!implRefs.has(m[1])) implRefs.set(m[1], new Set());
        implRefs.get(m[1]).add(rel);
      }
    }
  }

  return { testRefs, implRefs };
}

export function analyzeTraceability(targetDir, { includeChanges = false } = {}) {
  const absTarget = path.resolve(targetDir);
  const cfg = loadProjectConfig(absTarget);
  const expectedContextCode = cfg.config?.context?.code || "";
  const enforceScenarioUseCase = cfg.config?.traceability?.scenarioUseCase !== false;
  const { requirements, scenarios, errors: specErrors } = parseSpecFiles(
    absTarget,
    includeChanges,
    expectedContextCode
  );
  const { testCases, errors: tcErrors } = parseTestSpecTables(absTarget);
  const { testRefs, implRefs } = scanCodeAndTests(absTarget);

  const errors = [...specErrors, ...tcErrors];

  // Check orphan references in test specs
  for (const tc of testCases.values()) {
    for (const r of tc.reqRefs) {
      if (!requirements.has(r)) {
        errors.push(`[Orphan Spec Reference] ${tc.file}:${tc.line} (${tc.id}) references unknown ${r}`);
      }
    }
    for (const s of tc.scnRefs) {
      if (!scenarios.has(s)) {
        errors.push(`[Orphan Spec Reference] ${tc.file}:${tc.line} (${tc.id}) references unknown ${s}`);
      }
    }
    if (!testRefs.has(tc.id)) {
      errors.push(`[Missing Automated Test] ${tc.id} (${tc.file}:${tc.line}) is not referenced by any test`);
    }
  }

  // Check orphan references in test code & @implements
  for (const [id, files] of testRefs.entries()) {
    if (!testCases.has(id)) {
      errors.push(`[Orphan Test Case Reference] ${[...files].join(", ")} references undefined test case ${id}`);
    }
  }
  for (const [reqId, files] of implRefs.entries()) {
    if (!requirements.has(reqId)) {
      errors.push(`[Orphan @implements Reference] ${[...files].join(", ")} declares @implements ${reqId} which is not in specs`);
    }
  }

  // Check coverage of Requirements & Scenarios
  for (const req of requirements.values()) {
    if (!implRefs.has(req.id)) {
      errors.push(`[Unimplemented Requirement] ${req.id} (${req.file}:${req.line}) has no @implements annotation in source`);
    }
  }
  for (const scn of scenarios.values()) {
    const coveringIts = [...testCases.values()].filter(
      (tc) => tc.level === "IT" && tc.scnRefs.includes(scn.id)
    );
    if (coveringIts.length === 0) {
      errors.push(`[Uncovered Scenario] ${scn.id} (${scn.file}:${scn.line}) has no IT-* case in integration test specs`);
    }
  }

  // Check Scenario ↔ Application UseCase 1-to-1 correspondence
  if (enforceScenarioUseCase) {
    for (const scn of scenarios.values()) {
      const coveringUts = [...testCases.values()].filter(
        (tc) => tc.level === "UT" && tc.scnRefs.includes(scn.id)
      );
      if (coveringUts.length === 0) {
        errors.push(
          `[Scenario/UseCase Mismatch] ${scn.id} (${scn.file}:${scn.line}) has no UT-* UseCase test; map each Scenario 1-to-1 to an Application UseCase test`
        );
      }
    }
    for (const tc of testCases.values()) {
      if (tc.level === "UT" && tc.scnRefs.length > 1) {
        errors.push(
          `[Scenario/UseCase Mismatch] ${tc.id} (${tc.file}:${tc.line}) references ${tc.scnRefs.length} Scenarios; a UT-* case must map 1-to-1 to exactly one Scenario (use IT-* for multi-Scenario coverage)`
        );
      }
    }
  }

  // Build matrix rows
  const rows = [];
  for (const req of requirements.values()) {
    const reqScns = req.scenarios;
    const utIds = [...testCases.values()]
      .filter((tc) => tc.level === "UT" && (tc.reqRefs.includes(req.id) || tc.scnRefs.some((s) => reqScns.includes(s))))
      .map((tc) => tc.id);
    const itIds = [...testCases.values()]
      .filter((tc) => tc.level === "IT" && (tc.reqRefs.includes(req.id) || tc.scnRefs.some((s) => reqScns.includes(s))))
      .map((tc) => tc.id);
    const testFiles = new Set();
    for (const id of [...utIds, ...itIds]) {
      for (const f of testRefs.get(id) || []) testFiles.add(f);
    }
    const implFiles = [...(implRefs.get(req.id) || [])];

    rows.push({
      requirement: req.id,
      scenarios: reqScns,
      unitCases: utIds,
      integrationCases: itIds,
      testFiles: [...testFiles],
      implementationFiles: implFiles,
    });
  }

  return {
    ok: errors.length === 0,
    target: absTarget,
    summary: {
      requirements: requirements.size,
      scenarios: scenarios.size,
      testCases: testCases.size,
    },
    rows,
    errors,
  };
}

export function renderTraceabilityMatrix(report) {
  const lines = [
    "<!-- generated by ai-ddd trace; do not edit -->",
    "",
    "# Traceability Matrix",
    "",
    `- Requirements: ${report.summary.requirements}`,
    `- Scenarios: ${report.summary.scenarios}`,
    `- Test Cases: ${report.summary.testCases}`,
    "",
    "| Requirement | Scenarios | Unit Cases | Integration Cases | Test Files | Implementation Files |",
    "| :--- | :--- | :--- | :--- | :--- | :--- |",
  ];
  for (const r of report.rows) {
    lines.push(
      `| ${r.requirement} | ${r.scenarios.join(", ") || "-"} | ${r.unitCases.join(", ") || "-"} | ${r.integrationCases.join(", ") || "-"} | ${r.testFiles.join(", ") || "-"} | ${r.implementationFiles.join(", ") || "-"} |`
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function writeTraceabilityMatrix(targetDir, report) {
  const outPath = path.join(path.resolve(targetDir), "docs", "traceability", "matrix.md");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, renderTraceabilityMatrix(report), "utf8");
  return outPath;
}
