import fs from "node:fs";
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

const actions = JSON.parse(process.argv[2]);
const exe = findChromium();
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "ai-ddd-ex-rs-chrome-"));
const proc = spawn(exe, ["--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-debugging-port=0", `--user-data-dir=${userData}`, "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let err = "";
  const t = setTimeout(() => reject(new Error("Chrome timeout: " + err)), 15000);
  proc.stderr.on("data", (d) => {
    err += d.toString();
    const m = err.match(/DevTools listening on (ws:\/\/[^\s]+)/);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
  proc.once("exit", (code) => {
    clearTimeout(t);
    reject(new Error(`Chrome exited prematurely (${code}): ${err}`));
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
    const timer = setTimeout(() => { pend.delete(id); reject(new Error(`CDP timeout on ${method}`)); }, 10000);
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
  const waitLoad = () => new Promise((r, j) => {
    const t = setTimeout(() => { ws.removeEventListener("message", h); j(new Error("Page.loadEventFired timeout")); }, 10000);
    const h = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.sessionId === sessionId && m.method === "Page.loadEventFired") { clearTimeout(t); ws.removeEventListener("message", h); r(); }
    };
    ws.addEventListener("message", h);
  });
  for (const act of actions) {
    if (act.type === "goto") {
      const loaded = waitLoad();
      await send("Page.navigate", { url: act.url }, sessionId);
      await loaded;
    } else if (act.type === "fill") {
      await send("Runtime.evaluate", { expression: `(() => { document.querySelector(${JSON.stringify(act.selector)}).value = ${JSON.stringify(act.value)}; })()`, returnByValue: true }, sessionId);
    } else if (act.type === "click") {
      const loaded = waitLoad();
      await send("Runtime.evaluate", { expression: `(() => { document.querySelector(${JSON.stringify(act.selector)}).click(); })()`, returnByValue: true }, sessionId);
      await loaded;
    } else if (act.type === "assertText") {
      const res = await send("Runtime.evaluate", { expression: `document.querySelector(${JSON.stringify(act.selector)})?.textContent ?? null`, returnByValue: true }, sessionId);
      assert.equal(res.result?.value ?? null, act.expected);
    } else if (act.type === "assertDisabled") {
      const res = await send("Runtime.evaluate", { expression: `Boolean(document.querySelector(${JSON.stringify(act.selector)})?.disabled)`, returnByValue: true }, sessionId);
      assert.equal(Boolean(res.result?.value), act.expected);
    }
  }
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  try { ws.close(); } catch {}
  if (proc.exitCode === null) {
    proc.kill("SIGKILL");
    await Promise.race([new Promise((r) => proc.once("exit", r)), new Promise((r) => setTimeout(r, 500))]);
  }
  try { fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch {}
  process.exit(exitCode);
}
