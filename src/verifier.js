import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_MAX_FILES_PER_DIR, loadProjectConfig } from "./config.js";
import { verifyTranslations, verifyUiCatalogs } from "./i18n.js";

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
  return { layer, parts, isLooseRootFile: parts.length === 1, moduleName: parts[0] };
}

function extractDomainAggregateDeps(rawCode, ext, relPath) {
  const code = ext === ".rs" ? isRustModTestBlockRemoved(rawCode) : rawCode;
  const sub = detectLayerSubpath(relPath);
  if (!sub || sub.layer !== "domain" || sub.isLooseRootFile || sub.moduleName === "shared") {
    return [];
  }
  const selfAgg = sub.moduleName;
  const found = new Set();

  if (ext === ".ts" || ext === ".mts" || ext === ".js" || ext === ".mjs") {
    const importRegex = /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
    let m;
    while ((m = importRegex.exec(code)) !== null) {
      const spec = m[1] || m[2];
      if (!spec.startsWith(".")) continue;
      const resolved = path.posix.normalize(
        path.posix.join("/", path.posix.dirname(relPath.replace(/\\/g, "/")), spec)
      );
      const dm = resolved.match(/^\/(?:src|internal)\/domain\/([^/]+)(?:\/|$)/);
      if (dm && dm[1] !== selfAgg && dm[1] !== "shared") {
        found.add(dm[1]);
      }
    }
  } else if (ext === ".py") {
    const pyRegex = /^\s*(?:from\s+([.\w]+)\s+import|import\s+([\w.,\s]+))/gm;
    let m;
    while ((m = pyRegex.exec(code)) !== null) {
      const modText = m[1] || m[2];
      const dm = modText.match(/(?:^|\.)domain\.([a-zA-Z0-9_]+)/);
      if (dm && dm[1] !== selfAgg && dm[1] !== "shared") {
        found.add(dm[1]);
      }
      const relM = modText.match(/^\.\.([a-zA-Z0-9_]+)/);
      if (relM && relM[1] !== selfAgg && relM[1] !== "shared") {
        found.add(relM[1]);
      }
    }
  } else if (ext === ".go") {
    const importBlock = code.match(/import\s*(?:\([^)]*\)|"[^"]+")/g) || [];
    for (const block of importBlock) {
      const goRegex = /["']([^"']+)["']/g;
      let m;
      while ((m = goRegex.exec(block)) !== null) {
        const dm = m[1].match(/\/internal\/domain\/([^/"']+)/);
        if (dm && dm[1] !== selfAgg && dm[1] !== "shared") {
          found.add(dm[1]);
        }
      }
    }
  } else if (ext === ".rs") {
    const rustRegex = /\b(?:use\s+)?crate::domain::([a-zA-Z0-9_]+)(?:::|;|\b)/g;
    let m;
    while ((m = rustRegex.exec(code)) !== null) {
      if (m[1] !== selfAgg && m[1] !== "shared") {
        found.add(m[1]);
      }
    }
  }

  return [...found];
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

export function verifyProject(targetDir) {
  const absTarget = path.resolve(targetDir);
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(absTarget)) {
    // 4. Translations & UI message catalogs
  v2Sink.push(...verifyTranslations(absTarget, userLocale));
  v2Sink.push(...verifyUiCatalogs(absTarget, userLocale));

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

    // Structure rules: no loose files at layer roots & aggregate isolation
    const subpath = detectLayerSubpath(rel);
    if (subpath && SUBDIVIDED_LAYERS.has(subpath.layer)) {
      if (subpath.isLooseRootFile && !MODULE_DECLARATION_FILES.has(path.posix.basename(rel))) {
        v2Sink.push(
          `[Loose Layer File] ${rel} (layer '${subpath.layer}'): place source files inside a module subdirectory (e.g., ${subpath.layer}/shared/ or ${subpath.layer}/<module>/)`
        );
      }
      if (subpath.layer === "domain") {
        for (const otherAgg of extractDomainAggregateDeps(content, ext, rel)) {
          v2Sink.push(
            `[Aggregate Isolation Violation] ${rel}: domain/${subpath.moduleName}/ MUST NOT depend on domain/${otherAgg}/ (reference via IDs in domain/shared/)`
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

  // 4. Translations & UI message catalogs
  v2Sink.push(...verifyTranslations(absTarget, userLocale));
  v2Sink.push(...verifyUiCatalogs(absTarget, userLocale));

  return {
    ok: errors.length === 0,
    target: absTarget,
    errors,
    warnings,
    stats: { filesChecked, driverFilesChecked },
  };
}
