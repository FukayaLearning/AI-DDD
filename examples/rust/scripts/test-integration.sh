#!/usr/bin/env bash
set -euo pipefail
cargo build --offline
node -e '
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");

(async () => {
  let invMode = "ok";
  let payMode = "ok";

  const inv = http.createServer((_, res) => {
    if (invMode === "short") { res.writeHead(409, { "Connection": "close" }); res.end("{}"); return; }
    res.writeHead(200, { "Connection": "close" }); res.end("{}");
  });
  const pay = http.createServer((_, res) => {
    if (payMode === "declined") { res.writeHead(402, { "Connection": "close" }); res.end("{}"); return; }
    if (payMode === "slow") { setTimeout(() => { if (!res.writableEnded) { res.writeHead(200, { "Connection": "close" }); res.end("{}"); } }, 600); return; }
    res.writeHead(200, { "Connection": "close" }); res.end("{}");
  });
  await new Promise((r) => inv.listen(0, "127.0.0.1", r));
  await new Promise((r) => pay.listen(0, "127.0.0.1", r));

  const invUrl = `http://127.0.0.1:${inv.address().port}/reserve`;
  const payUrl = `http://127.0.0.1:${pay.address().port}/charge`;

  async function startServer(envExtra = {}) {
    const proc = spawn("./target/debug/ordering_rs", [], {
      env: { ...process.env, PORT: "0", INVENTORY_URL: invUrl, PAYMENT_URL: payUrl, HTTP_TIMEOUT_MS: "150", ...envExtra },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const baseUrl = await new Promise((resolve, reject) => {
      let out = "";
      const timer = setTimeout(() => reject(new Error("Startup timeout: " + out)), 10000);
      proc.stdout.on("data", (d) => {
        out += d.toString();
        const m = out.match(/LISTENING (http:\/\/[^\s]+)/);
        if (m) { clearTimeout(timer); resolve(m[1]); }
      });
      proc.stderr.on("data", (d) => { out += d.toString(); });
    });
    return { proc, baseUrl };
  }

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-ddd-ex-rs-data-"));
  const { proc, baseUrl } = await startServer({ ORDER_DATA_DIR: dataDir });

  try {
    // IT-ORD-001
    const r1 = await fetch(baseUrl + "/orders", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "orderId=ORD-INT-1&customerId=CUST-INT&productId=SKU-1&quantity=2&unitAmount=1500&currency=JPY",
    });
    assert.equal(r1.status, 200);
    const h1 = await r1.text();
    assert.match(h1, /Draft/);
    assert.match(h1, /3000 JPY/);

    const r2 = await fetch(baseUrl + "/orders/ORD-INT-1/confirm", { method: "POST" });
    assert.equal(r2.status, 200);
    assert.match(await r2.text(), /Confirmed/);

    const r3 = await fetch(baseUrl + "/orders/ORD-INT-1/cancel", { method: "POST" });
    assert.equal(r3.status, 200);
    assert.match(await r3.text(), /Cancelled/);
    assert.ok(fs.existsSync(path.join(dataDir, "ORD-INT-1.json")));

    // IT-ORD-003
    const reCnf = await fetch(baseUrl + "/orders/ORD-INT-1/confirm", { method: "POST" });
    assert.equal(reCnf.status, 422);
    assert.match(await reCnf.text(), /INVALID_ORDER_STATE/);

    const reCancel = await fetch(baseUrl + "/orders/ORD-INT-1/cancel", { method: "POST" });
    assert.equal(reCancel.status, 422);
    assert.match(await reCancel.text(), /INVALID_ORDER_STATE/);

    // IT-ORD-002
    const badQty = await fetch(baseUrl + "/orders", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "orderId=ORD-BAD-QTY&customerId=CUST-INT&productId=SKU-1&quantity=0&unitAmount=1500&currency=JPY",
    });
    assert.equal(badQty.status, 422);
    assert.match(await badQty.text(), /INVALID_QUANTITY/);

    // IT-ORD-004, IT-ORD-005, IT-ORD-006
    await fetch(baseUrl + "/orders", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "orderId=ORD-ABN-1&customerId=CUST-INT&productId=SKU-1&quantity=1&unitAmount=500&currency=JPY",
    });
    invMode = "short";
    const sRes = await fetch(baseUrl + "/orders/ORD-ABN-1/confirm", { method: "POST" });
    assert.equal(sRes.status, 422);
    assert.match(await sRes.text(), /INSUFFICIENT_STOCK/);
    invMode = "ok";

    payMode = "declined";
    const dRes = await fetch(baseUrl + "/orders/ORD-ABN-1/confirm", { method: "POST" });
    assert.equal(dRes.status, 422);
    assert.match(await dRes.text(), /PAYMENT_DECLINED/);

    payMode = "slow";
    const tRes = await fetch(baseUrl + "/orders/ORD-ABN-1/confirm", { method: "POST" });
    assert.equal(tRes.status, 422);
    assert.match(await tRes.text(), /EXTERNAL_TIMEOUT/);
    payMode = "ok";

    // IT-ORD-009
    const nfRes = await fetch(baseUrl + "/orders/NO-SUCH");
    assert.equal(nfRes.status, 404);
    assert.match(await nfRes.text(), /ORDER_NOT_FOUND/);

    // IT-ORD-007
    const closedSrv = http.createServer();
    await new Promise((r) => closedSrv.listen(0, "127.0.0.1", r));
    const deadPort = closedSrv.address().port;
    closedSrv.close();
    const uSrv = await startServer({ ORDER_DATA_DIR: dataDir, INVENTORY_URL: `http://127.0.0.1:${deadPort}/reserve` });
    try {
      const uRes = await fetch(uSrv.baseUrl + "/orders/ORD-ABN-1/confirm", { method: "POST" });
      assert.equal(uRes.status, 422);
      assert.match(await uRes.text(), /EXTERNAL_TIMEOUT/);
    } finally {
      uSrv.proc.kill("SIGTERM");
    }

    // IT-ORD-008
    const notADir = path.join(os.tmpdir(), `ai-ddd-ex-rs-file-${Date.now()}`);
    fs.writeFileSync(notADir, "lock");
    const bSrv = await startServer({ ORDER_DATA_DIR: notADir });
    try {
      const bRes = await fetch(bSrv.baseUrl + "/orders", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "orderId=ORD-STORE-FAIL&customerId=CUST-INT&productId=SKU-1&quantity=1&unitAmount=500&currency=JPY",
      });
      assert.equal(bRes.status, 422);
      assert.match(await bRes.text(), /REPOSITORY_ERROR/);
    } finally {
      bSrv.proc.kill("SIGTERM");
      fs.rmSync(notADir, { force: true });
    }

    // IT-ORD-010
    const jaPage = await (await fetch(baseUrl + "/")).text();
    assert.match(jaPage, /<html lang=\x27ja\x27>/);
    assert.match(jaPage, /注文作成/);
    const eSrv = await startServer({ ORDER_DATA_DIR: dataDir, APP_LOCALE: "en" });
    try {
      const enPage = await (await fetch(eSrv.baseUrl + "/")).text();
      assert.match(enPage, /<html lang=\x27en\x27>/);
      assert.match(enPage, /Place Order/);
    } finally {
      eSrv.proc.kill("SIGTERM");
    }

    console.log("PASS: Rust Ordering integration tests (IT-ORD-001..010) verified drivers/ and main.rs");
  } finally {
    proc.kill("SIGTERM");
    inv.close();
    pay.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})();
'
