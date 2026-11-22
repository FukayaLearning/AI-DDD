import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

export function findChromiumExecutable() {
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
  throw new Error("Headless Chromium binary not found.");
}

export async function launchHeadlessBrowser() {
  const exe = findChromiumExecutable();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-ddd-ex-ts-chrome-"));
  const proc = spawn(
    exe,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );

  const wsUrl = await new Promise((resolve, reject) => {
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`Timed out launching Chromium: ${stderr}`)), 15000);
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      const m = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    proc.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Chromium exited prematurely (${code}): ${stderr}`));
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
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout on ${method}`));
      }, 10000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify(payload));
    });
  }

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);

  function waitForLoad() {
    return new Promise((resolve, reject) => {
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
  }

  return {
    async goto(url) {
      const loaded = waitForLoad();
      await send("Page.navigate", { url }, sessionId);
      await loaded;
    },
    async fill(selector, value) {
      await send(
        "Runtime.evaluate",
        {
          expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; })()`,
          returnByValue: true,
        },
        sessionId
      );
    },
    async clickAndWait(selector) {
      const loaded = waitForLoad();
      await send(
        "Runtime.evaluate",
        {
          expression: `(() => { document.querySelector(${JSON.stringify(selector)}).click(); })()`,
          returnByValue: true,
        },
        sessionId
      );
      await loaded;
    },
    async isDisabled(selector) {
      const res = await send(
        "Runtime.evaluate",
        {
          expression: `(() => Boolean(document.querySelector(${JSON.stringify(selector)})?.disabled))()`,
          returnByValue: true,
        },
        sessionId
      );
      return Boolean(res.result?.value);
    },
    async textContent(selector) {
      const res = await send(
        "Runtime.evaluate",
        {
          expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.textContent : null; })()`,
          returnByValue: true,
        },
        sessionId
      );
      return res.result?.value ?? null;
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
      try { fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch {}
    },
  };
}
