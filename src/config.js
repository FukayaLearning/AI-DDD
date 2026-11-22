import fs from "node:fs";
import path from "node:path";

export const CONFIG_FILENAME = "ai-ddd.config.json";
export const DEFAULT_MAX_FILES_PER_DIR = 15;

const BCP47_REGEX =
  /^[a-zA-Z]{2,3}(?:-[a-zA-Z]{4})?(?:-(?:[a-zA-Z]{2}|\d{3}))?(?:-[a-zA-Z0-9]{5,8}|-\d[a-zA-Z0-9]{3})*$/;

export function isValidLocale(locale) {
  if (typeof locale !== "string" || !BCP47_REGEX.test(locale)) {
    return false;
  }
  try {
    const canonical = Intl.getCanonicalLocales(locale);
    return canonical.length === 1;
  } catch {
    return false;
  }
}

export function normalizeLocale(locale) {
  if (!locale) return "en";
  if (!isValidLocale(locale)) {
    throw new Error(`Invalid BCP 47 locale tag '${locale}'`);
  }
  return Intl.getCanonicalLocales(locale)[0];
}

export function deriveContextCode(contextName, explicitCode) {
  if (explicitCode) {
    const clean = explicitCode.trim().toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(clean)) {
      throw new Error(`Invalid --context-code '${explicitCode}'. Expected 2-5 uppercase letters.`);
    }
    return clean;
  }
  const letters = (contextName || "").replace(/[^a-zA-Z]/g, "").toUpperCase();
  const base = letters.slice(0, 3);
  return base.length >= 2 ? base : (base + "CTX").slice(0, 3);
}

export function buildProjectConfig({
  contextName,
  contextCode,
  userLocale = "en",
  schemaVersion = 2,
  maxFilesPerDirectory = DEFAULT_MAX_FILES_PER_DIR,
}) {
  return {
    schemaVersion,
    context: {
      name: contextName,
      code: deriveContextCode(contextName, contextCode),
    },
    locale: {
      master: "en",
      user: normalizeLocale(userLocale),
    },
    structure: {
      maxFilesPerDirectory,
    },
    coverage: {
      configFile: "c1-coverage.config.json",
    },
  };
}

export function loadProjectConfig(targetDir) {
  const cfgPath = path.join(path.resolve(targetDir), CONFIG_FILENAME);
  if (!fs.existsSync(cfgPath)) {
    return { exists: false, path: cfgPath, config: null, error: null };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    return {
      exists: true,
      path: cfgPath,
      config: {
        schemaVersion: Number(raw.schemaVersion ?? 1),
        context: {
          name: raw.context?.name || "",
          code: raw.context?.code || "",
        },
        locale: {
          master: raw.locale?.master || "en",
          user: raw.locale?.user || "en",
        },
        structure: {
          maxFilesPerDirectory: Number(
            raw.structure?.maxFilesPerDirectory ?? DEFAULT_MAX_FILES_PER_DIR
          ),
        },
        coverage: {
          configFile: raw.coverage?.configFile || "c1-coverage.config.json",
        },
      },
      error: null,
    };
  } catch (err) {
    return { exists: true, path: cfgPath, config: null, error: err.message };
  }
}
