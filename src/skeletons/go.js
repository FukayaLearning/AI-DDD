export function generateGoSkeleton({ projectName, contextName, dist, cliPath }) {
  const moduleName = `example.com/${projectName.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
  const files = {};

  files["go.mod"] = `module ${moduleName}

go 1.23
`;

  files["internal/domain/result.go"] = `package domain

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

  files["internal/domain/health.go"] = `package domain

import "strings"

type DomainError struct {
	Code    string
	Message string
}

type HealthStatus struct {
	Context      string
	CheckedAtIso string
}

type ClockPort interface {
	CurrentIso() Result[string, DomainError]
}

func CreateHealthStatus(context string, checkedAtIso string) Result[HealthStatus, DomainError] {
	trimmed := strings.TrimSpace(checkedAtIso)
	if trimmed == "" {
		return Failure[HealthStatus, DomainError](DomainError{
			Code:    "INVALID_TIMESTAMP",
			Message: "Timestamp must not be empty",
		})
	}
	return Success[HealthStatus, DomainError](HealthStatus{
		Context:      context,
		CheckedAtIso: trimmed,
	})
}
`;

  files["internal/application/get_health.go"] = `package application

import "${moduleName}/internal/domain"

type GetHealthUseCase interface {
	Execute() domain.Result[domain.HealthStatus, domain.DomainError]
}

type CheckHealthService struct {
	contextName string
	clock       domain.ClockPort
}

func NewCheckHealthService(contextName string, clock domain.ClockPort) *CheckHealthService {
	return &CheckHealthService{contextName: contextName, clock: clock}
}

func (s *CheckHealthService) Execute() domain.Result[domain.HealthStatus, domain.DomainError] {
	now := s.clock.CurrentIso()
	if !now.Ok {
		return domain.Failure[domain.HealthStatus, domain.DomainError](*now.Error)
	}
	return domain.CreateHealthStatus(s.contextName, now.Value)
}
`;

  files["internal/infrastructure/drivers/clock_driver.go"] = `package drivers

import "time"

type RawClockDriver interface {
	ReadSystemIso() (string, error)
}

type SystemClockDriver struct{}

func (SystemClockDriver) ReadSystemIso() (string, error) {
	return time.Now().UTC().Format(time.RFC3339), nil
}
`;

  files["internal/infrastructure/repository/clock_mapper.go"] = `package repository

import (
	"strings"
	"${moduleName}/internal/domain"
)

func MapRawTimestamp(raw string) domain.Result[string, domain.DomainError] {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return domain.Failure[string, domain.DomainError](domain.DomainError{
			Code:    "CLOCK_UNAVAILABLE",
			Message: "Clock returned empty timestamp",
		})
	}
	return domain.Success[string, domain.DomainError](trimmed)
}
`;

  files["internal/infrastructure/repository/system_clock_adapter.go"] = `package repository

import (
	"${moduleName}/internal/domain"
	"${moduleName}/internal/infrastructure/drivers"
)

type SystemClockAdapter struct {
	driver drivers.RawClockDriver
}

func NewSystemClockAdapter(driver drivers.RawClockDriver) *SystemClockAdapter {
	return &SystemClockAdapter{driver: driver}
}

func (a *SystemClockAdapter) CurrentIso() domain.Result[string, domain.DomainError] {
	raw, err := a.driver.ReadSystemIso()
	if err != nil {
		return domain.Failure[string, domain.DomainError](domain.DomainError{
			Code:    "CLOCK_UNAVAILABLE",
			Message: "Failed to read system clock",
		})
	}
	return MapRawTimestamp(raw)
}
`;

  files["internal/presentation/web_server.go"] = `package presentation

import (
	"fmt"
	"html"
	"net/http"
	"${moduleName}/internal/application"
)

func RenderHealthHTML(title string, body string) string {
	return fmt.Sprintf("<!doctype html><html lang='en'><head><meta charset='utf-8'><title>%s</title></head><body>%s</body></html>", html.EscapeString(title), body)
}

func NewWebHandler(useCase application.GetHealthUseCase) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/" {
			res := useCase.Execute()
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			if !res.Ok {
				w.WriteHeader(http.StatusServiceUnavailable)
				_, _ = w.Write([]byte(RenderHealthHTML("Service Unavailable", fmt.Sprintf("<main><div data-testid='error-banner'>%s: %s</div></main>", html.EscapeString(res.Error.Code), html.EscapeString(res.Error.Message)))))
				return
			}
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(RenderHealthHTML("Service Healthy", fmt.Sprintf("<main><h1 data-testid='health-status'>OK: %s</h1><p data-testid='checked-at'>%s</p></main>", html.EscapeString(res.Value.Context), html.EscapeString(res.Value.CheckedAtIso)))))
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(RenderHealthHTML("Not Found", "<main><p data-testid='not-found'>Page Not Found</p></main>")))
	})
}
`;

  files["cmd/server/main.go"] = `package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"${moduleName}/internal/application"
	"${moduleName}/internal/infrastructure/drivers"
	"${moduleName}/internal/infrastructure/repository"
	"${moduleName}/internal/presentation"
)

func CreateApp(contextName string) application.GetHealthUseCase {
	drv := drivers.SystemClockDriver{}
	adapter := repository.NewSystemClockAdapter(drv)
	return application.NewCheckHealthService(contextName, adapter)
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
	_ = http.Serve(ln, presentation.NewWebHandler(CreateApp("${contextName}")))
}
`;

  files["internal/domain/health_test.go"] = `package domain_test

import (
	"testing"
	"${moduleName}/internal/domain"
)

func TestCreateHealthStatus(t *testing.T) {
	okRes := domain.CreateHealthStatus("${contextName}", " 2026-11-22T00:00:00Z ")
	if !okRes.Ok || okRes.Value.CheckedAtIso != "2026-11-22T00:00:00Z" {
		t.Fatalf("expected Ok, got %+v", okRes)
	}
	errRes := domain.CreateHealthStatus("${contextName}", " ")
	if errRes.Ok || errRes.Error.Code != "INVALID_TIMESTAMP" {
		t.Fatalf("expected INVALID_TIMESTAMP, got %+v", errRes)
	}
}
`;

  files["internal/application/get_health_test.go"] = `package application_test

import (
	"testing"
	"${moduleName}/internal/application"
	"${moduleName}/internal/domain"
)

type stubClockPort struct{ res domain.Result[string, domain.DomainError] }

func (s stubClockPort) CurrentIso() domain.Result[string, domain.DomainError] { return s.res }

func TestCheckHealthService(t *testing.T) {
	svcOk := application.NewCheckHealthService("${contextName}", stubClockPort{res: domain.Success[string, domain.DomainError]("2026-11-22T00:00:00Z")})
	if res := svcOk.Execute(); !res.Ok {
		t.Fatalf("expected Ok")
	}
	svcErr := application.NewCheckHealthService("${contextName}", stubClockPort{res: domain.Failure[string, domain.DomainError](domain.DomainError{Code: "CLOCK_UNAVAILABLE", Message: "down"})})
	if res := svcErr.Execute(); res.Ok || res.Error.Code != "CLOCK_UNAVAILABLE" {
		t.Fatalf("expected Err")
	}
}
`;

  files["internal/infrastructure/repository/system_clock_adapter_test.go"] = `package repository_test

import (
	"errors"
	"testing"
	"${moduleName}/internal/infrastructure/repository"
)

type mockDriver struct {
	iso string
	err error
}

func (m mockDriver) ReadSystemIso() (string, error) { return m.iso, m.err }

func TestSystemClockAdapter(t *testing.T) {
	if res := repository.MapRawTimestamp("2026-11-22T00:00:00Z"); !res.Ok {
		t.Fatalf("expected Ok")
	}
	if res := repository.MapRawTimestamp(" "); res.Ok {
		t.Fatalf("expected Err")
	}
	if res := repository.NewSystemClockAdapter(mockDriver{iso: "2026-11-22T00:00:00Z"}).CurrentIso(); !res.Ok {
		t.Fatalf("expected Ok")
	}
	if res := repository.NewSystemClockAdapter(mockDriver{err: errors.New("io")}).CurrentIso(); res.Ok {
		t.Fatalf("expected Err")
	}
}
`;

  files["internal/presentation/web_server_test.go"] = `package presentation_test

import (
	"encoding/json"
	"net/http/httptest"
	"os/exec"
	"testing"
	"${moduleName}/internal/domain"
	"${moduleName}/internal/presentation"
)

type mockUseCase struct {
	res domain.Result[domain.HealthStatus, domain.DomainError]
}

func (m *mockUseCase) Execute() domain.Result[domain.HealthStatus, domain.DomainError] { return m.res }

func TestPresentationWebUIWithBrowser(t *testing.T) {
	uc := &mockUseCase{res: domain.Success[domain.HealthStatus, domain.DomainError](domain.HealthStatus{Context: "${contextName}", CheckedAtIso: "2026-11-22T00:00:00Z"})}
	srv := httptest.NewServer(presentation.NewWebHandler(uc))
	defer srv.Close()

	scenarios, _ := json.Marshal([]map[string]string{
		{"url": srv.URL + "/", "selector": "[data-testid='health-status']", "expected": "OK: ${contextName}"},
	})
	if out, err := exec.Command("node", "../../scripts/browser_driver.mjs", string(scenarios)).CombinedOutput(); err != nil {
		t.Fatalf("browser test failed: %v %s", err, string(out))
	}

	uc.res = domain.Failure[domain.HealthStatus, domain.DomainError](domain.DomainError{Code: "CLOCK_UNAVAILABLE", Message: "mock outage"})
	scenariosErr, _ := json.Marshal([]map[string]string{
		{"url": srv.URL + "/", "selector": "[data-testid='error-banner']", "expected": "CLOCK_UNAVAILABLE: mock outage"},
		{"url": srv.URL + "/missing", "selector": "[data-testid='not-found']", "expected": "Page Not Found"},
	})
	if out, err := exec.Command("node", "../../scripts/browser_driver.mjs", string(scenariosErr)).CombinedOutput(); err != nil {
		t.Fatalf("browser error test failed: %v %s", err, string(out))
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
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nid = 1;
const pend = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) {
    const { resolve, reject } = pend.get(m.id);
    pend.delete(m.id);
    if (m.error) reject(new Error(m.error.message));
    else resolve(m.result);
  }
});
const send = (method, params = {}, sessionId = undefined) => {
  const id = nid++;
  return new Promise((resolve, reject) => {
    pend.set(id, { resolve, reject });
    ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  });
};

try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  for (const s of scenarios) {
    const loaded = new Promise((r) => {
      const h = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.sessionId === sessionId && m.method === "Page.loadEventFired") {
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
} finally {
  try { await send("Browser.close"); } catch {}
  try { ws.close(); } catch {}
  if (proc.exitCode === null) {
    proc.kill("SIGKILL");
    await new Promise((r) => proc.once("exit", r));
  }
  try { fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch {}
}
`;

  files["scripts/test-unit-c1.sh"] = `#!/usr/bin/env bash
set -euo pipefail
node ${JSON.stringify(cliPath)} verify --target .
if ! command -v go >/dev/null 2>&1; then
  echo "ERROR: 'go' toolchain not found in PATH." >&2
  exit 1
fi
go test -v -covermode=atomic -coverprofile=coverage.out ./internal/domain/... ./internal/application/... ./internal/infrastructure/repository/... ./internal/presentation/...
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
go build ./cmd/server
echo "PASS: Go library package compilation and wiring verified"
`;
  }

  return files;
}
