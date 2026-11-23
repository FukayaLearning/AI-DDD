export function generateGoSkeleton({ projectName, contextName, contextCode = "CTX", locale = "en", dist, cliPath }) {
  const C = contextCode;
  const moduleName = `example.com/${projectName.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
  const files = {};

  files["go.mod"] = `module ${moduleName}

go 1.23
`;

  files["internal/domain/shared/result.go"] = `package shared

type Result[T any, E any] struct {
	Ok    bool
	Value T
	Error *E
}

func Success[T any, E any](value T) Result[T, E] {
	return Result[T, E]{Ok: true, Value: value}
}

func Failure[T any, E any](err E) Result[T, E] {
	return Result[T, E]{Ok: false, Error: &err}
}
`;

  files["internal/domain/entities/health/health.go"] = `package health

import (
	"strings"
	"${moduleName}/internal/domain/shared"
)

type DomainError struct {
	Code    string
	Message string
}

type HealthStatus struct {
	Context      string
	CheckedAtIso string
}

func CreateHealthStatus(context string, checkedAtIso string) shared.Result[HealthStatus, DomainError] {
	trimmed := strings.TrimSpace(checkedAtIso)
	if trimmed == "" {
		return shared.Failure[HealthStatus, DomainError](DomainError{
			Code:    "INVALID_TIMESTAMP",
			Message: "Timestamp must not be empty",
		})
	}
	return shared.Success[HealthStatus, DomainError](HealthStatus{
		Context:      context,
		CheckedAtIso: trimmed,
	})
}
`;

  files["internal/domain/services/health/clock_port.go"] = `package healthport

import (
	"${moduleName}/internal/domain/entities/health"
	"${moduleName}/internal/domain/shared"
)

type ClockPort interface {
	CurrentIso() shared.Result[string, health.DomainError]
}
`;

  files["internal/application/services/health/get_health.go"] = `package healthapp

import (
	"${moduleName}/internal/domain/entities/health"
	healthport "${moduleName}/internal/domain/services/health"
	"${moduleName}/internal/domain/shared"
)

type GetHealthUseCase interface {
	Execute() shared.Result[health.HealthStatus, health.DomainError]
}

// @implements REQ-${C}-001
type CheckHealthService struct {
	contextName string
	clock       healthport.ClockPort
}

func NewCheckHealthService(contextName string, clock healthport.ClockPort) *CheckHealthService {
	return &CheckHealthService{contextName: contextName, clock: clock}
}

func (s *CheckHealthService) Execute() shared.Result[health.HealthStatus, health.DomainError] {
	now := s.clock.CurrentIso()
	if !now.Ok {
		return shared.Failure[health.HealthStatus, health.DomainError](*now.Error)
	}
	return health.CreateHealthStatus(s.contextName, now.Value)
}
`;

  files["internal/infrastructure/drivers/clock/clock_driver.go"] = `package clock

import "time"

type RawClockDriver interface {
	ReadSystemIso() (string, error)
}

type SystemClockDriver struct{}

func (SystemClockDriver) ReadSystemIso() (string, error) {
	return time.Now().UTC().Format(time.RFC3339), nil
}
`;

  files["internal/infrastructure/mappers/health/clock_mapper.go"] = `package healthmapper

import (
	"strings"
	domain "${moduleName}/internal/domain/entities/health"
	"${moduleName}/internal/domain/shared"
)

func MapRawTimestamp(raw string) shared.Result[string, domain.DomainError] {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return shared.Failure[string, domain.DomainError](domain.DomainError{
			Code:    "CLOCK_UNAVAILABLE",
			Message: "Clock returned empty timestamp",
		})
	}
	return shared.Success[string, domain.DomainError](trimmed)
}
`;

  files["internal/infrastructure/repositories/health/system_clock_adapter.go"] = `package healthrepo

import (
	domain "${moduleName}/internal/domain/entities/health"
	"${moduleName}/internal/domain/shared"
	"${moduleName}/internal/infrastructure/drivers/clock"
	healthmapper "${moduleName}/internal/infrastructure/mappers/health"
)

type SystemClockAdapter struct {
	driver clock.RawClockDriver
}

func NewSystemClockAdapter(driver clock.RawClockDriver) *SystemClockAdapter {
	return &SystemClockAdapter{driver: driver}
}

