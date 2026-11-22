export function generatePythonSkeleton({ projectName, contextName, dist, cliPath }) {
  const files = {};

  files["pyproject.toml"] = `[project]
name = "${projectName.replace(/[^a-zA-Z0-9_-]/g, "-")}"
version = "0.1.0"
requires-python = ">=3.12"

[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.coverage.run]
branch = true
source = ["src"]
omit = ["src/infrastructure/drivers/*", "src/main.py"]

[tool.coverage.report]
fail_under = 100
`;

  files["src/__init__.py"] = "";
  files["src/domain/__init__.py"] = "";
  files["src/application/__init__.py"] = "";
  files["src/infrastructure/__init__.py"] = "";
  files["src/infrastructure/drivers/__init__.py"] = "";
  files["src/infrastructure/repository/__init__.py"] = "";
  files["src/presentation/__init__.py"] = "";

  files["src/domain/result.py"] = `from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")
E = TypeVar("E")


@dataclass(frozen=True)
class Ok(Generic[T]):
    value: T
    ok: bool = True


@dataclass(frozen=True)
class Err(Generic[E]):
    error: E
    ok: bool = False


Result = Ok[T] | Err[E]
`;

  files["src/domain/health.py"] = `from dataclasses import dataclass
from typing import Protocol
from src.domain.result import Err, Ok, Result


@dataclass(frozen=True)
class DomainError:
    code: str
    message: str


@dataclass(frozen=True)
class HealthStatus:
    context: str
    checked_at_iso: str


def create_health_status(context: str, checked_at_iso: str) -> Result[HealthStatus, DomainError]:
    trimmed = checked_at_iso.strip()
    if not trimmed:
        return Err(DomainError(code="INVALID_TIMESTAMP", message="Timestamp must not be empty"))
    return Ok(HealthStatus(context=context, checked_at_iso=trimmed))


class ClockPort(Protocol):
    def current_iso(self) -> Result[str, DomainError]: ...
`;

  files["src/application/get_health.py"] = `from typing import Protocol
from src.domain.health import ClockPort, DomainError, HealthStatus, create_health_status
from src.domain.result import Err, Result


class GetHealthUseCase(Protocol):
    def execute(self) -> Result[HealthStatus, DomainError]: ...


class CheckHealthService:
    def __init__(self, context_name: str, clock: ClockPort) -> None:
        self._context_name = context_name
        self._clock = clock

    def execute(self) -> Result[HealthStatus, DomainError]:
        now_result = self._clock.current_iso()
        if isinstance(now_result, Err):
            return now_result
        return create_health_status(self._context_name, now_result.value)
`;

  files["src/infrastructure/drivers/clock_driver.py"] = `from datetime import datetime, timezone
from typing import Protocol


class RawClockDriver(Protocol):
    def read_system_iso(self) -> str: ...


class SystemClockDriver:
    def read_system_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()
`;

  files["src/infrastructure/repository/clock_mapper.py"] = `from src.domain.health import DomainError
from src.domain.result import Err, Ok, Result


def map_raw_timestamp(raw: str) -> Result[str, DomainError]:
    trimmed = raw.strip()
    if not trimmed:
        return Err(DomainError(code="CLOCK_UNAVAILABLE", message="Clock returned empty timestamp"))
    return Ok(trimmed)
`;

  files["src/infrastructure/repository/system_clock_adapter.py"] = `from src.domain.health import DomainError
from src.domain.result import Err, Result
from src.infrastructure.drivers.clock_driver import RawClockDriver
from src.infrastructure.repository.clock_mapper import map_raw_timestamp


class SystemClockAdapter:
    def __init__(self, driver: RawClockDriver) -> None:
        self._driver = driver

    def current_iso(self) -> Result[str, DomainError]:
        try:
            raw = self._driver.read_system_iso()
        except Exception:
            return Err(DomainError(code="CLOCK_UNAVAILABLE", message="Failed to read system clock"))
        return map_raw_timestamp(raw)
`;

  files["src/presentation/web_server.py"] = `from contextlib import contextmanager
from html import escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from typing import Iterator
from src.application.get_health import GetHealthUseCase
from src.domain.result import Err


def render_html(title: str, body: str) -> str:
    return f"<!doctype html><html lang='en'><head><meta charset='utf-8'><title>{escape(title)}</title></head><body>{body}</body></html>"


def make_handler(use_case: GetHealthUseCase):
    class HealthHandler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: object) -> None:
            return

        def do_GET(self) -> None:
            if self.path == "/":
                result = use_case.execute()
                if isinstance(result, Err):
                    html = render_html(
                        "Service Unavailable",
                        f"<main><div data-testid='error-banner'>{escape(result.error.code)}: {escape(result.error.message)}</div></main>",
                    )
                    self._send(503, html)
                    return
                html = render_html(
                    "Service Healthy",
                    f"<main><h1 data-testid='health-status'>OK: {escape(result.value.context)}</h1><p data-testid='checked-at'>{escape(result.value.checked_at_iso)}</p></main>",
                )
                self._send(200, html)
                return
            self._send(404, render_html("Not Found", "<main><p data-testid='not-found'>Page Not Found</p></main>"))

        def _send(self, status: int, html: str) -> None:
            payload = html.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    return HealthHandler


@contextmanager
def run_presentation_server(use_case: GetHealthUseCase, port: int = 0) -> Iterator[str]:
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(use_case))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, actual_port = server.server_address
        yield f"http://{host}:{actual_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
`;

  files["src/main.py"] = `import os
from http.server import ThreadingHTTPServer
from src.application.get_health import CheckHealthService
from src.infrastructure.drivers.clock_driver import SystemClockDriver
from src.infrastructure.repository.system_clock_adapter import SystemClockAdapter
from src.presentation.web_server import make_handler


def create_app(context_name: str = "${contextName}") -> CheckHealthService:
    driver = SystemClockDriver()
    adapter = SystemClockAdapter(driver)
    return CheckHealthService(context_name, adapter)


def main() -> None:
    port = int(os.environ.get("PORT", "3000"))
    use_case = create_app()
    server = ThreadingHTTPServer(("127.0.0.1", port), make_handler(use_case))
    actual_port = server.server_address[1]
    print(f"LISTENING http://127.0.0.1:{actual_port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
`;

  // Pure Python 3.12 sys.monitoring C1 branch coverage runner + Node CDP Chromium runner
  files["scripts/run_c1_coverage.py"] = `import dis
import os
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

EXCLUDED = {"src/infrastructure/drivers/clock_driver.py", "src/main.py"}


def expected_branches(code):
    branches = {}
    insns = list(dis.get_instructions(code))
    for idx, ins in enumerate(insns):
        if "JUMP_IF_" in ins.opname or "POP_JUMP_IF_" in ins.opname:
            # Skip synthetic catch-all except Exception mismatch branch (BaseException propagation)
            if idx >= 2 and insns[idx - 1].opname == "CHECK_EXC_MATCH" and insns[idx - 2].argval == "Exception":
                continue
            fallthrough = insns[idx + 1].offset if idx + 1 < len(insns) else None
            branches[(code, ins.offset)] = {ins.argval, fallthrough} - {None}
    for const in code.co_consts:
        if hasattr(const, "co_code"):
            branches.update(expected_branches(const))
    return branches


def run():
    tool_id = 2
    observed = {}
    src_root = str((ROOT / "src").resolve())

    def on_branch(code, offset, dst):
        fn = os.path.abspath(code.co_filename)
        if fn.startswith(src_root):
            observed.setdefault((code, offset), set()).add(dst)
        return sys.monitoring.DISABLE

    # Track without DISABLE so both directions are recorded
    def on_branch_keep(code, offset, dst):
        fn = os.path.abspath(code.co_filename)
        if fn.startswith(src_root):
            observed.setdefault((code, offset), set()).add(dst)

    sys.monitoring.use_tool_id(tool_id, "ai_ddd_c1")
    sys.monitoring.register_callback(tool_id, sys.monitoring.events.BRANCH, on_branch_keep)
    sys.monitoring.set_events(tool_id, sys.monitoring.events.BRANCH)

    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests" / "unit"), pattern="test_*.py")
    res = unittest.TextTestRunner(verbosity=2).run(suite)

    sys.monitoring.set_events(tool_id, 0)
    sys.monitoring.free_tool_id(tool_id)

    if not res.wasSuccessful():
        sys.exit(1)

    misses = []
    checked_files = 0
    for py_file in sorted((ROOT / "src").rglob("*.py")):
        rel = py_file.relative_to(ROOT).as_posix()
        if rel in EXCLUDED or py_file.name == "__init__.py":
            continue
        checked_files += 1
        code = compile(py_file.read_text(encoding="utf-8"), str(py_file.resolve()), "exec")
        # Map observed branches by (filename, line, offset) against compiled code
        obs_by_line = {}
        for (ocode, ooffset), dsts in observed.items():
            if os.path.abspath(ocode.co_filename) == str(py_file.resolve()):
                obs_by_line[(ocode.co_firstlineno, ocode.co_name, ooffset)] = dsts
        for (bcode, boffset), targets in expected_branches(code).items():
            seen = obs_by_line.get((bcode.co_firstlineno, bcode.co_name, boffset), set())
            missing = targets - seen
            if missing:
                misses.append(f"{rel}:{bcode.co_firstlineno} ({bcode.co_name}) offset {boffset} missing branch target(s) {missing}")

    if misses:
        print("C1 Branch Coverage FAILED (must be 100% outside exclusions):", file=sys.stderr)
        for m in misses:
            print("  -", m, file=sys.stderr)
        sys.exit(1)

    print(f"PASS: 100% C1 branch coverage verified across {checked_files} non-excluded Python files.")


if __name__ == "__main__":
    run()
`;

  files["scripts/browser_driver.mjs"] = `import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  const cacheBase = path.join(os.homedir(), ".cache", "ms-playwright");
  for (const entry of fs.readdirSync(cacheBase).sort().reverse()) {
    for (const sub of ["chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux64/chrome"]) {
      const p = path.join(cacheBase, entry, sub);
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error("Chromium not found");
}

const scenarios = JSON.parse(process.argv[2]);
const exe = findChromium();
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "ai-ddd-py-chrome-"));
const proc = spawn(exe, ["--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=0", \`--user-data-dir=\${userData}\`, "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let err = "";
  const t = setTimeout(() => reject(new Error("Chrome timeout: " + err)), 15000);
  proc.stderr.on("data", (d) => {
    err += d.toString();
    const m = err.match(/DevTools listening on (ws:\\/\\/[^\\s]+)/);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
});

const ws = new WebSocket(wsUrl);
await new Promise((r, j) => {
  const t = setTimeout(() => j(new Error("WebSocket open timeout")), 10000);
  ws.addEventListener("open", () => { clearTimeout(t); r(); }, { once: true });
  ws.addEventListener("error", (e) => { clearTimeout(t); j(e); }, { once: true });
});
let nid = 1;
const pend = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) {
    const { resolve, reject, timer } = pend.get(m.id);
    clearTimeout(timer);
    pend.delete(m.id);
    if (m.error) reject(new Error(m.error.message));
    else resolve(m.result);
  }
});
ws.addEventListener("close", () => {
  for (const [, entry] of pend) {
    clearTimeout(entry.timer);
    entry.reject(new Error("WebSocket closed"));
  }
  pend.clear();
});
const send = (method, params = {}, sessionId = undefined) => {
  const id = nid++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pend.delete(id);
      reject(new Error(\`CDP timeout on \${method}\`));
    }, 10000);
    pend.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  });
};

let exitCode = 0;
try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  for (const s of scenarios) {
    const loaded = new Promise((r, j) => {
      const t = setTimeout(() => { ws.removeEventListener("message", h); j(new Error("Load timeout")); }, 10000);
      const h = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.sessionId === sessionId && m.method === "Page.loadEventFired") {
          clearTimeout(t);
          ws.removeEventListener("message", h);
          r();
        }
      };
      ws.addEventListener("message", h);
    });
    await send("Page.navigate", { url: s.url }, sessionId);
    await loaded;
    const res = await send("Runtime.evaluate", {
      expression: \`document.querySelector(\${JSON.stringify(s.selector)})?.textContent ?? null\`,
      returnByValue: true,
    }, sessionId);
    assert.equal(res.result?.value ?? null, s.expected);
  }
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  try { ws.close(); } catch {}
  if (proc.exitCode === null) {
    proc.kill("SIGKILL");
    await Promise.race([
      new Promise((r) => proc.once("exit", r)),
      new Promise((r) => setTimeout(r, 500)),
    ]);
  }
  try { fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch {}
  process.exit(exitCode);
}
`;

  files["tests/unit/test_all_layers.py"] = `import json
import pathlib
import subprocess
import unittest
from src.application.get_health import CheckHealthService
from src.domain.health import DomainError, create_health_status
from src.domain.result import Err, Ok
from src.infrastructure.repository.clock_mapper import map_raw_timestamp
from src.infrastructure.repository.system_clock_adapter import SystemClockAdapter
from src.presentation.web_server import run_presentation_server

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent


class _OkClockPort:
    def current_iso(self):
        return Ok("2026-11-22T00:00:00Z")


class _ErrClockPort:
    def current_iso(self):
        return Err(DomainError(code="CLOCK_UNAVAILABLE", message="down"))


class _OkDriver:
    def read_system_iso(self) -> str:
        return " 2026-11-22T00:00:00Z "


class _ErrDriver:
    def read_system_iso(self) -> str:
        raise RuntimeError("io fail")


class _ConfigurableMockUseCase:
    def __init__(self, result):
        self.result = result

    def execute(self):
        return self.result


class TestSkeletonLayers(unittest.TestCase):
    def test_domain_and_application(self) -> None:
        self.assertIsInstance(create_health_status("${contextName}", "2026-11-22T00:00:00Z"), Ok)
        self.assertIsInstance(create_health_status("${contextName}", "   "), Err)
        self.assertIsInstance(CheckHealthService("${contextName}", _OkClockPort()).execute(), Ok)
        self.assertIsInstance(CheckHealthService("${contextName}", _ErrClockPort()).execute(), Err)

    def test_infrastructure(self) -> None:
        self.assertIsInstance(map_raw_timestamp("2026-11-22T00:00:00Z"), Ok)
        self.assertIsInstance(map_raw_timestamp(" "), Err)
        self.assertIsInstance(SystemClockAdapter(_OkDriver()).current_iso(), Ok)
        self.assertIsInstance(SystemClockAdapter(_ErrDriver()).current_iso(), Err)

    def test_presentation_browser_all_branches(self) -> None:
        from src.domain.health import HealthStatus
        mock_uc = _ConfigurableMockUseCase(Ok(HealthStatus(context="${contextName}", checked_at_iso="2026-11-22T00:00:00Z")))
        with run_presentation_server(mock_uc, 0) as base_url:
            scenarios = [
                {"url": f"{base_url}/", "selector": "[data-testid='health-status']", "expected": "OK: ${contextName}"},
            ]
            subprocess.run(["node", str(ROOT / "scripts" / "browser_driver.mjs"), json.dumps(scenarios)], check=True)
            mock_uc.result = Err(DomainError(code="CLOCK_UNAVAILABLE", message="mock outage"))
            scenarios_err = [
                {"url": f"{base_url}/", "selector": "[data-testid='error-banner']", "expected": "CLOCK_UNAVAILABLE: mock outage"},
                {"url": f"{base_url}/missing", "selector": "[data-testid='not-found']", "expected": "Page Not Found"},
            ]
            subprocess.run(["node", str(ROOT / "scripts" / "browser_driver.mjs"), json.dumps(scenarios_err)], check=True)
`;

  if (dist === "docker") {
    files["Dockerfile"] = `FROM python:3.12-slim
WORKDIR /app
COPY . .
EXPOSE 3000
CMD ["python3", "-m", "src.main"]
`;
    files["docker-compose.integration.yml"] = `services:
  app:
    build: .
    ports:
      - "13001:3000"
`;
    files["scripts/test-integration.sh"] = `#!/usr/bin/env bash
set -euo pipefail
if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running; cannot execute Docker integration test." >&2
  exit 1
fi
docker compose -f docker-compose.integration.yml up -d --build
trap 'docker compose -f docker-compose.integration.yml down -v' EXIT
sleep 2
curl -fsS http://127.0.0.1:13001/ | grep -q "OK: ${contextName}"
echo "PASS: Docker container integration test verified drivers/ and main.py"
`;
  } else if (dist === "binary") {
    files["scripts/test-integration.sh"] = `#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
import os, re, subprocess, time, urllib.request
env = dict(os.environ, PORT="0")
proc = subprocess.Popen(["python3", "-m", "src.main"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
try:
    url = None
    deadline = time.time() + 10
    while time.time() < deadline:
        line = proc.stdout.readline()
        m = re.search(r"LISTENING (http://\\S+)", line)
        if m:
            url = m.group(1)
            break
    assert url is not None, "Server failed to start"
    with urllib.request.urlopen(url + "/") as resp:
        assert resp.status == 200
        body = resp.read().decode("utf-8")
        assert "OK: ${contextName}" in body
    print("PASS: Process integration test verified drivers/ and main.py at", url)
finally:
    proc.terminate()
    proc.wait(timeout=5)
PY
`;
  } else {
    files["scripts/test-integration.sh"] = `#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
from src.main import create_app
from src.domain.result import Ok
uc = create_app()
res = uc.execute()
assert isinstance(res, Ok) and res.value.context == "${contextName}"
print("PASS: Library entrypoint integration test verified drivers/ and main.py")
PY
`;
  }

  files["scripts/run-unit-tests.sh"] = `#!/usr/bin/env bash
set -euo pipefail
node ${JSON.stringify(cliPath)} verify --target .
python3 scripts/run_c1_coverage.py
`;

  return files;
}
