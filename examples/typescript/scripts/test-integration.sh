#!/usr/bin/env bash
set -euo pipefail
node --experimental-strip-types -e '
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

let invMode = "ok";
let payMode = "ok";

const invSrv = http.createServer((req, res) => {
  if (invMode === "short") { res.writeHead(409); res.end("{}"); return; }
  res.writeHead(200); res.end("{}");
});
const paySrv = http.createServer((req, res) => {
  if (payMode === "declined") { res.writeHead(402); res.end("{}"); return; }
  if (payMode === "slow") { setTimeout(() => { if (!res.writableEnded) { res.writeHead(200); res.end("{}"); } }, 600); return; }
  res.writeHead(200); res.end("{}");
});
await new Promise((r) => invSrv.listen(0, "127.0.0.1", r));
await new Promise((r) => paySrv.listen(0, "127.0.0.1", r));

const invUrl = `http://127.0.0.1:${invSrv.address().port}/reserve`;
const payUrl = `http://127.0.0.1:${paySrv.address().port}/charge`;

async function startServer(envExtra = {}) {
  const child = spawn(process.execPath, ["--experimental-strip-types", "src/main.ts"], {
    env: { ...process.env, PORT: "0", INVENTORY_URL: invUrl, PAYMENT_URL: payUrl, HTTP_TIMEOUT_MS: "150", ...envExtra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const baseUrl = await new Promise((resolve, reject) => {
    let out = "";
    const timer = setTimeout(() => reject(new Error("Startup timeout: " + out)), 10000);
    child.stdout.on("data", (d) => {
      out += d.toString();
      const m = out.match(/LISTENING (http:\/\/[^\s]+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    child.stderr.on("data", (d) => { out += d.toString(); });
  });
  return { child, baseUrl };
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-ddd-ex-ts-data-"));
const { child, baseUrl } = await startServer({ ORDER_DATA_DIR: dataDir });

try {
  // IT-ORD-001: Normal lifecycle Draft -> Confirmed -> Cancelled
  const createRes = await fetch(baseUrl + "/orders", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "orderId=ORD-INT-1&customerId=CUST-INT&productId=SKU-1&quantity=2&unitAmount=1500&currency=JPY",
  });
  assert.equal(createRes.status, 200);
  const createHtml = await createRes.text();
  assert.match(createHtml, /Draft/);
  assert.match(createHtml, /3000 JPY/);

  const confirmRes = await fetch(baseUrl + "/orders/ORD-INT-1/confirm", { method: "POST" });
  assert.equal(confirmRes.status, 200);
  assert.match(await confirmRes.text(), /Confirmed/);

  const cancelRes = await fetch(baseUrl + "/orders/ORD-INT-1/cancel", { method: "POST" });
  assert.equal(cancelRes.status, 200);
  assert.match(await cancelRes.text(), /Cancelled/);
  assert.ok(fs.existsSync(path.join(dataDir, "ORD-INT-1.json")));

  // IT-ORD-003: Invalid state transition on Cancelled order
  const reConfirm = await fetch(baseUrl + "/orders/ORD-INT-1/confirm", { method: "POST" });
  assert.equal(reConfirm.status, 422);
  assert.match(await reConfirm.text(), /INVALID_ORDER_STATE/);

  const reCancel = await fetch(baseUrl + "/orders/ORD-INT-1/cancel", { method: "POST" });
  assert.equal(reCancel.status, 422);
  assert.match(await reCancel.text(), /INVALID_ORDER_STATE/);

  // IT-ORD-002: Input boundary / invalid value
  const badQty = await fetch(baseUrl + "/orders", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "orderId=ORD-BAD-QTY&customerId=CUST-INT&productId=SKU-1&quantity=0&unitAmount=1500&currency=JPY",
  });
  assert.equal(badQty.status, 422);
  assert.match(await badQty.text(), /INVALID_QUANTITY/);
  assert.equal(fs.existsSync(path.join(dataDir, "ORD-BAD-QTY.json")), false);

  // IT-ORD-004: Inventory shortage (409) keeps Draft
  await fetch(baseUrl + "/orders", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "orderId=ORD-ABN-1&customerId=CUST-INT&productId=SKU-1&quantity=1&unitAmount=500&currency=JPY",
  });
  invMode = "short";
  const shortRes = await fetch(baseUrl + "/orders/ORD-ABN-1/confirm", { method: "POST" });
  assert.equal(shortRes.status, 422);
  assert.match(await shortRes.text(), /INSUFFICIENT_STOCK/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, "ORD-ABN-1.json"), "utf8")).status, "Draft");
  invMode = "ok";

  // IT-ORD-005: Payment declined (402) keeps Draft
  payMode = "declined";
  const declRes = await fetch(baseUrl + "/orders/ORD-ABN-1/confirm", { method: "POST" });
  assert.equal(declRes.status, 422);
  assert.match(await declRes.text(), /PAYMENT_DECLINED/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, "ORD-ABN-1.json"), "utf8")).status, "Draft");

  // IT-ORD-006: External timeout keeps Draft
  payMode = "slow";
  const toRes = await fetch(baseUrl + "/orders/ORD-ABN-1/confirm", { method: "POST" });
  assert.equal(toRes.status, 422);
  assert.match(await toRes.text(), /EXTERNAL_TIMEOUT/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, "ORD-ABN-1.json"), "utf8")).status, "Draft");
  payMode = "ok";

  // IT-ORD-009: Target not found (404)
  const nfRes = await fetch(baseUrl + "/orders/NO-SUCH");
  assert.equal(nfRes.status, 404);
  assert.match(await nfRes.text(), /ORDER_NOT_FOUND/);

  // IT-ORD-007: External service unavailable (unreachable port)
  const closedPortSrv = http.createServer();
  await new Promise((r) => closedPortSrv.listen(0, "127.0.0.1", r));
  const deadPort = closedPortSrv.address().port;
  closedPortSrv.close();
  const unavailSrv = await startServer({
    ORDER_DATA_DIR: dataDir,
    INVENTORY_URL: `http://127.0.0.1:${deadPort}/reserve`,
  });
  try {
    const unavailRes = await fetch(unavailSrv.baseUrl + "/orders/ORD-ABN-1/confirm", { method: "POST" });
    assert.equal(unavailRes.status, 422);
    assert.match(await unavailRes.text(), /EXTERNAL_TIMEOUT/);
  } finally {
    unavailSrv.child.kill("SIGTERM");
  }

  // IT-ORD-008: Persistence failure (ORDER_DATA_DIR points to regular file)
  const notADir = path.join(os.tmpdir(), `ai-ddd-ex-ts-file-${Date.now()}`);
  fs.writeFileSync(notADir, "lock");
  const badStoreSrv = await startServer({ ORDER_DATA_DIR: notADir });
  try {
    const storeFailRes = await fetch(badStoreSrv.baseUrl + "/orders", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "orderId=ORD-STORE-FAIL&customerId=CUST-INT&productId=SKU-1&quantity=1&unitAmount=500&currency=JPY",
    });
    assert.equal(storeFailRes.status, 422);
    assert.match(await storeFailRes.text(), /REPOSITORY_ERROR/);
  } finally {
    badStoreSrv.child.kill("SIGTERM");
    fs.rmSync(notADir, { force: true });
  }

  // IT-ORD-010: Localized Web UI rendering (ja default & APP_LOCALE=en)
  const jaPage = await (await fetch(baseUrl + "/")).text();
  assert.match(jaPage, /<html lang="ja">/);
  assert.match(jaPage, /注文作成/);

  const enSrv = await startServer({ ORDER_DATA_DIR: dataDir, APP_LOCALE: "en" });
  try {
    const enPage = await (await fetch(enSrv.baseUrl + "/")).text();
    assert.match(enPage, /<html lang="en">/);
    assert.match(enPage, /Place Order/);
  } finally {
    enSrv.child.kill("SIGTERM");
  }

  console.log("PASS: TypeScript Ordering integration tests (IT-ORD-001..010) verified drivers/ and main.ts");
} finally {
  child.kill("SIGTERM");
  invSrv.close();
  paySrv.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
'