func (a *SystemClockAdapter) CurrentIso() shared.Result[string, domain.DomainError] {
	raw, err := a.driver.ReadSystemIso()
	if err != nil {
		return shared.Failure[string, domain.DomainError](domain.DomainError{
			Code:    "CLOCK_UNAVAILABLE",
			Message: "Failed to read system clock",
		})
	}
	return healthmapper.MapRawTimestamp(raw)
}
`;

  files["internal/presentation/i18n/en.go"] = `package i18n

type HealthMessages struct {
	Locale           string
	HealthyTitle     string
	UnavailableTitle string
	NotFoundTitle    string
	NotFoundBody     string
	ErrorMessages    map[string]string
}

var EnMessages = HealthMessages{
	Locale:           "en",
	HealthyTitle:     "Service Healthy",
	UnavailableTitle: "Service Unavailable",
	NotFoundTitle:    "Not Found",
	NotFoundBody:     "Page Not Found",
	ErrorMessages: map[string]string{
		"CLOCK_UNAVAILABLE": "System clock is unavailable",
	},
}
`;

  if (locale !== "en") {
    const isJa = locale === "ja";
    files[`internal/presentation/i18n/${locale}.go`] = `package i18n

var UserMessages = HealthMessages{
	Locale:           ${JSON.stringify(locale)},
	HealthyTitle:     ${JSON.stringify(isJa ? "サービス正常" : `[${locale}] Service Healthy`)},
	UnavailableTitle: ${JSON.stringify(isJa ? "サービス利用不可" : `[${locale}] Service Unavailable`)},
	NotFoundTitle:    ${JSON.stringify(isJa ? "見つかりません" : `[${locale}] Not Found`)},
	NotFoundBody:     ${JSON.stringify(isJa ? "ページが見つかりません" : `[${locale}] Page Not Found`)},
	ErrorMessages: map[string]string{
		"CLOCK_UNAVAILABLE": ${JSON.stringify(isJa ? "システム時刻を取得できません" : `[${locale}] System clock is unavailable`)},
	},
}
`;
  }

  files["internal/presentation/views/health/health_view.go"] = `package healthview

import (
	"fmt"
	"html"
	"${moduleName}/internal/presentation/i18n"
)

func RenderHealthHTML(locale string, title string, body string) string {
	return fmt.Sprintf("<!doctype html><html lang='%s'><head><meta charset='utf-8'><title>%s</title></head><body>%s</body></html>", html.EscapeString(locale), html.EscapeString(title), body)
}

func LocalizeError(msg i18n.HealthMessages, code, fallback string) string {
	if localized, ok := msg.ErrorMessages[code]; ok {
		return localized
	}
	return fallback
}
`;

  files["internal/presentation/controllers/health/health_controller.go"] = `package healthcontroller

import (
	"fmt"
	"html"
	"net/http"
	healthapp "${moduleName}/internal/application/services/health"
	"${moduleName}/internal/presentation/i18n"
	healthview "${moduleName}/internal/presentation/views/health"
)

func NewWebHandler(useCase healthapp.GetHealthUseCase, msg i18n.HealthMessages) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/" {
			res := useCase.Execute()
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			if !res.Ok {
				w.WriteHeader(http.StatusServiceUnavailable)
				_, _ = w.Write([]byte(healthview.RenderHealthHTML(msg.Locale, msg.UnavailableTitle, fmt.Sprintf("<main><div data-testid='error-banner'>%s: %s</div></main>", html.EscapeString(res.Error.Code), html.EscapeString(healthview.LocalizeError(msg, res.Error.Code, res.Error.Message))))))
				return
			}
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(healthview.RenderHealthHTML(msg.Locale, msg.HealthyTitle, fmt.Sprintf("<main><h1 data-testid='health-status'>OK: %s</h1><p data-testid='checked-at'>%s</p></main>", html.EscapeString(res.Value.Context), html.EscapeString(res.Value.CheckedAtIso)))))
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(healthview.RenderHealthHTML(msg.Locale, msg.NotFoundTitle, fmt.Sprintf("<main><p data-testid='not-found'>%s</p></main>", html.EscapeString(msg.NotFoundBody)))))
	})
}
`;

  const goMainMsg =
    locale !== "en"
      ? `	msg := i18n.UserMessages
	if os.Getenv("APP_LOCALE") == "en" {
		msg = i18n.EnMessages
	}`
      : `	msg := i18n.EnMessages`;

  files["cmd/server/main.go"] = `package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	healthapp "${moduleName}/internal/application/services/health"
	"${moduleName}/internal/infrastructure/drivers/clock"
	healthrepo "${moduleName}/internal/infrastructure/repositories/health"
	healthcontroller "${moduleName}/internal/presentation/controllers/health"
	"${moduleName}/internal/presentation/i18n"
)

