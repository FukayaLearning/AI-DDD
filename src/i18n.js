import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const HEADER_REGEX =
  /^<!--\s*ai-ddd-translation:\s*source=([^\s]+)\s+sha256=([a-f0-9]{64})\s+locale=([^\s]+)\s*-->/i;

export function computeFileSha256(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

export function formatTranslationHeader({ source, sha256, locale }) {
  return `<!-- ai-ddd-translation: source=${source} sha256=${sha256} locale=${locale} -->`;
}

export function parseTranslationHeader(content) {
  const firstLine = content.split(/\r?\n/, 1)[0] || "";
  const m = firstLine.match(HEADER_REGEX);
  if (!m) return null;
  return { source: m[1], sha256: m[2].toLowerCase(), locale: m[3] };
}

export function resolveMasterForTranslation(absTarget, absTranslation) {
  const rel = path.relative(absTarget, absTranslation).replace(/\\/g, "/");
  const changeMatch = rel.match(/^(openspec\/changes\/[^/]+)\/i18n\/([^/]+)\/(.+)$/);
  if (changeMatch) {
    const [, changeDir, locale, innerRel] = changeMatch;
    return {
      masterAbs: path.join(absTarget, changeDir, innerRel),
      locale,
      relSource: path.posix.relative(path.posix.dirname(rel), `${changeDir}/${innerRel}`),
    };
  }
  const siblingMatch = rel.match(/^(.+)\.([a-zA-Z]{2,3}(?:-[a-zA-Z0-9]+)*)\.md$/);
  if (siblingMatch) {
    const [, base, locale] = siblingMatch;
    const masterRel = `${base}.md`;
    return {
      masterAbs: path.join(absTarget, masterRel),
      locale,
      relSource: path.posix.basename(masterRel),
    };
  }
  return null;
}

export function stampTranslationFile(targetDir, translationFile) {
  const absTarget = path.resolve(targetDir);
  const absTranslation = path.isAbsolute(translationFile)
    ? translationFile
    : path.resolve(absTarget, translationFile);

  if (!fs.existsSync(absTranslation)) {
    throw new Error(`Translation file not found: ${absTranslation}`);
  }
  const resolved = resolveMasterForTranslation(absTarget, absTranslation);
  if (!resolved) {
    throw new Error(
      `Cannot infer master file for '${translationFile}'. Expected i18n/<locale>/... or <name>.<locale>.md`
    );
  }
  if (!fs.existsSync(resolved.masterAbs)) {
    throw new Error(`Master file not found: ${resolved.masterAbs}`);
  }

  const sha256 = computeFileSha256(resolved.masterAbs);
  const header = formatTranslationHeader({
    source: resolved.relSource,
    sha256,
    locale: resolved.locale,
  });

  const existing = fs.readFileSync(absTranslation, "utf8");
  const lines = existing.split(/\r?\n/);
  let updated;
  if (HEADER_REGEX.test(lines[0] || "")) {
    lines[0] = header;
    updated = lines.join("\n");
  } else {
    updated = `${header}\n\n${existing}`;
  }
  fs.writeFileSync(absTranslation, updated, "utf8");
  return { translation: absTranslation, master: resolved.masterAbs, sha256, locale: resolved.locale };
}

function listMarkdownFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listMarkdownFiles(full, results);
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

function isSiblingTranslation(rel) {
  return /\.[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]+)*\.md$/.test(rel);
}

