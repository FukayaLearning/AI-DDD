export function generateTypeScriptSkeleton({ projectName, contextName, contextCode = "CTX", locale = "en", dist, cliPath }) {
  const C = contextCode;
  const files = {};

  files["package.json"] = JSON.stringify(
    {
      name: projectName,
      version: "0.1.0",
      type: "module",
      scripts: {
        verify: `node ${JSON.stringify(cliPath)} verify --target .`,
        "test:unit": "node --experimental-strip-types scripts/run-c1-coverage.mjs",
        "test:integration": "bash scripts/test-integration.sh",
        test: "npm run verify && npm run test:unit && npm run test:integration",
      },
    },
    null,
    2
  ) + "\n";

  files["tsconfig.json"] = JSON.stringify(
    {
      compilerOptions: {
        target: "ES2023",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        noEmit: true,
        allowImportingTsExtensions: true,
      },
      include: ["src/**/*.ts", "tests/**/*.ts", "tests/**/*.mjs"],
    },
    null,
    2
  ) + "\n";

  files["c1-coverage.config.json"] = JSON.stringify(
    {
      language: "typescript",
      branchThreshold: 100,
      exclude: ["src/infrastructure/drivers/**", "src/main.ts"],
    },
    null,
    2
  ) + "\n";

  files["vitest.config.ts"] = `// Reference Vitest configuration enforcing 100% C1 coverage outside authorized exclusions.
export default {
  test: {
    coverage: {
      provider: "istanbul",
      all: true,
      include: ["src/**/*.ts"],
      exclude: ["src/infrastructure/drivers/**", "src/main.ts"],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
};
`;

  // Domain layer (zero external imports)
  files["src/domain/shared/result.ts"] = `export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T, E = never>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function err<T = never, E = unknown>(error: E): Result<T, E> {
  return { ok: false, error };
}
`;

  files["src/domain/health/health.ts"] = `import type { Result } from "../shared/result.ts";
import { err, ok } from "../shared/result.ts";

export type DomainError =
  | { readonly code: "INVALID_TIMESTAMP"; readonly message: string }
  | { readonly code: "CLOCK_UNAVAILABLE"; readonly message: string };

export interface HealthStatus {
  readonly context: string;
  readonly checkedAtIso: string;
}

export function createHealthStatus(
  context: string,
  checkedAtIso: string
): Result<HealthStatus, DomainError> {
  const trimmed = checkedAtIso.trim();
  if (trimmed.length === 0) {
    return err({ code: "INVALID_TIMESTAMP", message: "Timestamp must not be empty" });
  }
  return ok({ context, checkedAtIso: trimmed });
}

export interface ClockPort {
  currentIso(): Promise<Result<string, DomainError>>;
}
`;

  // Application layer (depends only on domain)
  files["src/application/health/queries/get_health.ts"] = `import type { ClockPort, DomainError, HealthStatus } from "../../../domain/health/health.ts";
import { createHealthStatus } from "../../../domain/health/health.ts";
import type { Result } from "../../../domain/shared/result.ts";
import { err } from "../../../domain/shared/result.ts";

export interface GetHealthUseCase {
  execute(): Promise<Result<HealthStatus, DomainError>>;
}

// @implements REQ-${C}-001
export class CheckHealthService implements GetHealthUseCase {
  private readonly contextName: string;
  private readonly clock: ClockPort;

  constructor(contextName: string, clock: ClockPort) {
    this.contextName = contextName;
    this.clock = clock;
  }

  async execute(): Promise<Result<HealthStatus, DomainError>> {
    const nowResult = await this.clock.currentIso();
    if (!nowResult.ok) {
      return err(nowResult.error);
    }
    return createHealthStatus(this.contextName, nowResult.value);
  }
}
`;

  // Infrastructure layer: 1) branchless driver interface + raw impl, 2) mapper, 3) DI adapter
  files["src/infrastructure/drivers/clock/clock_driver.ts"] = `export interface RawClockDriver {
  readSystemIso(): Promise<string>;
}

export class SystemClockDriver implements RawClockDriver {
  async readSystemIso(): Promise<string> {
    return new Date().toISOString();
  }
}
`;

  files["src/infrastructure/persistence/health/clock_mapper.ts"] = `import type { DomainError } from "../../../domain/health/health.ts";
import type { Result } from "../../../domain/shared/result.ts";
import { err, ok } from "../../../domain/shared/result.ts";

export function mapRawTimestamp(raw: string): Result<string, DomainError> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return err({ code: "CLOCK_UNAVAILABLE", message: "Clock returned empty timestamp" });
  }
  return ok(trimmed);
}
`;

  files["src/infrastructure/persistence/health/system_clock_adapter.ts"] = `import type { ClockPort, DomainError } from "../../../domain/health/health.ts";
import type { Result } from "../../../domain/shared/result.ts";
import { err } from "../../../domain/shared/result.ts";
import type { RawClockDriver } from "../../drivers/clock/clock_driver.ts";
import { mapRawTimestamp } from "./clock_mapper.ts";

export class SystemClockAdapter implements ClockPort {
  private readonly driver: RawClockDriver;

  constructor(driver: RawClockDriver) {
    this.driver = driver;
  }

  async currentIso(): Promise<Result<string, DomainError>> {
    try {
      const raw = await this.driver.readSystemIso();
      return mapRawTimestamp(raw);
    } catch {
      return err({ code: "CLOCK_UNAVAILABLE", message: "Failed to read system clock" });
    }
  }
}
`;

  // Presentation layer i18n catalogs & web handler
  files["src/presentation/web/i18n/en.ts"] = `export interface HealthMessages {
  readonly locale: string;
  readonly healthyTitle: string;
  readonly unavailableTitle: string;
  readonly notFoundTitle: string;
  readonly notFoundBody: string;
}

export const enMessages: HealthMessages = {
  locale: "en",
  healthyTitle: "Service Healthy",
  unavailableTitle: "Service Unavailable",
  notFoundTitle: "Not Found",
  notFoundBody: "Page Not Found",
};
`;

  if (locale !== "en") {
    const isJa = locale === "ja";
    files[`src/presentation/web/i18n/${locale}.ts`] = `import type { HealthMessages } from "./en.ts";

export const userMessages: HealthMessages = {
  locale: ${JSON.stringify(locale)},
  healthyTitle: ${JSON.stringify(isJa ? "サービス正常" : `[${locale}] Service Healthy`)},
  unavailableTitle: ${JSON.stringify(isJa ? "サービス利用不可" : `[${locale}] Service Unavailable`)},
  notFoundTitle: ${JSON.stringify(isJa ? "見つかりません" : `[${locale}] Not Found`)},
  notFoundBody: ${JSON.stringify(isJa ? "ページが見つかりません" : `[${locale}] Page Not Found`)},
};
`;
  }

  files["src/presentation/web/health/web_server.ts"] = `import http from "node:http";
import type { GetHealthUseCase } from "../../../application/health/queries/get_health.ts";
import type { HealthMessages } from "../i18n/en.ts";
import { enMessages } from "../i18n/en.ts";

export function renderHealthHtml(locale: string, title: string, bodyHtml: string): string {
  return \`<!doctype html>
<html lang="\${locale}">
<head><meta charset="utf-8"><title>\${title}</title></head>
<body>\${bodyHtml}</body>
</html>\`;
}

export function createWebHandler(useCase: GetHealthUseCase, messages: HealthMessages = enMessages) {
  return async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    if (req.method === "GET" && req.url === "/") {
      const result = await useCase.execute();
      if (!result.ok) {
        res.writeHead(503, { "content-type": "text/html; charset=utf-8" });
        res.end(
          renderHealthHtml(
            messages.locale,
            messages.unavailableTitle,
            \`<main><div data-testid="error-banner">\${result.error.code}: \${result.error.message}</div></main>\`
          )
        );
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(
        renderHealthHtml(
          messages.locale,
          messages.healthyTitle,
          \`<main><h1 data-testid="health-status">OK: \${result.value.context}</h1><p data-testid="checked-at">\${result.value.checkedAtIso}</p></main>\`
        )
      );
      return;
    }

    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(
      renderHealthHtml(
        messages.locale,
        messages.notFoundTitle,
        \`<main><p data-testid="not-found">\${messages.notFoundBody}</p></main>\`
      )
    );
  };
}

export async function startPresentationServer(
  useCase: GetHealthUseCase,
  port = 0,
  messages: HealthMessages = enMessages
): Promise<{ server: http.Server; baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(createWebHandler(useCase, messages));
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const addr = server.address() as import("node:net").AddressInfo;
  return {
    server,
    baseUrl: \`http://127.0.0.1:\${addr.port}\`,
    close: () => new Promise<void>((resolve) => { server.close(() => resolve()); }),
  };
}
`;

  // Composition Root (main.ts)
  const mainCatalogImport =
    locale !== "en"
      ? `import { enMessages } from "./presentation/web/i18n/en.ts";\nimport { userMessages } from "./presentation/web/i18n/${locale}.ts";`
      : `import { enMessages } from "./presentation/web/i18n/en.ts";`;
  const mainMessagesSelect =
    locale !== "en"
      ? `const activeMessages = (process.env.APP_LOCALE ?? ${JSON.stringify(locale)}) === "en" ? enMessages : userMessages;`
      : `const activeMessages = enMessages;`;

  files["src/main.ts"] = `import { CheckHealthService } from "./application/health/queries/get_health.ts";
import { SystemClockDriver } from "./infrastructure/drivers/clock/clock_driver.ts";
import { SystemClockAdapter } from "./infrastructure/persistence/health/system_clock_adapter.ts";
import { startPresentationServer } from "./presentation/web/health/web_server.ts";
${mainCatalogImport}

export function createApp(contextName = "${contextName}") {
  const clockDriver = new SystemClockDriver();
  const clockPort = new SystemClockAdapter(clockDriver);
  const useCase = new CheckHealthService(contextName, clockPort);
  return { useCase };
}

const isEntrypoint = process.argv[1] && import.meta.url === new URL(\`file://\${process.argv[1]}\`).href;
if (isEntrypoint) {
  const port = Number(process.env.PORT ?? "3000");
  const { useCase } = createApp();
  ${mainMessagesSelect}
  const { baseUrl } = await startPresentationServer(useCase, port, activeMessages);
  console.log(\`LISTENING \${baseUrl}\`);
}
`;

  // Zero-dependency headless Chromium CDP browser runner (Playwright-compatible fallback when node_modules is absent)
  files["scripts/browser-helper.mjs"] = `import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

export function findChromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  const cacheBase = path.join(os.homedir(), ".cache", "ms-playwright");
  if (fs.existsSync(cacheBase)) {
    const entries = fs.readdirSync(cacheBase).sort().reverse();
    for (const entry of entries) {
      const candidates = [
        path.join(cacheBase, entry, "chrome-headless-shell-linux64", "chrome-headless-shell"),
        path.join(cacheBase, entry, "chrome-linux64", "chrome"),
        path.join(cacheBase, entry, "chrome-linux", "chrome"),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
    }
  }
  throw new Error("Headless Chromium binary not found. Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH or install playwright browsers.");
}

export async function launchHeadlessBrowser() {
  const exe = findChromiumExecutable();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-ddd-chrome-"));
  const proc = spawn(
    exe,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=0",
      \`--user-data-dir=\${userDataDir}\`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  const wsUrl = await new Promise((resolve, reject) => {
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(\`Timed out launching Chromium: \${stderr}\`)), 15000);
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      const m = stderr.match(/DevTools listening on (ws:\\/\\/[^\\s]+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(\`Chromium exited prematurely (\${code}): \${stderr}\`));
    });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket open timeout")), 10000);
    ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener("error", (e) => { clearTimeout(timer); reject(e); }, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id);
      clearTimeout(timer);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  ws.addEventListener("close", () => {
    for (const [, entry] of pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error("WebSocket closed"));
    }
    pending.clear();
  });

  function send(method, params = {}, sessionId = undefined) {
    const id = nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(\`CDP timeout on \${method}\`));
      }, 10000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify(payload));
    });
  }

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);

  return {
    async goto(url) {
      const loaded = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.removeEventListener("message", listener);
          reject(new Error("Page.loadEventFired timeout"));
        }, 10000);
        const listener = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.sessionId === sessionId && msg.method === "Page.loadEventFired") {
            clearTimeout(timer);
            ws.removeEventListener("message", listener);
            resolve();
          }
        };
        ws.addEventListener("message", listener);
      });
      await send("Page.navigate", { url }, sessionId);
      await loaded;
    },
    async textContent(selector) {
      const res = await send(
        "Runtime.evaluate",
        {
          expression: \`(() => { const el = document.querySelector(\${JSON.stringify(selector)}); return el ? el.textContent : null; })()\`,
          returnByValue: true,
        },
        sessionId
      );
      return res.result?.value ?? null;
    },
    async title() {
      const res = await send("Runtime.evaluate", { expression: "document.title", returnByValue: true }, sessionId);
      return res.result?.value ?? "";
    },
    async close() {
      try { ws.close(); } catch {}
      if (proc.exitCode === null) {
        proc.kill("SIGKILL");
        await Promise.race([
          new Promise((r) => proc.once("exit", r)),
          new Promise((r) => setTimeout(r, 500)),
        ]);
      }
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      } catch {}
    },
  };
}
`;

  // Unit + Browser C1 Coverage Runner using Node 22 V8 Profiler
  files["scripts/run-c1-coverage.mjs"] = `import fs from "node:fs";
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
  const rel = path.relative(rootDir, f).replace(/\\\\/g, "/");
  return !matchesExclude(rel);
});

const uncovered = [];
for (const absFile of srcFiles) {
  const url = pathToFileURL(absFile).href;
  const rel = path.relative(rootDir, absFile).replace(/\\\\/g, "/");
  const entry = result.find((r) => r.url === url);
  const srcText = fs.readFileSync(absFile, "utf8");
  const executableNonEmpty = srcText.replace(/import\\s+type\\s+[^;]+;|export\\s+(?:type|interface)\\s+[^{;]+(?:\\{[^}]*\\}|=[^;]+;)/g, "").trim();
  if (!entry) {
    if (executableNonEmpty.length > 0) {
      uncovered.push(\`\${rel}: file was never loaded/executed\`);
    }
    continue;
  }
  for (const fn of entry.functions) {
    for (const range of fn.ranges) {
      if (range.count === 0) {
        const snippet = srcText.slice(range.startOffset, Math.min(range.endOffset, range.startOffset + 80)).replace(/\\s+/g, " ");
        const line = srcText.slice(0, range.startOffset).split("\\n").length;
        uncovered.push(\`\${rel}:\${line} [\${fn.functionName || "<module>"}] uncovered branch: "\${snippet}"\`);
      }
    }
  }
}

if (uncovered.length > 0) {
  console.error("C1 Branch Coverage FAILED (must be 100% outside exclusions):");
  for (const item of uncovered) console.error("  -", item);
  process.exit(1);
}

console.log(\`PASS: 100% C1 branch coverage verified across \${srcFiles.length} non-excluded TypeScript files.\`);
`;

  // Tests
  files["tests/unit/domain_application.test.mjs"] = `import assert from "node:assert/strict";
import { createHealthStatus } from "../../src/domain/health/health.ts";
import { CheckHealthService } from "../../src/application/health/queries/get_health.ts";
import { err, ok } from "../../src/domain/shared/result.ts";

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

test("UT-${C}-001 valid health status", async () => {
  const valid = createHealthStatus("${contextName}", " 2026-11-22T00:00:00Z ");
  assert.equal(valid.ok, true);
  assert.equal(valid.value.checkedAtIso, "2026-11-22T00:00:00Z");
});

test("UT-${C}-002 empty timestamp rejected", async () => {
  const empty = createHealthStatus("${contextName}", "   ");
  assert.equal(empty.ok, false);
  assert.equal(empty.error.code, "INVALID_TIMESTAMP");
});

test("UT-${C}-005 CheckHealthService returns Ok", async () => {
  const serviceOk = new CheckHealthService("${contextName}", {
    async currentIso() { return ok("2026-11-22T00:00:00Z"); },
  });
  const appOk = await serviceOk.execute();
  assert.equal(appOk.ok, true);
});

test("UT-${C}-006 CheckHealthService propagates Err", async () => {
  const serviceErr = new CheckHealthService("${contextName}", {
    async currentIso() { return err({ code: "CLOCK_UNAVAILABLE", message: "down" }); },
  });
  const appErr = await serviceErr.execute();
  assert.equal(appErr.ok, false);
  assert.equal(appErr.error.code, "CLOCK_UNAVAILABLE");
});

export async function run() {
  for (const c of cases) await c.fn();
}
`;

  files["tests/unit/infrastructure.test.mjs"] = `import assert from "node:assert/strict";
import { mapRawTimestamp } from "../../src/infrastructure/persistence/health/clock_mapper.ts";
import { SystemClockAdapter } from "../../src/infrastructure/persistence/health/system_clock_adapter.ts";

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

test("UT-${C}-003 mapRawTimestamp handles valid and blank", async () => {
  assert.equal(mapRawTimestamp(" 2026-11-22T00:00:00Z ").ok, true);
  assert.equal(mapRawTimestamp(" ").ok, false);
});

test("UT-${C}-004 SystemClockAdapter handles ok and driver failure", async () => {
  const okAdapter = new SystemClockAdapter({ async readSystemIso() { return "2026-11-22T00:00:00Z"; } });
  assert.equal((await okAdapter.currentIso()).ok, true);

  const failAdapter = new SystemClockAdapter({ async readSystemIso() { throw new Error("io error"); } });
  const failRes = await failAdapter.currentIso();
  assert.equal(failRes.ok, false);
  assert.equal(failRes.error.code, "CLOCK_UNAVAILABLE");
});

export async function run() {
  for (const c of cases) await c.fn();
}
`;

  const presLocaleCheck =
    locale !== "en"
      ? `  nextResult = ok({ context: "${contextName}", checkedAtIso: "2026-11-22T00:00:00Z" });
  const { userMessages } = await import("../../src/presentation/web/i18n/${locale}.ts");
  const srvUser = await startPresentationServer(mockUseCase, 0, userMessages);
  const bUser = await launchHeadlessBrowser();
  try {
    await bUser.goto(\`\${srvUser.baseUrl}/\`);
    assert.equal(await bUser.title(), userMessages.healthyTitle);
  } finally {
    await bUser.close();
    await srvUser.close();
  }`
      : "";

  files["tests/unit/presentation.browser.test.mjs"] = `import assert from "node:assert/strict";
import { err, ok } from "../../src/domain/shared/result.ts";
import { startPresentationServer } from "../../src/presentation/web/health/web_server.ts";
import { launchHeadlessBrowser } from "../../scripts/browser-helper.mjs";

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

test("UT-${C}-007 presentation renders healthy, error, 404, and localized views", async () => {
  let nextResult = ok({ context: "${contextName}", checkedAtIso: "2026-11-22T00:00:00Z" });
  const mockUseCase = {
    async execute() {
      return nextResult;
    },
  };

  const { baseUrl, close } = await startPresentationServer(mockUseCase, 0);
  const browser = await launchHeadlessBrowser();
  try {
    await browser.goto(\`\${baseUrl}/\`);
    assert.equal(await browser.title(), "Service Healthy");
    assert.equal(await browser.textContent('[data-testid="health-status"]'), "OK: ${contextName}");

    nextResult = err({ code: "CLOCK_UNAVAILABLE", message: "mock outage" });
    await browser.goto(\`\${baseUrl}/\`);
    assert.equal(await browser.title(), "Service Unavailable");
    assert.equal(await browser.textContent('[data-testid="error-banner"]'), "CLOCK_UNAVAILABLE: mock outage");

    await browser.goto(\`\${baseUrl}/missing\`);
    assert.equal(await browser.textContent('[data-testid="not-found"]'), "Page Not Found");
  } finally {
    await browser.close();
    await close();
  }
${presLocaleCheck}
});

export async function run() {
  for (const c of cases) await c.fn();
}
`;

  // Distribution-specific files
  if (dist === "docker") {
    files["Dockerfile"] = `FROM node:22-slim
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["node", "--experimental-strip-types", "src/main.ts"]
`;
    files["docker-compose.integration.yml"] = `services:
  app:
    build: .
    ports:
      - "13000:3000"
`;
    files["scripts/test-integration.sh"] = `#!/usr/bin/env bash
set -euo pipefail
# IT-${C}-001, IT-${C}-002
if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running; cannot execute Docker integration test." >&2
  exit 1
fi
docker compose -f docker-compose.integration.yml up -d --build
trap 'docker compose -f docker-compose.integration.yml down -v' EXIT
sleep 2
curl -fsS http://127.0.0.1:13000/ | grep -q "OK: ${contextName}"
echo "PASS: Docker container integration test verified drivers/ and main.ts"
`;
  } else if (dist === "binary") {
    files["scripts/test-integration.sh"] = `#!/usr/bin/env bash
set -euo pipefail
# IT-${C}-001, IT-${C}-002
node --experimental-strip-types -e '
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const child = spawn(process.execPath, ["--experimental-strip-types", "src/main.ts"], {
  env: { ...process.env, PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
const baseUrl = await new Promise((resolve, reject) => {
  let out = "";
  const timer = setTimeout(() => reject(new Error("Startup timeout: " + out)), 10000);
  child.stdout.on("data", (d) => {
    out += d.toString();
    const m = out.match(/LISTENING (http:\\/\\/[^\\s]+)/);
    if (m) { clearTimeout(timer); resolve(m[1]); }
  });
  child.stderr.on("data", (d) => { out += d.toString(); });
});
try {
  const res = await fetch(baseUrl + "/");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /OK: ${contextName}/);
  console.log("PASS: Binary/process integration test verified drivers/ and main.ts at", baseUrl);
} finally {
  child.kill("SIGTERM");
}
'
`;
  } else {
    files["scripts/test-integration.sh"] = `#!/usr/bin/env bash
set -euo pipefail
# IT-${C}-001, IT-${C}-002
node --experimental-strip-types -e '
import assert from "node:assert/strict";
import { createApp } from "./src/main.ts";
const { useCase } = createApp();
const res = await useCase.execute();
assert.equal(res.ok, true);
assert.equal(res.value.context, "${contextName}");
console.log("PASS: Library entrypoint integration test verified drivers/ and main.ts");
'
`;
  }

  return files;
}