func CreateApp(contextName string) healthapp.GetHealthUseCase {
	drv := clock.SystemClockDriver{}
	adapter := healthrepo.NewSystemClockAdapter(drv)
	return healthapp.NewCheckHealthService(contextName, adapter)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
	ln, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		panic(err)
	}
	fmt.Printf("LISTENING http://%s\\n", ln.Addr().String())
${goMainMsg}
	_ = http.Serve(ln, healthcontroller.NewWebHandler(CreateApp("${contextName}"), msg))
}
`;

  files["internal/domain/entities/health/health_test.go"] = `package health_test

import (
	"testing"
	"${moduleName}/internal/domain/entities/health"
)

// UT-${C}-001, UT-${C}-002
func TestUT_${C}_001_CreateHealthStatus(t *testing.T) {
	okRes := health.CreateHealthStatus("${contextName}", " 2026-11-22T00:00:00Z ")
	if !okRes.Ok || okRes.Value.CheckedAtIso != "2026-11-22T00:00:00Z" {
		t.Fatalf("expected Ok, got %+v", okRes)
	}
	errRes := health.CreateHealthStatus("${contextName}", " ")
	if errRes.Ok || errRes.Error.Code != "INVALID_TIMESTAMP" {
		t.Fatalf("expected INVALID_TIMESTAMP, got %+v", errRes)
	}
}
`;

  files["internal/application/services/health/get_health_test.go"] = `package healthapp_test

import (
	"testing"
	healthapp "${moduleName}/internal/application/services/health"
	"${moduleName}/internal/domain/entities/health"
	"${moduleName}/internal/domain/shared"
)

type stubClockPort struct{ res shared.Result[string, health.DomainError] }

func (s stubClockPort) CurrentIso() shared.Result[string, health.DomainError] { return s.res }

// UT-${C}-005, UT-${C}-006
func TestUT_${C}_005_CheckHealthService(t *testing.T) {
	svcOk := healthapp.NewCheckHealthService("${contextName}", stubClockPort{res: shared.Success[string, health.DomainError]("2026-11-22T00:00:00Z")})
	if res := svcOk.Execute(); !res.Ok {
		t.Fatalf("expected Ok")
	}
	svcErr := healthapp.NewCheckHealthService("${contextName}", stubClockPort{res: shared.Failure[string, health.DomainError](health.DomainError{Code: "CLOCK_UNAVAILABLE", Message: "down"})})
	if res := svcErr.Execute(); res.Ok || res.Error.Code != "CLOCK_UNAVAILABLE" {
		t.Fatalf("expected Err")
	}
}
`;

  files["internal/infrastructure/repositories/health/system_clock_adapter_test.go"] = `package healthrepo_test

import (
	"errors"
	"testing"
	healthmapper "${moduleName}/internal/infrastructure/mappers/health"
	healthrepo "${moduleName}/internal/infrastructure/repositories/health"
)

type mockDriver struct {
	iso string
	err error
}

func (m mockDriver) ReadSystemIso() (string, error) { return m.iso, m.err }

// UT-${C}-003, UT-${C}-004
func TestUT_${C}_003_SystemClockAdapter(t *testing.T) {
	if res := healthmapper.MapRawTimestamp("2026-11-22T00:00:00Z"); !res.Ok {
		t.Fatalf("expected Ok")
	}
	if res := healthmapper.MapRawTimestamp(" "); res.Ok {
		t.Fatalf("expected Err")
	}
	if res := healthrepo.NewSystemClockAdapter(mockDriver{iso: "2026-11-22T00:00:00Z"}).CurrentIso(); !res.Ok {
		t.Fatalf("expected Ok")
	}
	if res := healthrepo.NewSystemClockAdapter(mockDriver{err: errors.New("io")}).CurrentIso(); res.Ok {
		t.Fatalf("expected Err")
	}
}
`;

  files["internal/presentation/controllers/health/health_controller_test.go"] = `package healthcontroller_test

import (
	"encoding/json"
	"net/http/httptest"
	"os/exec"
	"testing"
	domain "${moduleName}/internal/domain/entities/health"
	"${moduleName}/internal/domain/shared"
	healthcontroller "${moduleName}/internal/presentation/controllers/health"
	"${moduleName}/internal/presentation/i18n"
)

type mockUseCase struct {
	res shared.Result[domain.HealthStatus, domain.DomainError]
}

func (m *mockUseCase) Execute() shared.Result[domain.HealthStatus, domain.DomainError] { return m.res }

