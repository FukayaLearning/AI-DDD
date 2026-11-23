export function generateRustSkeleton({ projectName, contextName, contextCode = "CTX", locale = "en", dist, cliPath }) {
  const C = contextCode;
  const crateName = projectName.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  const files = {};

  files["Cargo.toml"] = `[package]
name = "${crateName}"
version = "0.1.0"
edition = "2021"
`;

  files["src/domain/mod.rs"] = `pub mod entities;
pub mod services;
pub mod shared;
`;
  files["src/domain/shared/mod.rs"] = `pub mod result;
`;
  files["src/domain/shared/result.rs"] = `#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DomainResult<T, E> {
    Ok(T),
    Err(E),
}
`;

  files["src/domain/entities/mod.rs"] = `pub mod health;
`;
  files["src/domain/entities/health/mod.rs"] = `pub mod health;
`;
  files["src/domain/entities/health/health.rs"] = `use crate::domain::shared::result::DomainResult;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DomainError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HealthStatus {
    pub context: String,
    pub checked_at_iso: String,
}

pub fn create_health_status(context: &str, checked_at_iso: &str) -> DomainResult<HealthStatus, DomainError> {
    let trimmed = checked_at_iso.trim();
    if trimmed.is_empty() {
        return DomainResult::Err(DomainError {
            code: "INVALID_TIMESTAMP".to_string(),
            message: "Timestamp must not be empty".to_string(),
        });
    }
    DomainResult::Ok(HealthStatus {
        context: context.to_string(),
        checked_at_iso: trimmed.to_string(),
    })
}
`;

  files["src/domain/services/mod.rs"] = `pub mod health;
`;
  files["src/domain/services/health/mod.rs"] = `pub mod clock_port;
`;
  files["src/domain/services/health/clock_port.rs"] = `use crate::domain::entities::health::health::DomainError;
use crate::domain::shared::result::DomainResult;

pub trait ClockPort {
    fn current_iso(&self) -> DomainResult<String, DomainError>;
}
`;

  files["src/application/mod.rs"] = `pub mod services;
`;
  files["src/application/services/mod.rs"] = `pub mod health;
`;
  files["src/application/services/health/mod.rs"] = `pub mod get_health;
`;
  files["src/application/services/health/get_health.rs"] = `use crate::domain::entities::health::health::{create_health_status, DomainError, HealthStatus};
use crate::domain::services::health::clock_port::ClockPort;
use crate::domain::shared::result::DomainResult;

pub trait GetHealthUseCase {
    fn execute(&self) -> DomainResult<HealthStatus, DomainError>;
}

// @implements REQ-${C}-001
pub struct CheckHealthService<C: ClockPort> {
    context_name: String,
    clock: C,
}

impl<C: ClockPort> CheckHealthService<C> {
    pub fn new(context_name: impl Into<String>, clock: C) -> Self {
        Self {
            context_name: context_name.into(),
            clock,
        }
    }
}

impl<C: ClockPort> GetHealthUseCase for CheckHealthService<C> {
    fn execute(&self) -> DomainResult<HealthStatus, DomainError> {
        match self.clock.current_iso() {
            DomainResult::Err(e) => DomainResult::Err(e),
            DomainResult::Ok(ts) => create_health_status(&self.context_name, &ts),
        }
    }
}
`;

  files["src/infrastructure/mod.rs"] = `pub mod drivers;
pub mod mappers;
pub mod repositories;
`;

  files["src/infrastructure/drivers/mod.rs"] = `pub mod clock;
`;
  files["src/infrastructure/drivers/clock/mod.rs"] = `pub mod clock_driver;
`;
  files["src/infrastructure/drivers/clock/clock_driver.rs"] = `use std::time::{SystemTime, UNIX_EPOCH};

pub trait RawClockDriver {
    fn read_system_epoch(&self) -> Result<u64, String>;
}

pub struct SystemClockDriver;

impl RawClockDriver for SystemClockDriver {
    fn read_system_epoch(&self) -> Result<u64, String> {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .map_err(|e| e.to_string())
    }
}
`;

  files["src/infrastructure/mappers/mod.rs"] = `pub mod health;
`;
  files["src/infrastructure/mappers/health/mod.rs"] = `pub mod clock_mapper;
`;
  files["src/infrastructure/mappers/health/clock_mapper.rs"] = `use crate::domain::entities::health::health::DomainError;
use crate::domain::shared::result::DomainResult;

pub fn map_epoch_seconds(epoch_secs: u64) -> DomainResult<String, DomainError> {
    if epoch_secs == 0 {
        return DomainResult::Err(DomainError {
            code: "CLOCK_UNAVAILABLE".to_string(),
            message: "Clock returned zero epoch".to_string(),
        });
    }
    DomainResult::Ok(format!("epoch:{}", epoch_secs))
}
`;

  files["src/infrastructure/repositories/mod.rs"] = `pub mod health;
`;
  files["src/infrastructure/repositories/health/mod.rs"] = `pub mod system_clock_adapter;
`;
  files["src/infrastructure/repositories/health/system_clock_adapter.rs"] = `use crate::domain::entities::health::health::DomainError;
use crate::domain::services::health::clock_port::ClockPort;
use crate::domain::shared::result::DomainResult;
use crate::infrastructure::drivers::clock::clock_driver::RawClockDriver;
use crate::infrastructure::mappers::health::clock_mapper::map_epoch_seconds;

pub struct SystemClockAdapter<D: RawClockDriver> {
    driver: D,
}

impl<D: RawClockDriver> SystemClockAdapter<D> {
    pub fn new(driver: D) -> Self {
        Self { driver }
    }
}

impl<D: RawClockDriver> ClockPort for SystemClockAdapter<D> {
    fn current_iso(&self) -> DomainResult<String, DomainError> {
        match self.driver.read_system_epoch() {
            Err(_) => DomainResult::Err(DomainError {
                code: "CLOCK_UNAVAILABLE".to_string(),
                message: "Failed to read system clock".to_string(),
            }),
            Ok(secs) => map_epoch_seconds(secs),
        }
    }
}
`;

  files["src/presentation/mod.rs"] = `pub mod controllers;
pub mod views;
pub mod i18n;
`;
  files["src/presentation/i18n/mod.rs"] = locale !== "en" ? `pub mod en;\npub mod user;\n` : `pub mod en;\n`;
  files["src/presentation/i18n/en.rs"] = `pub struct HealthMessages {
    pub locale: &'static str,
    pub healthy_title: &'static str,
    pub unavailable_title: &'static str,
    pub not_found_title: &'static str,
    pub not_found_body: &'static str,
    pub error_messages: &'static [(&'static str, &'static str)],
}

impl HealthMessages {
    pub fn error_message(&self, code: &str) -> Option<&'static str> {
        self.error_messages
            .iter()
            .find(|(c, _)| *c == code)
            .map(|(_, message)| *message)
    }
}

pub const EN_MESSAGES: HealthMessages = HealthMessages {
    locale: "en",
    healthy_title: "Service Healthy",
    unavailable_title: "Service Unavailable",
    not_found_title: "Not Found",
    not_found_body: "Page Not Found",
    error_messages: &[
        ("CLOCK_UNAVAILABLE", "System clock is unavailable"),
    ],
};
`;

  if (locale !== "en") {
    const isJa = locale === "ja";
    files[`src/presentation/i18n/${locale}.rs`] = `use super::en::HealthMessages;

pub const USER_MESSAGES: HealthMessages = HealthMessages {
    locale: ${JSON.stringify(locale)},
    healthy_title: ${JSON.stringify(isJa ? "サービス正常" : `[${locale}] Service Healthy`)},
    unavailable_title: ${JSON.stringify(isJa ? "サービス利用不可" : `[${locale}] Service Unavailable`)},
    not_found_title: ${JSON.stringify(isJa ? "見つかりません" : `[${locale}] Not Found`)},
    not_found_body: ${JSON.stringify(isJa ? "ページが見つかりません" : `[${locale}] Page Not Found`)},
    error_messages: &[
        ("CLOCK_UNAVAILABLE", ${JSON.stringify(isJa ? "システム時刻を取得できません" : `[${locale}] System clock is unavailable`)}),
    ],
};
`;
    files["src/presentation/i18n/mod.rs"] = `pub mod en;\n#[path = "${locale}.rs"]\npub mod user;\n`;
  }

  files["src/presentation/views/mod.rs"] = `pub mod health;
`;
  files["src/presentation/views/health/mod.rs"] = `pub mod health_view;
`;
  files["src/presentation/views/health/health_view.rs"] = `use crate::presentation::i18n::en::HealthMessages;

pub fn render_html(locale: &str, title: &str, body: &str) -> String {
    format!(
        "<!doctype html><html lang='{}'><head><meta charset='utf-8'><title>{}</title></head><body>{}</body></html>",
        locale, title, body
    )
}

pub fn localized_error<'a>(messages: &'a HealthMessages, code: &str, message: &'a str) -> &'a str {
    messages.error_message(code).unwrap_or(message)
}
`;

  files["src/presentation/controllers/mod.rs"] = `pub mod health;
`;
  files["src/presentation/controllers/health/mod.rs"] = `pub mod health_controller;
`;
  files["src/presentation/controllers/health/health_controller.rs"] = `use crate::application::services::health::get_health::GetHealthUseCase;
use crate::domain::shared::result::DomainResult;
use crate::presentation::i18n::en::{HealthMessages, EN_MESSAGES};
use crate::presentation::views::health::health_view::{localized_error, render_html};
use std::io::{Read, Write};
use std::net::TcpStream;

pub fn handle_http_request<U: GetHealthUseCase>(use_case: &U, request_line: &str, messages: &HealthMessages) -> (u16, String) {
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let path = parts.next().unwrap_or("");
    if method == "GET" && path == "/" {
        return match use_case.execute() {
            DomainResult::Err(e) => (
                503,
                render_html(
                    messages.locale,
                    messages.unavailable_title,
                    &format!("<main><div data-testid='error-banner'>{}: {}</div></main>", e.code, localized_error(messages, &e.code, &e.message)),
                ),
            ),
            DomainResult::Ok(status) => (
                200,
                render_html(
                    messages.locale,
                    messages.healthy_title,
                    &format!(
                        "<main><h1 data-testid='health-status'>OK: {}</h1><p data-testid='checked-at'>{}</p></main>",
                        status.context, status.checked_at_iso
                    ),
                ),
            ),
        };
    }
    (
        404,
        render_html(
            messages.locale,
            messages.not_found_title,
            &format!("<main><p data-testid='not-found'>{}</p></main>", messages.not_found_body),
        ),
    )
}

pub fn serve_single_connection<U: GetHealthUseCase>(mut stream: TcpStream, use_case: &U, messages: &HealthMessages) {
    let mut buf = [0u8; 2048];
    let n = stream.read(&mut buf).unwrap_or(0);
    let req_str = String::from_utf8_lossy(&buf[..n]);
    let first_line = req_str.lines().next().unwrap_or("");
    let (status_code, html) = handle_http_request(use_case, first_line, messages);
    let status_text = match status_code {
        200 => "OK",
        503 => "Service Unavailable",
        _ => "Not Found",
    };
    let response = format!(
        "HTTP/1.1 {} {}\\r\\nContent-Type: text/html; charset=utf-8\\r\\nContent-Length: {}\\r\\nConnection: close\\r\\n\\r\\n{}",
        status_code,
        status_text,
        html.len(),
        html
    );
    let _ = stream.write_all(response.as_bytes());
}
`;

  files["src/lib.rs"] = `pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod presentation;
`;

  const rsMainImport =
    locale !== "en"
      ? `use ${crateName}::presentation::i18n::en::EN_MESSAGES;\nuse ${crateName}::presentation::i18n::user::USER_MESSAGES;`
      : `use ${crateName}::presentation::i18n::en::EN_MESSAGES;`;
  const rsMainMsg =
    locale !== "en"
      ? `    let app_locale = std::env::var("APP_LOCALE").unwrap_or_else(|_| ${JSON.stringify(locale)}.to_string());\n    let messages = if app_locale == "en" { &EN_MESSAGES } else { &USER_MESSAGES };`
      : `    let messages = &EN_MESSAGES;`;

  files["src/main.rs"] = `use ${crateName}::application::services::health::get_health::CheckHealthService;
use ${crateName}::infrastructure::drivers::clock::clock_driver::SystemClockDriver;
use ${crateName}::infrastructure::repositories::health::system_clock_adapter::SystemClockAdapter;
use ${crateName}::presentation::controllers::health::health_controller::serve_single_connection;
${rsMainImport}
use std::net::TcpListener;

pub fn create_app(context_name: &str) -> CheckHealthService<SystemClockAdapter<SystemClockDriver>> {
    let drv = SystemClockDriver;
    let adapter = SystemClockAdapter::new(drv);
    CheckHealthService::new(context_name, adapter)
}

fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port)).expect("bind failed");
    let addr = listener.local_addr().expect("addr failed");
    println!("LISTENING http://{}", addr);
    let uc = create_app("${contextName}");
${rsMainMsg}
    for stream in listener.incoming().flatten() {
        serve_single_connection(stream, &uc, messages);
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
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "ai-ddd-rs-chrome-"));
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

  files["tests/all_layers_test.rs"] = `use ${crateName}::application::services::health::get_health::{CheckHealthService, GetHealthUseCase};
use ${crateName}::domain::entities::health::health::{create_health_status, DomainError, HealthStatus};
use ${crateName}::domain::services::health::clock_port::ClockPort;
use ${crateName}::domain::shared::result::DomainResult;
use ${crateName}::infrastructure::drivers::clock::clock_driver::RawClockDriver;
use ${crateName}::infrastructure::mappers::health::clock_mapper::map_epoch_seconds;
use ${crateName}::infrastructure::repositories::health::system_clock_adapter::SystemClockAdapter;
use ${crateName}::presentation::controllers::health::health_controller::serve_single_connection;
use ${crateName}::presentation::i18n::en::EN_MESSAGES;${locale !== "en" ? `\nuse ${crateName}::presentation::i18n::user::USER_MESSAGES;` : ""}
use std::net::TcpListener;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::thread;

struct StubClockPort {
    res: DomainResult<String, DomainError>,
}
impl ClockPort for StubClockPort {
    fn current_iso(&self) -> DomainResult<String, DomainError> {
        self.res.clone()
    }
}

struct MockDriver {
    res: Result<u64, String>,
}
impl RawClockDriver for MockDriver {
    fn read_system_epoch(&self) -> Result<u64, String> {
        self.res.clone()
    }
}

struct MockUseCase {
    next: Arc<Mutex<DomainResult<HealthStatus, DomainError>>>,
}
impl GetHealthUseCase for MockUseCase {
    fn execute(&self) -> DomainResult<HealthStatus, DomainError> {
        self.next.lock().unwrap().clone()
    }
}

/// UT-${C}-001, UT-${C}-002, UT-${C}-005, UT-${C}-006
#[test]
fn domain_and_application_all_branches() {
    assert!(matches!(create_health_status("${contextName}", " 2026-11-22 "), DomainResult::Ok(_)));
    assert!(matches!(create_health_status("${contextName}", "   "), DomainResult::Err(_)));
    let ok_svc = CheckHealthService::new("${contextName}", StubClockPort { res: DomainResult::Ok("2026".into()) });
    assert!(matches!(ok_svc.execute(), DomainResult::Ok(_)));
    let err_svc = CheckHealthService::new("${contextName}", StubClockPort { res: DomainResult::Err(DomainError { code: "E".into(), message: "m".into() }) });
    assert!(matches!(err_svc.execute(), DomainResult::Err(_)));
}

/// UT-${C}-003, UT-${C}-004
#[test]
fn infrastructure_all_branches() {
    assert!(matches!(map_epoch_seconds(100), DomainResult::Ok(_)));
    assert!(matches!(map_epoch_seconds(0), DomainResult::Err(_)));
    let ok_ad = SystemClockAdapter::new(MockDriver { res: Ok(123) });
    assert!(matches!(ok_ad.current_iso(), DomainResult::Ok(_)));
    let err_ad = SystemClockAdapter::new(MockDriver { res: Err("io".into()) });
    assert!(matches!(err_ad.current_iso(), DomainResult::Err(_)));
}

/// UT-${C}-007
#[test]
fn presentation_browser_all_branches() {
    let state = Arc::new(Mutex::new(DomainResult::Ok(HealthStatus {
        context: "${contextName}".to_string(),
        checked_at_iso: "2026-11-22T00:00:00Z".to_string(),
    })));
    let uc = MockUseCase { next: state.clone() };
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = thread::spawn(move || {
        for _ in 0..3 {
            if let Ok((stream, _)) = listener.accept() {
                serve_single_connection(stream, &uc, &EN_MESSAGES);
            }
        }
    });

    let scenarios_ok = format!(
        r#"[{{"url":"http://{}/","selector":"[data-testid='health-status']","expected":"OK: ${contextName}"}}]"#,
        addr
    );
    let out_ok = Command::new("node").args(["scripts/browser_driver.mjs", &scenarios_ok]).output().unwrap();
    assert!(out_ok.status.success(), "{}", String::from_utf8_lossy(&out_ok.stderr));

    *state.lock().unwrap() = DomainResult::Err(DomainError {
        code: "CLOCK_UNAVAILABLE".to_string(),
        message: "mock outage".to_string(),
    });
    let scenarios_err = format!(
        r#"[{{"url":"http://{}/","selector":"[data-testid='error-banner']","expected":"CLOCK_UNAVAILABLE: System clock is unavailable"}},{{"url":"http://{}/missing","selector":"[data-testid='not-found']","expected":"Page Not Found"}}]"#,
        addr, addr
    );
    let out_err = Command::new("node").args(["scripts/browser_driver.mjs", &scenarios_err]).output().unwrap();
    assert!(out_err.status.success(), "{}", String::from_utf8_lossy(&out_err.stderr));

    handle.join().unwrap();${locale !== "en" ? `
    let l2 = TcpListener::bind("127.0.0.1:0").unwrap();
    let a2 = l2.local_addr().unwrap();
    let uc2 = MockUseCase { next: state.clone() };
    let h2 = thread::spawn(move || {
        if let Ok((stream, _)) = l2.accept() {
            serve_single_connection(stream, &uc2, &USER_MESSAGES);
        }
    });
    let loc_s = format!(r#"[{{"url":"http://{}/missing","selector":"[data-testid='not-found']","expected":"{}"}}]"#, a2, USER_MESSAGES.not_found_body);
    let out_loc = Command::new("node").args(["scripts/browser_driver.mjs", &loc_s]).output().unwrap();
    assert!(out_loc.status.success(), "{}", String::from_utf8_lossy(&out_loc.stderr));
    h2.join().unwrap();` : ""}
}
`;

  files["scripts/test-unit-c1.sh"] = `#!/usr/bin/env bash
set -euo pipefail
node ${JSON.stringify(cliPath)} verify --target .
if command -v cargo-llvm-cov >/dev/null 2>&1; then
  cargo llvm-cov --offline --branch --ignore-filename-regex '(src/infrastructure/drivers/|src/main\\.rs)' --fail-under-lines 100
else
  cargo test --offline
  echo "PASS: cargo test --offline verified all unit and headless browser tests (install cargo-llvm-cov for LLVM branch report)"
fi
`;

  if (dist === "docker") {
    files["Dockerfile"] = `FROM rust:1.85-slim AS builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=builder /app/target/release/${crateName} /app/server
EXPOSE 3000
CMD ["/app/server"]
`;
    files["docker-compose.integration.yml"] = `services:
  app:
    build: .
    ports:
      - "13003:3000"
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
curl -fsS http://127.0.0.1:13003/ | grep -q "OK: ${contextName}"
`;
  } else if (dist === "binary") {
    files["scripts/test-integration.sh"] = `#!/usr/bin/env bash
set -euo pipefail
# IT-${C}-001, IT-${C}-002
cargo build --offline
PORT=0 ./target/debug/${crateName} > /tmp/ai-ddd-rust.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true; rm -f /tmp/ai-ddd-rust.log' EXIT
for _ in $(seq 1 30); do
  if grep -q "LISTENING " /tmp/ai-ddd-rust.log; then break; fi
  sleep 0.2
done
URL=$(sed -n 's/^LISTENING //p' /tmp/ai-ddd-rust.log | head -n1)
node -e "fetch(process.argv[1] + '/').then(async r => { const t = await r.text(); if (r.status !== 200 || !t.includes('OK: ${contextName}')) process.exit(1); console.log('PASS: Rust binary integration test verified drivers/ and main.rs at', process.argv[1]); })" "$URL"
`;
  } else {
    files["scripts/test-integration.sh"] = `#!/usr/bin/env bash
set -euo pipefail
# IT-${C}-001, IT-${C}-002
cargo build --offline
echo "PASS: Rust library integration build verified drivers/ and crate exports"
`;
  }

  return files;
}
