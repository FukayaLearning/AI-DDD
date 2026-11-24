import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_MAX_FILES_PER_DIR, loadProjectConfig } from "./config.js";
import { verifyTranslations, verifyUiCatalogs } from "./i18n.js";
import { verifyIntegrationChecklists, verifyTestCaseIds } from "./test-spec.js";
import { analyzeTraceability } from "./tracer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLATFORM_SCHEMA_PATH = path.resolve(__dirname, "..", "schemas", "ddd-driven", "schema.yaml");

function readSchemaVersion(schemaYamlPath) {
  if (!fs.existsSync(schemaYamlPath)) return null;
  const text = fs.readFileSync(schemaYamlPath, "utf8");
  const m = text.match(/^version:\s*(\d+)\s*$/m);
  return m ? Number(m[1]) : null;
}

const INLINE_IGNORE_PATTERNS = [
  { name: "istanbul ignore", regex: /istanbul\s+ignore/i },
  { name: "v8 ignore", regex: /v8\s+ignore/i },
  { name: "c8 ignore", regex: /c8\s+ignore/i },
  { name: "pragma: no cover", regex: /pragma:\s*no\s+cover/i },
  { name: "#[coverage(off)]", regex: /#\[\s*coverage\s*\(\s*off\s*\)\s*\]/i },
  { name: "//go:build ignore", regex: /\/\/go:build\s+ignore/i },
];

const ALLOWED_LAYER_DEPS = {
  domain: new Set([]),
  application: new Set(["domain"]),
  infrastructure: new Set(["domain", "application"]),
  presentation: new Set(["application", "domain"]),
  main: new Set(["domain", "application", "infrastructure", "presentation"]),
};

const SOURCE_EXTENSIONS = new Set([".ts", ".mts", ".js", ".mjs", ".py", ".go", ".rs"]);
const MODULE_DECLARATION_FILES = new Set(["mod.rs", "lib.rs", "__init__.py"]);
const SUBDIVIDED_LAYERS = new Set(["domain", "application", "infrastructure", "presentation"]);

// Tactical-pattern / role folder whitelist for the 2nd level of each layer.
const LAYER_PATTERN_WHITELIST = {
  domain: new Set(["entities", "value_objects", "services", "repositories", "shared"]),
  application: new Set(["services", "ports", "dtos"]),
  infrastructure: new Set(["repositories", "gateways", "mappers", "drivers"]),
  presentation: new Set(["controllers", "views", "i18n"]),
};

// Pattern folders that may legitimately contain files directly (no aggregate subfolder).
const PATTERN_FOLDERS_ALLOWING_DIRECT_FILES = new Set(["domain/shared", "presentation/i18n"]);

function walkFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "target" ||
      entry.name === "__pycache__" ||
      entry.name === ".venv" ||
      entry.name === "dist" ||
      entry.name === "coverage"
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

function stripCommentsAndStrings(code, ext) {
  let out = "";
  let i = 0;
  const n = code.length;
  while (i < n) {
    const ch = code[i];
    const next = code[i + 1];

    if (ext === ".py") {
      if (ch === "#") {
        while (i < n && code[i] !== "\n") i++;
        continue;
      }
      if ((ch === '"' || ch === "'") && code.slice(i, i + 3) === ch.repeat(3)) {
        const quote = ch.repeat(3);
        i += 3;
        while (i < n && code.slice(i, i + 3) !== quote) {
          if (code[i] === "\\") i += 2;
          else i++;
        }
        i += 3;
        out += ' "" ';
        continue;
      }
      if (ch === '"' || ch === "'") {
        const q = ch;
        i++;
        while (i < n && code[i] !== q) {
          if (code[i] === "\\") i += 2;
          else i++;
        }
        i++;
        out += ' "" ';
        continue;
      }
      out += ch;
      i++;
      continue;
    }

    // C-like comments & strings for TS/JS/Go/Rust
    if (ch === "/" && next === "/") {
      while (i < n && code[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < n && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      // Rust lifetimes like 'a or &'static should not eat until next single quote
      if (ext === ".rs" && ch === "'") {
        const after = code.slice(i + 1, i + 4);
        if (/^[a-zA-Z_][a-zA-Z0-9_]*\b/.test(after) && code[i + 2] !== "'") {
          out += ch;
          i++;
          continue;
        }
      }
      const q = ch;
      i++;
      while (i < n && code[i] !== q) {
        if (code[i] === "\\") i += 2;
        else i++;
      }
      i++;
      out += ' "" ';
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function detectLayer(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  if (/^(src|internal)\/domain(\/|$)/.test(norm)) return "domain";
  if (/^(src|internal)\/application(\/|$)/.test(norm)) return "application";
  if (/^(src|internal)\/infrastructure(\/|$)/.test(norm)) return "infrastructure";
  if (/^(src|internal)\/presentation(\/|$)/.test(norm)) return "presentation";
  if (/^(src\/main\.(ts|mts|js|mjs|py|rs)|cmd\/.+\.go)$/.test(norm)) return "main";
  return null;
}

function detectLayerSubpath(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  const m = norm.match(/^(?:src|internal)\/(domain|application|infrastructure|presentation)\/(.+)$/);
  if (!m) return null;
  const layer = m[1];
  const rest = m[2];
  const parts = rest.split("/");
  return {
    layer,
    parts,
    isLooseRootFile: parts.length === 1,
    pattern: parts.length >= 2 ? parts[0] : null,
    moduleName: parts.length >= 2 ? parts[1] : null,
  };
}

function parsePythonDomainTarget(modText, relPath) {
  // Absolute import: domain.<pattern>.<aggregate>
  const abs = modText.match(/(?:^|\.)domain\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/);
  if (abs) return { pattern: abs[1], aggregate: abs[2] };

  const rel = modText.match(/^(\.+)([a-zA-Z0-9_.]+)/);
  if (!rel) return null;
  const dots = rel[1].length;
  const segs = rel[2].split(".").filter(Boolean);
  if (segs[0] === "domain") {
    return segs.length >= 2
      ? { pattern: segs[1], aggregate: segs[2] ?? null }
      : null;
  }

  const norm = relPath.replace(/\\/g, "/");
  const pm = norm.match(/^(?:src|internal)\/(.+)\/[^/]+\.py$/);
  if (!pm) return null;
  const pkgSegs = pm[1].split("/");
  const ascend = dots - 1;
  const baseSegs = pkgSegs.slice(0, Math.max(0, pkgSegs.length - ascend));
  const di = baseSegs.lastIndexOf("domain");
  if (di === -1) return null;
  const remaining = baseSegs.slice(di + 1).concat(segs);
  if (remaining.length === 0) return null;
  return { pattern: remaining[0], aggregate: remaining[1] ?? null };
}

function extractDomainAggregateDeps(rawCode, ext, relPath) {
  const code = ext === ".rs" ? isRustModTestBlockRemoved(rawCode) : rawCode;
  const sub = detectLayerSubpath(relPath);
  // Aggregate isolation applies to 3rd-level modules: domain/<pattern>/<aggregate>/
  if (!sub || sub.layer !== "domain" || sub.parts.length < 3 || sub.pattern === "shared") {
    return [];
  }
  const selfAgg = sub.moduleName;
  if (!selfAgg || selfAgg === "shared") {
    return [];
  }
  const selfPattern = sub.pattern;
  const found = [];

  const record = (pattern, aggregate) => {
    if (!pattern || pattern === "shared") return;
    if (!aggregate || aggregate === selfAgg || aggregate === "shared") return;
    found.push({ pattern, aggregate });
  };

  if (ext === ".ts" || ext === ".mts" || ext === ".js" || ext === ".mjs") {
    const importRegex = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
    let m;
    while ((m = importRegex.exec(code)) !== null) {
      const spec = m[1] || m[2];
      if (!spec.startsWith(".")) continue;
      const resolved = path.posix.normalize(
        path.posix.join("/", path.posix.dirname(relPath.replace(/\\/g, "/")), spec)
      );
      const dm = resolved.match(/^\/(?:src|internal)\/domain\/([^/]+)\/([^/]+)/);
      if (dm) record(dm[1], dm[2]);
    }
  } else if (ext === ".py") {
    const pyRegex = /^\s*(?:from\s+([.\w]+)\s+import|import\s+([\w.,\s]+))/gm;
    let m;
    while ((m = pyRegex.exec(code)) !== null) {
      const target = parsePythonDomainTarget(m[1] || m[2], relPath);
      if (target) record(target.pattern, target.aggregate);
    }
  } else if (ext === ".go") {
    const importBlock = code.match(/import\s*(?:\([^)]*\)|"[^"]+")/g) || [];
    for (const block of importBlock) {
      const goRegex = /["']([^"']+)["']/g;
      let m;
      while ((m = goRegex.exec(block)) !== null) {
        const dm = m[1].match(/(?:^|\/)internal\/domain\/([^/"']+)\/([^/"']+)/);
        if (dm) record(dm[1], dm[2]);
      }
    }
  } else if (ext === ".rs") {
    const rustRegex = /\b(?:use\s+)?crate::domain::([a-zA-Z0-9_]+)::([a-zA-Z0-9_]+)/g;
    let m;
    while ((m = rustRegex.exec(code)) !== null) {
      record(m[1], m[2]);
    }
  }

  const unique = new Map();
  for (const dep of found) unique.set(`${dep.pattern}/${dep.aggregate}`, dep);
  return [...unique.values()];
}

function isDriverFile(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  return /^(src|internal)\/infrastructure\/drivers\/.+/.test(norm) && !isTestFile(norm);
}

function isTestFile(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  return (
    norm.startsWith("tests/") ||
    norm.includes("/tests/") ||
    /\.(test|spec)\.(ts|mts|js|mjs)$/.test(norm) ||
    /_test\.(py|go)$/.test(norm) ||
    /\/test_[^/]+\.py$/.test(norm) ||
    /^test_[^/]+\.py$/.test(norm)
  );
}

function isRustModTestBlockRemoved(code) {
  // Strip #[cfg(test)] mod tests { ... } when checking Rust source files if inline tests exist
  const idx = code.indexOf("#[cfg(test)]");
  return idx === -1 ? code : code.slice(0, idx);
}

function extractLayerImports(rawCode, ext, relPath) {
  const code = ext === ".rs" ? isRustModTestBlockRemoved(rawCode) : rawCode;
  const deps = new Set();
  const layers = ["domain", "application", "infrastructure", "presentation"];

  if (ext === ".ts" || ext === ".mts" || ext === ".js" || ext === ".mjs") {
    const importRegex = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
    let m;
    while ((m = importRegex.exec(code)) !== null) {
      const spec = m[1] || m[2];
      for (const layer of layers) {
        if (
          new RegExp(`(^|/)${layer}(/|$)`).test(spec) ||
          spec.includes(`/${layer}.`) ||
          spec === `./${layer}` ||
          spec === `../${layer}`
        ) {
          deps.add(layer);
        }
      }
    }
  } else if (ext === ".py") {
    const pyImportRegex = /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.,\s]+))/gm;
    let m;
    while ((m = pyImportRegex.exec(code)) !== null) {
      const modText = m[1] || m[2];
      for (const layer of layers) {
        if (new RegExp(`(^|\\.)${layer}(\\.|$|,|\\s)`).test(modText)) {
          deps.add(layer);
        }
      }
    }
  } else if (ext === ".go") {
    const goImportRegex = /["']([^"']+)["']/g;
    const importBlock = code.match(/import\s*(?:\([^)]*\)|"[^"]+")/g) || [];
    for (const block of importBlock) {
      let m;
      while ((m = goImportRegex.exec(block)) !== null) {
        const spec = m[1];
        for (const layer of layers) {
          if (new RegExp(`/internal/${layer}(/|$)`).test(spec)) {
            deps.add(layer);
          }
        }
      }
    }
  } else if (ext === ".rs") {
    const rustUseRegex = /\b(?:use\s+)?crate::(domain|application|infrastructure|presentation)(?:::|;|\b)/g;
    let m;
    while ((m = rustUseRegex.exec(code)) !== null) {
      deps.add(m[1]);
    }
  }

  const selfLayer = detectLayer(relPath);
  if (selfLayer) deps.delete(selfLayer);
  return [...deps];
}

function detectBranchesInDriver(rawCode, ext) {
  const codeWithoutTests = ext === ".rs" ? isRustModTestBlockRemoved(rawCode) : rawCode;
  const cleaned = stripCommentsAndStrings(codeWithoutTests, ext);
  const findings = [];

  const keywordRegex =
    ext === ".py"
      ? /\b(if|elif|else|match|case)\b/g
      : /\b(if|else|switch|case|match)\b/g;

  let m;
  while ((m = keywordRegex.exec(cleaned)) !== null) {
    // Allow Rust `match`? No, drivers must be branchless too.
    findings.push(`conditional keyword '${m[1]}'`);
  }

  if (ext === ".ts" || ext === ".mts" || ext === ".js" || ext === ".mjs") {
    // Detect ternary `cond ? a : b` while ignoring optional type annotation `prop?: Type`
    const noTypeAnnotations = cleaned.replace(/[A-Za-z0-9_$]\s*\?\s*:/g, "");
    if (/\?[^:?\n]+:/.test(noTypeAnnotations)) {
      findings.push("ternary conditional operator '? :'");
    }
  }

  return [...new Set(findings)];
}

const TECHNICAL_UL_TERMS = new Set(["Result<T, E>", "Result<T,E>", "DomainError"]);

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isEncapsulationCandidate(rel, typeName) {
  if (rel.includes("/value_objects/")) return true;
  if (!rel.includes("/entities/")) return false;
  return !/(?:Error|Status|Event|Dto|View|Response|Record|Snapshot)$/.test(typeName);
}

function checkAggregateEncapsulation(domainSources) {
  const findings = [];
  for (const { rel, content, ext } of domainSources) {
    if (ext === ".go") {
      const structRegex = /type\s+(\w+)\s+struct\s*\{([\s\S]*?)\n\}/g;
      let m;
      while ((m = structRegex.exec(content)) !== null) {
        const typeName = m[1];
        if (!isEncapsulationCandidate(rel, typeName)) continue;
        for (const line of m[2].split("\n")) {
          const field = line.match(/^\s*([A-Z][A-Za-z0-9_]*)\s+/);
          if (field) {
            findings.push(
              `[Model Integrity] ${rel}: ${typeName} exposes exported field '${field[1]}'; use unexported fields and read-only accessors`
            );
          }
        }
      }
    } else if (ext === ".rs") {
      const structRegex = /pub\s+struct\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
      let m;
      while ((m = structRegex.exec(content)) !== null) {
        const typeName = m[1];
        if (!isEncapsulationCandidate(rel, typeName)) continue;
        for (const line of m[2].split("\n")) {
          const field = line.match(/^\s*pub\s+([a-zA-Z_]\w*)\s*:/);
          if (field) {
            findings.push(
              `[Model Integrity] ${rel}: ${typeName} exposes public field '${field[1]}'; use private fields and accessors`
            );
          }
        }
      }
    } else if (ext === ".py" && rel.includes("/value_objects/")) {
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const deco = lines[i].match(/@dataclass\(([^)]*)\)/);
        if (!deco || !deco[1].includes("frozen=True")) continue;
        let classLine = -1;
        for (let j = i + 1; j < lines.length; j++) {
          if (/^\s*class\s+(\w+)/.test(lines[j])) {
            classLine = j;
            break;
          }
          if (lines[j].trim() !== "" && !/^\s*$/.test(lines[j])) break;
        }
        if (classLine === -1) continue;
        const className = lines[classLine].match(/^\s*class\s+(\w+)/)[1];
        const body = [];
        for (let j = classLine + 1; j < lines.length; j++) {
          if (lines[j].trim() !== "" && !/^\s/.test(lines[j])) break;
          body.push(lines[j]);
        }
        const bodyText = body.join("\n");
        if (!deco[1].includes("init=False") && !bodyText.includes("__post_init__")) {
          findings.push(
            `[Model Integrity] ${rel}: value object ${className} has no __post_init__ validation or init=False factory-only construction`
          );
        }
      }
    } else if (ext === ".ts" && rel.includes("/value_objects/")) {
      if (/export\s+interface\s+\w+/.test(content)) {
        findings.push(
          `[Model Integrity] ${rel}: value objects exported as interfaces can be structurally forged; use classes or branded types`
        );
      }
    }
  }
  return findings;
}

function findRecordOnlyDeclaration(absTarget) {
  const changesDir = path.join(absTarget, "openspec", "changes");
  if (!fs.existsSync(changesDir)) return false;
  return walkFiles(changesDir)
    .filter((file) => path.basename(file) === "design.md")
    .some((file) => /record-only|record only|記録のみ|記録するのみ/i.test(fs.readFileSync(file, "utf8")));
}

function checkEventLifecycle(absTarget, domainSources, allSources) {
  const recordsEvents = domainSources.some((s) => /\b(?:DomainEvent|Order\w*Event)\b/.test(s.content));
  if (!recordsEvents) return [];
  const lifecycle = allSources.some((s) =>
    /\b(?:pullEvents|clearEvents|PullEvents|ClearEvents|pull_events|clear_events)\b/.test(s.content)
  );
  const dispatch = allSources.some((s) =>
    /\b(?:DomainEventPublisher|EventPublisher|publishEvents|PublishEvents|publish_events|publishEvent)\b/.test(
      s.content
    )
  );
  if ((lifecycle && dispatch) || findRecordOnlyDeclaration(absTarget)) return [];
  return [
    `[Model Integrity] Domain events are recorded but no pull/clear + dispatch path (or explicit record-only declaration) was found; add DomainEventPublisher and pull/clear handling, or declare record-only in design.md`
  ];
}

function checkUbiquitousLanguage(absTarget, allSources) {
  const ulPath = path.join(absTarget, "docs", "domain", "ubiquitous-language.md");
  if (!fs.existsSync(ulPath)) return [];
  const terms = [];
  for (const line of fs.readFileSync(ulPath, "utf8").split("\n")) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (m) terms.push(m[1]);
  }
  const sourceText = allSources.map((s) => s.content).join("\n");
  const findings = [];
  for (const raw of terms) {
    const term = raw.replace(/<[^>]*>/g, "").trim();
    if (!term || TECHNICAL_UL_TERMS.has(raw) || /(?:Port|Repository|Dto|Command|Error)$/.test(term)) continue;
    const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`);
    if (!regex.test(sourceText)) {
      findings.push(
        `[Model Integrity] Ubiquitous-language term '${raw}' does not appear as a domain identifier in the source tree`
      );
    }
  }
  return findings;
}

function verifyModelIntegrity(absTarget, domainSources, allSources, cfg) {
  const rules = cfg?.rules ?? {};
  const findings = [];
  if (rules.encapsulation !== false) findings.push(...checkAggregateEncapsulation(domainSources));
  if (rules.eventLifecycle !== false) findings.push(...checkEventLifecycle(absTarget, domainSources, allSources));
  if (rules.ubiquitousLanguage !== false) findings.push(...checkUbiquitousLanguage(absTarget, allSources));
  return findings;
}

export function verifyProject(targetDir) {
  const absTarget = path.resolve(targetDir);
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(absTarget)) {
    return {
      ok: false,
      target: absTarget,
      errors: [`Target directory does not exist: ${absTarget}`],
      warnings,
      stats: { filesChecked: 0, driverFilesChecked: 0 },
    };
  }

  // 1. OpenSpec + Strategic DDD docs check
  const configPath = path.join(absTarget, "openspec", "config.yaml");
  if (!fs.existsSync(configPath)) {
    errors.push("Missing openspec/config.yaml");
  } else {
    const cfg = fs.readFileSync(configPath, "utf8");
    if (!/^schema:\s*ddd-driven\s*$/m.test(cfg)) {
      errors.push("openspec/config.yaml must set 'schema: ddd-driven'");
    }
  }

  const ulPath = path.join(absTarget, "docs", "domain", "ubiquitous-language.md");
  const cmPath = path.join(absTarget, "docs", "domain", "context-map.md");
  if (!fs.existsSync(ulPath)) errors.push("Missing docs/domain/ubiquitous-language.md");
  if (!fs.existsSync(cmPath)) errors.push("Missing docs/domain/context-map.md");

  const loadedCfg = loadProjectConfig(absTarget);
  if (loadedCfg.error) {
    errors.push(`Invalid ${path.basename(loadedCfg.path)}: ${loadedCfg.error}`);
  }
  const projectSchemaVersion = loadedCfg.exists ? (loadedCfg.config?.schemaVersion ?? 1) : 1;
  const strictV2 = projectSchemaVersion >= 2;
  const v2Sink = strictV2 ? errors : warnings;
  const maxFilesPerDir =
    loadedCfg.config?.structure?.maxFilesPerDirectory ?? DEFAULT_MAX_FILES_PER_DIR;
  const userLocale = loadedCfg.config?.locale?.user ?? "en";

  const currentSchemaVer = readSchemaVersion(PLATFORM_SCHEMA_PATH) ?? 2;
  const targetSchemaVer = readSchemaVersion(
    path.join(absTarget, "openspec", "schemas", "ddd-driven", "schema.yaml")
  );
  if (targetSchemaVer !== null && targetSchemaVer < currentSchemaVer) {
    warnings.push(
      `[Outdated Schema] openspec/schemas/ddd-driven/schema.yaml is version ${targetSchemaVer} (current: ${currentSchemaVer}); run 'ai-ddd install-schema --target .' to update`
    );
  }

  // 2. Scan source files
  const allFiles = walkFiles(absTarget);
  let filesChecked = 0;
  let driverFilesChecked = 0;
  const dirFileCounts = new Map();
  const allSources = [];
  const domainSources = [];

  for (const file of allFiles) {
    const rel = path.relative(absTarget, file).replace(/\\/g, "/");
    const ext = path.extname(file);
    if (!SOURCE_EXTENSIONS.has(ext)) continue;
    if (isTestFile(rel)) continue;
    if (rel.startsWith("scripts/")) continue;

    const layer = detectLayer(rel);
    if (!layer && !rel.startsWith("src/") && !rel.startsWith("internal/") && !rel.startsWith("cmd/")) {
      continue;
    }

    filesChecked++;
    const relDir = path.posix.dirname(rel);
    dirFileCounts.set(relDir, (dirFileCounts.get(relDir) || 0) + 1);
    const content = fs.readFileSync(file, "utf8");
    allSources.push({ rel, content, ext });
    if (layer === "domain") domainSources.push({ rel, content, ext });

    // Structure rules: tactical-pattern whitelist, no loose files, & aggregate isolation
    const subpath = detectLayerSubpath(rel);
    if (subpath && SUBDIVIDED_LAYERS.has(subpath.layer)) {
      const isModuleDeclaration = MODULE_DECLARATION_FILES.has(path.posix.basename(rel));

      // 1st level: no loose source files directly under a layer root.
      if (subpath.isLooseRootFile) {
        if (!isModuleDeclaration) {
          v2Sink.push(
            `[Loose Layer File] ${rel} (layer '${subpath.layer}'): place source files inside <layer>/<tactical-pattern>/<aggregate-or-module>/ (e.g., ${subpath.layer}/shared/ or ${subpath.layer}/<pattern>/<module>/)`
          );
        }
      } else {
        const patternKey = `${subpath.layer}/${subpath.pattern}`;

        // 2nd level: tactical-pattern folder name must be on the layer whitelist.
        if (!LAYER_PATTERN_WHITELIST[subpath.layer].has(subpath.pattern)) {
          const allowed = [...LAYER_PATTERN_WHITELIST[subpath.layer]].join(", ");
          v2Sink.push(
            `[Unauthorized Pattern Folder] ${rel} (layer '${subpath.layer}'): '${subpath.pattern}' is not an allowed tactical pattern folder; allowed folders: ${allowed}`
          );
        }

        // 2nd level: no loose source files directly under a pattern folder
        // (except domain/shared and presentation/i18n, which hold files directly).
        if (
          subpath.parts.length === 2 &&
          !PATTERN_FOLDERS_ALLOWING_DIRECT_FILES.has(patternKey) &&
          !isModuleDeclaration
        ) {
          v2Sink.push(
            `[Loose Pattern File] ${rel} (layer '${subpath.layer}', pattern '${subpath.pattern}'): place source files inside a ${subpath.pattern}/<aggregate-or-module>/ subfolder`
          );
        }
      }

      if (subpath.layer === "domain") {
        for (const dep of extractDomainAggregateDeps(content, ext, rel)) {
          v2Sink.push(
            `[Aggregate Isolation Violation] ${rel}: domain/${subpath.pattern}/${subpath.moduleName}/ MUST NOT depend on domain/${dep.pattern}/${dep.aggregate}/ (reference via IDs in domain/value_objects/shared/)`
          );
        }
      }
    }

    // Inline coverage ignore check (checked even in comments!)
    for (const rule of INLINE_IGNORE_PATTERNS) {
      if (rule.regex.test(content)) {
        errors.push(`[Inline Coverage Ignore Forbidden] ${rel}: contains '${rule.name}'`);
      }
    }

    // Layer dependency check
    if (layer) {
      const deps = extractLayerImports(content, ext, rel);
      const allowed = ALLOWED_LAYER_DEPS[layer];
      for (const dep of deps) {
        if (!allowed.has(dep)) {
          errors.push(
            `[Layer Dependency Violation] ${rel} (layer '${layer}') MUST NOT depend on '${dep}'`
          );
        }
      }
    }

    // Branchless drivers/ check
    if (isDriverFile(rel)) {
      driverFilesChecked++;
      const branches = detectBranchesInDriver(content, ext);
      for (const b of branches) {
        errors.push(
          `[Branchless Driver Violation] ${rel} contains ${b} (infrastructure/drivers/ must be branchless raw I/O)`
        );
      }
    }
  }

  if (filesChecked === 0) {
    errors.push("No source files found under src/ or internal/ to verify");
  }

  for (const [dirName, count] of dirFileCounts.entries()) {
    if (count > maxFilesPerDir) {
      warnings.push(
        `[Directory Size Warning] ${dirName} has ${count} source files (threshold: ${maxFilesPerDir}); consider subdividing further`
      );
    }
  }

  // 3. Centralized exclusion config validation (only drivers/ and main may be excluded)
  const c1CfgPath = path.join(absTarget, "c1-coverage.config.json");
  if (fs.existsSync(c1CfgPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(c1CfgPath, "utf8"));
      for (const pat of parsed.exclude || []) {
        if (!/(infrastructure\/drivers|src\/main\.|cmd\/)/.test(pat)) {
          errors.push(
            `[Unauthorized Coverage Exclusion] c1-coverage.config.json excludes '${pat}'; only infrastructure/drivers/ and main may be excluded`
          );
        }
      }
    } catch (e) {
      errors.push(`Invalid JSON in c1-coverage.config.json: ${e.message}`);
    }
  }

  // 3b. DDD model-integrity checks (encapsulation, event lifecycle, ubiquitous language)
  const modelIntegrityCfg = loadedCfg.config?.modelIntegrity;
  if (modelIntegrityCfg?.enabled !== false) {
    v2Sink.push(...verifyModelIntegrity(absTarget, domainSources, allSources, modelIntegrityCfg));
  }

  // 4. Translations & UI message catalogs
  v2Sink.push(...verifyTranslations(absTarget, userLocale));
  v2Sink.push(...verifyUiCatalogs(absTarget, userLocale));

  // 5. Traceability check
  const traceReport = analyzeTraceability(absTarget);
  v2Sink.push(...traceReport.errors);

  // 6. Test specifications & test case IDs
  v2Sink.push(...verifyIntegrationChecklists(absTarget));
  v2Sink.push(...verifyTestCaseIds(absTarget));

  return {
    ok: errors.length === 0,
    target: absTarget,
    errors,
    warnings,
    stats: { filesChecked, driverFilesChecked },
  };
}
