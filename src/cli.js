import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { initProject, installSchema } from "./installer.js";
import { deriveContextCode, normalizeLocale } from "./config.js";
import { stampTranslationFile } from "./i18n.js";
import { analyzeTraceability, writeTraceabilityMatrix } from "./tracer.js";
import { verifyProject } from "./verifier.js";

const VALID_LANGS = new Set(["typescript", "python", "go", "rust"]);
const VALID_DISTS = new Set(["docker", "binary", "library"]);

function printHelp() {
  console.log(`ai-ddd - OpenSpec x DDD Project Initializer & Governance Verifier

Usage:
  ai-ddd init [options]             Initialize a repository with ddd-driven OpenSpec + clean 4-layer DDD skeleton
  ai-ddd verify [options]           Verify layer dependencies, structure, i18n, test specs, and drivers/
  ai-ddd trace [options]            Generate traceability matrix and optionally verify coverage gaps
  ai-ddd i18n stamp [options] <file> Stamp a translation file with its master SHA-256 hash
  ai-ddd install-schema [options]   Deploy or update the ddd-driven OpenSpec schema

Options for 'init':
  --target <dir>            Target repository path (default: .)
  --name <project-name>     Project name (default: directory basename)
  --context <name>          Single Bounded Context name in kebab-case
  --context-code <code>     Short 2-5 letter prefix for REQ/SCN/UT/IT IDs
  --lang <language>         typescript | python | go | rust
  --dist <distribution>     docker | binary | library
  --locale <bcp47>          User-facing locale (default: en)
  --tools <list>            AI tools CSV (default: antigravity,claude,hermes,github-copilot)
  --global-schema           Also install ddd-driven schema to XDG user OpenSpec schemas dir
  --yes, -y                 Non-interactive mode (use defaults for omitted flags)

Options for 'verify':
  --target <dir>            Target repository path (default: .)
  --json                    Print JSON output

Options for 'trace':
  --target <dir>            Target repository path (default: .)
  --check                   Fail with exit code 1 if any traceability gap or orphan exists
  --format <markdown|json>  Output format (default: markdown written to docs/traceability/matrix.md)
  --include-changes         Also include active openspec/changes/*/specs/ in analysis

Options for 'install-schema':
  --target <dir>            Target repository path (default: .)
  --global                  Install into XDG user OpenSpec schemas dir
`);
}

function parseFlags(args) {
  const flags = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === "--help" || token === "-h") {
      flags.help = true;
    } else if (token === "--yes" || token === "-y") {
      flags.yes = true;
    } else if (token === "--global-schema" || token === "--global") {
      flags.globalSchema = true;
    } else if (token === "--json") {
      flags.json = true;
    } else if (token === "--check") {
      flags.check = true;
    } else if (token === "--include-changes") {
      flags.includeChanges = true;
    } else if (token.startsWith("--")) {
      const key = token.slice(2);
      const val = args[i + 1];
      if (val === undefined || val.startsWith("--")) {
        throw new Error(`Missing value for flag --${key}`);
      }
      flags[key] = val;
      i++;
    } else {
      flags._.push(token);
    }
  }
  return flags;
}

function toKebabCase(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "core-domain";
}

async function promptMissingInitOptions(flags) {
  const targetDir = flags.target || ".";
  const defaultName = path.basename(path.resolve(targetDir)) || "ddd-service";
  const canPrompt = !flags.yes && process.stdin.isTTY && process.stdout.isTTY;

  let projectName = flags.name;
  let contextName = flags.context;
  let contextCode = flags["context-code"];
  let lang = flags.lang;
  let dist = flags.dist;
  let locale = flags.locale;
  let globalSchema = Boolean(flags.globalSchema);

  if (canPrompt) {
    const rl = readline.createInterface({ input, output });
    try {
      if (!projectName) {
        const ans = await rl.question(`Project name (${defaultName}): `);
        projectName = ans.trim() || defaultName;
      }
      if (!contextName) {
        const defaultCtx = toKebabCase(projectName);
        const ans = await rl.question(`Bounded Context name (${defaultCtx}): `);
        contextName = toKebabCase(ans.trim() || defaultCtx);
      }
      if (!lang) {
        const ans = await rl.question("Language [typescript|python|go|rust] (typescript): ");
        lang = (ans.trim() || "typescript").toLowerCase();
      }
      if (!dist) {
        const ans = await rl.question("Distribution mode [docker|binary|library] (docker): ");
        dist = (ans.trim() || "docker").toLowerCase();
      }
      if (!flags.globalSchema) {
        const ans = await rl.question("Also install ddd-driven schema globally? [y/N]: ");
        globalSchema = ans.trim().toLowerCase() === "y";
      }
    } finally {
      rl.close();
    }
  }

  projectName = projectName || defaultName;
  contextName = toKebabCase(contextName || projectName);
  contextCode = deriveContextCode(contextName, contextCode);
  locale = normalizeLocale(locale || "en");
  lang = (lang || "typescript").toLowerCase();
  dist = (dist || "docker").toLowerCase();

  if (!VALID_LANGS.has(lang)) {
    throw new Error(`Unsupported language '${lang}'. Expected: typescript, python, go, rust`);
  }
  if (!VALID_DISTS.has(dist)) {
    throw new Error(`Unsupported distribution '${dist}'. Expected: docker, binary, library`);
  }

  const tools = flags.tools
    ? flags.tools
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : ["antigravity", "claude", "hermes", "github-copilot"];

  return {
    targetDir,
    projectName,
    contextName,
    contextCode,
    locale,
    lang,
    dist,
    tools,
    globalSchema,
  };
}