// UT-${C}-007
func TestUT_${C}_007_PresentationWebUIWithBrowser(t *testing.T) {
	uc := &mockUseCase{res: shared.Success[domain.HealthStatus, domain.DomainError](domain.HealthStatus{Context: "${contextName}", CheckedAtIso: "2026-11-22T00:00:00Z"})}
	srv := httptest.NewServer(healthcontroller.NewWebHandler(uc, i18n.EnMessages))
	defer srv.Close()

	scenarios, _ := json.Marshal([]map[string]string{
		{"url": srv.URL + "/", "selector": "[data-testid='health-status']", "expected": "OK: ${contextName}"},
	})
	if out, err := exec.Command("node", "../../../../scripts/browser_driver.mjs", string(scenarios)).CombinedOutput(); err != nil {
		t.Fatalf("browser test failed: %v %s", err, string(out))
	}

	uc.res = shared.Failure[domain.HealthStatus, domain.DomainError](domain.DomainError{Code: "CLOCK_UNAVAILABLE", Message: "mock outage"})
	scenariosErr, _ := json.Marshal([]map[string]string{
		{"url": srv.URL + "/", "selector": "[data-testid='error-banner']", "expected": "CLOCK_UNAVAILABLE: System clock is unavailable"},
		{"url": srv.URL + "/missing", "selector": "[data-testid='not-found']", "expected": "Page Not Found"},
	})
	if out, err := exec.Command("node", "../../../../scripts/browser_driver.mjs", string(scenariosErr)).CombinedOutput(); err != nil {
		t.Fatalf("browser error test failed: %v %s", err, string(out))
	}

	uc.res = shared.Failure[domain.HealthStatus, domain.DomainError](domain.DomainError{Code: "UNKNOWN_CODE", Message: "raw fallback"})
	scenariosRaw, _ := json.Marshal([]map[string]string{
		{"url": srv.URL + "/", "selector": "[data-testid='error-banner']", "expected": "UNKNOWN_CODE: raw fallback"},
	})
	if out, err := exec.Command("node", "../../../../scripts/browser_driver.mjs", string(scenariosRaw)).CombinedOutput(); err != nil {
		t.Fatalf("browser fallback test failed: %v %s", err, string(out))
	}
}
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
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "ai-ddd-go-chrome-"));
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

  files["scripts/test-unit-c1.sh"] = `#!/usr/bin/env bash
set -euo pipefail
node ${JSON.stringify(cliPath)} verify --target .
if ! command -v go >/dev/null 2>&1; then
  echo "ERROR: 'go' toolchain not found in PATH." >&2
  exit 1
fi
go test -v -covermode=atomic -coverprofile=coverage.out ./internal/domain/... ./internal/application/... ./internal/infrastructure/mappers/... ./internal/infrastructure/repositories/... ./internal/presentation/...
go tool cover -func=coverage.out
total=$(go tool cover -func=coverage.out | awk '/^total:/ {print $3}')
if [ "$total" != "100.0%" ]; then
  echo "Coverage below 100.0%: $total" >&2
  exit 1
fi
`;

  if (dist === "docker") {
    files["Dockerfile"] = `FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o /app/server ./cmd/server

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/server /app/server
EXPOSE 3000
CMD ["/app/server"]
`;
    files["docker-compose.integration.yml"] = `services:
  app:
    build: .
    ports:
      - "13002:3000"
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
curl -fsS http://127.0.0.1:13002/ | grep -q "OK: ${contextName}"
`;
  } else if (dist === "binary") {
    files["scripts/test-integration.sh"] = `#!/usr/bin/env bash
set -euo pipefail
# IT-${C}-001, IT-${C}-002
go build -o /tmp/ai-ddd-go-server ./cmd/server
PORT=0 /tmp/ai-ddd-go-server > /tmp/ai-ddd-go.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true; rm -f /tmp/ai-ddd-go-server /tmp/ai-ddd-go.log' EXIT
sleep 1
URL=$(sed -n 's/^LISTENING //p' /tmp/ai-ddd-go.log | head -n1)
curl -fsS "$URL/" | grep -q "OK: ${contextName}"
echo "PASS: Go binary integration test verified drivers/ and cmd/server/main.go"
`;
  } else {
    files["scripts/test-integration.sh"] = `#!/usr/bin/env bash
set -euo pipefail
# IT-${C}-001, IT-${C}-002
go build ./cmd/server
echo "PASS: Go library package compilation and wiring verified"
`;
  }

  return files;
}
