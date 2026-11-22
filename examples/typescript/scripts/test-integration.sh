#!/usr/bin/env bash
set -euo pipefail
node --experimental-strip-types -e '
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-ddd-ex-ts-data-"));
const invSrv = http.createServer((req, res) => { res.writeHead(200); res.end("{}"); });
const paySrv = http.createServer((req, res) => { res.writeHead(200); res.end("{}"); });
await new Promise((r) => invSrv.listen(0, "127.0.0.1", r));
await new Promise((r) => paySrv.listen(0, "127.0.0.1", r));

const invUrl = `http://127.0.0.1:${invSrv.address().port}/reserve`;
const payUrl = `http://127.0.0.1:${paySrv.address().port}/charge`;

const child = spawn(process.execPath, ["--experimental-strip-types", "src/main.ts"], {
  env: { ...process.env, PORT: "0", ORDER_DATA_DIR: dataDir, INVENTORY_URL: invUrl, PAYMENT_URL: payUrl },
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

try {
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
  console.log("PASS: TypeScript Ordering binary integration test verified drivers/ and main.ts");
} finally {
  child.kill("SIGTERM");
  invSrv.close();
  paySrv.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
'