export async function runCli(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return 0;
  }

  const command = argv[0];
  let flags;
  try {
    flags = parseFlags(argv.slice(1));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return 1;
  }

  if (command === "init") {
    try {
      const opts = await promptMissingInitOptions(flags);
      const result = initProject(opts);
      console.log(`Initialized OpenSpec + DDD project at ${result.targetDir}`);
      console.log(`  Language:     ${opts.lang}`);
      console.log(`  Context:      ${opts.contextName} (${opts.contextCode})`);
      console.log(`  Locale:       master=en, user=${opts.locale}`);
      console.log(`  Distribution: ${opts.dist}`);
      console.log(`  Schemas:      ${result.schemaPaths.join(", ")}`);
      console.log(`  Files:        ${result.filesCreated} skeleton files generated`);
      return 0;
    } catch (err) {
      console.error(`Init failed: ${err.message}`);
      return 1;
    }
  }

  if (command === "verify") {
    const targetDir = flags.target || ".";
    const report = verifyProject(targetDir);
    if (flags.json) {
      console.log(JSON.stringify(report, null, 2));
    } else if (report.ok) {
      console.log(
        `PASS: Governance verification succeeded for ${report.target} (${report.stats.filesChecked} source files, ${report.stats.driverFilesChecked} driver files checked)`
      );
      for (const warn of report.warnings) {
        console.warn(`  WARN: ${warn}`);
      }
    } else {
      console.error(`FAIL: Governance verification failed for ${report.target}:`);
      for (const err of report.errors) {
        console.error(`  - ${err}`);
      }
      for (const warn of report.warnings) {
        console.warn(`  WARN: ${warn}`);
      }
    }
    return report.ok ? 0 : 1;
  }

  if (command === "trace") {
    const targetDir = flags.target || ".";
    const format = flags.format || "markdown";
    const report = analyzeTraceability(targetDir, {
      includeChanges: Boolean(flags.includeChanges),
    });
    if (format === "json") {
      console.log(JSON.stringify(report, null, 2));
    } else {
      const outPath = writeTraceabilityMatrix(targetDir, report);
      console.log(
        `Generated ${outPath} (${report.summary.requirements} REQ, ${report.summary.scenarios} SCN, ${report.summary.testCases} cases)`
      );
      if (!report.ok) {
        for (const err of report.errors) {
          console.error(`  - ${err}`);
        }
      }
    }
    if (flags.check && !report.ok) {
      return 1;
    }
    return 0;
  }

  if (command === "i18n") {
    const sub = flags._[0];
    const fileArg = flags._[1];
    if (sub !== "stamp" || !fileArg) {
      console.error("Usage: ai-ddd i18n stamp [--target <dir>] <translation-file>");
      return 1;
    }
    try {
      const res = stampTranslationFile(flags.target || ".", fileArg);
      console.log(`Stamped ${res.translation} (sha256=${res.sha256.slice(0, 12)}...)`);
      return 0;
    } catch (err) {
      console.error(`i18n stamp failed: ${err.message}`);
      return 1;
    }
  }

  if (command === "install-schema") {
    const paths = installSchema({
      targetDir: flags.globalSchema && !flags.target ? undefined : flags.target || ".",
      globalSchema: Boolean(flags.globalSchema),
    });
    console.log(`Installed ddd-driven schema to:\n  ${paths.join("\n  ")}`);
    return 0;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  return 1;
}