export function verifyTranslations(absTarget, userLocale) {
  const errors = [];

  const checkTranslation = (transAbs) => {
    const rel = path.relative(absTarget, transAbs).replace(/\\/g, "/");
    const content = fs.readFileSync(transAbs, "utf8");
    const header = parseTranslationHeader(content);
    if (!header) {
      errors.push(`[Missing Translation Header] ${rel}: missing ai-ddd-translation metadata comment`);
      return;
    }
    const masterAbs = path.resolve(path.dirname(transAbs), header.source);
    if (!fs.existsSync(masterAbs)) {
      errors.push(`[Orphan Translation] ${rel}: master '${header.source}' does not exist`);
      return;
    }
    const actualHash = computeFileSha256(masterAbs);
    if (actualHash !== header.sha256) {
      errors.push(
        `[Stale Translation] ${rel}: master '${header.source}' changed (expected ${header.sha256.slice(0, 8)}, actual ${actualHash.slice(0, 8)})`
      );
    }
  };

  // Persistent docs: docs/domain, docs/testing, openspec/specs
  const persistentMasters = [];
  for (const sub of ["docs/domain", "docs/testing", "openspec/specs"]) {
    for (const file of listMarkdownFiles(path.join(absTarget, sub))) {
      const rel = path.relative(absTarget, file).replace(/\\/g, "/");
      if (isSiblingTranslation(rel)) {
        checkTranslation(file);
      } else {
        persistentMasters.push(file);
      }
    }
  }

  // Active changes
  const changesRoot = path.join(absTarget, "openspec", "changes");
  const changeMasters = [];
  if (fs.existsSync(changesRoot)) {
    for (const entry of fs.readdirSync(changesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "archive") continue;
      const changeDir = path.join(changesRoot, entry.name);
      for (const file of listMarkdownFiles(changeDir)) {
        const relFromChange = path.relative(changeDir, file).replace(/\\/g, "/");
        if (relFromChange.startsWith("i18n/")) {
          checkTranslation(file);
        } else if (
          relFromChange === "proposal.md" ||
          relFromChange === "design.md" ||
          relFromChange === "test-plan.md" ||
          relFromChange.startsWith("specs/")
        ) {
          changeMasters.push({ changeDir, file, relFromChange });
        }
      }
    }
  }

  if (userLocale && userLocale !== "en") {
    for (const master of persistentMasters) {
      const expected = master.replace(/\.md$/, `.${userLocale}.md`);
      if (!fs.existsSync(expected)) {
        const relExp = path.relative(absTarget, expected).replace(/\\/g, "/");
        errors.push(`[Missing Translation] ${relExp} (required for user locale '${userLocale}')`);
      }
    }
    for (const { changeDir, relFromChange } of changeMasters) {
      const expected = path.join(changeDir, "i18n", userLocale, relFromChange);
      if (!fs.existsSync(expected)) {
        const relExp = path.relative(absTarget, expected).replace(/\\/g, "/");
        errors.push(`[Missing Translation] ${relExp} (required for user locale '${userLocale}')`);
      }
    }
  }

  return errors;
}

export function extractCatalogKeys(code) {
  const keys = new Set();
  const stripped = code
    .replace(/\/\/.*$/gm, "")
    .replace(/#.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const patterns = [
    /["']([a-zA-Z0-9_.-]+)["']\s*:/g,
    /\(\s*["']([a-zA-Z0-9_.-]+)["']\s*,/g,
    /(?:^|[{,])\s*([a-zA-Z0-9_]+)\s*:\s*["'`]/gm,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(stripped)) !== null) {
      keys.add(m[1]);
    }
  }
  return keys;
}

export function verifyUiCatalogs(absTarget, userLocale) {
  const errors = [];
  const candidates = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (["node_modules", ".git", "target", "__pycache__", ".venv", "dist"].includes(e.name)) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "i18n" && /(^|\/)(src|internal)\/presentation\//.test(full.replace(/\\/g, "/") + "/")) {
          candidates.push(full);
        } else {
          walk(full);
        }
      }
    }
  };
  walk(absTarget);

  for (const i18nDir of candidates) {
    const localeFiles = new Map();
    for (const entry of fs.readdirSync(i18nDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (["mod.rs", "__init__.py", "index.ts", "index.js"].includes(entry.name)) continue;
      const ext = path.extname(entry.name);
      if (![".ts", ".mts", ".js", ".mjs", ".py", ".go", ".rs"].includes(ext)) continue;
      const base = path.basename(entry.name, ext);
      localeFiles.set(base, path.join(i18nDir, entry.name));
    }
    if (localeFiles.size === 0) continue;

    if (userLocale && userLocale !== "en" && !localeFiles.has(userLocale)) {
      const relDir = path.relative(absTarget, i18nDir).replace(/\\/g, "/");
      errors.push(`[Missing UI Catalog] ${relDir}: missing catalog for user locale '${userLocale}'`);
    }

    const enFile = localeFiles.get("en");
    if (!enFile) continue;
    const enKeys = extractCatalogKeys(fs.readFileSync(enFile, "utf8"));

    for (const [loc, filePath] of localeFiles.entries()) {
      if (loc === "en") continue;
      const locKeys = extractCatalogKeys(fs.readFileSync(filePath, "utf8"));
      const relFile = path.relative(absTarget, filePath).replace(/\\/g, "/");
      for (const k of enKeys) {
        if (!locKeys.has(k)) {
          errors.push(`[I18n Catalog Mismatch] ${relFile}: missing key '${k}' present in 'en' catalog`);
        }
      }
      for (const k of locKeys) {
        if (!enKeys.has(k)) {
          errors.push(`[I18n Catalog Mismatch] ${relFile}: extra key '${k}' not present in 'en' catalog`);
        }
      }
    }
  }

  return errors;
}
