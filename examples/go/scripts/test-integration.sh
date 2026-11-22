#!/usr/bin/env bash
set -euo pipefail
go build -o /tmp/ordering-go-server ./cmd/server
DATA_DIR=$(mktemp -d)
INV_PID=""
PAY_PID=""
cleanup() {
  kill ${SRV_PID:-0} ${INV_PID:-0} ${PAY_PID:-0} 2>/dev/null || true
  rm -rf "$DATA_DIR" /tmp/ordering-go-server /tmp/ordering-go.log
}
trap cleanup EXIT

# IT-ORD-001, IT-ORD-002, IT-ORD-003, IT-ORD-004, IT-ORD-005, IT-ORD-006, IT-ORD-007, IT-ORD-008, IT-ORD-009, IT-ORD-010
# Launch lightweight stub HTTP services and run real binary flow via Node fetch helper
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

  const inv = http.createServer((_, r) => {
    if (invMode === "short") { r.writeHead(409); r.end("{}"); return; }
    r.writeHead(200); r.end("{}");
  });
  const pay = http.createServer((_, r) => {
    if (payMode === "declined") { r.writeHead(402); r.end("{}"); return; }
    if (payMode === "slow") { setTimeout(() => { if (!r.writableEnded) { r.writeHead(200); r.end("{}"); } }, 600); return; }
    r.writeHead(200); r.end("{}");
  });
  await new Promise((res) => inv.listen(0, "127.0.0.1", res));
  await new Promise((res) => pay.listen(0, "127.0.0.1", res));

  const invUrl = `http://127.0.0.1:${inv.address().port}/reserve`;
  const payUrl = `http://127.0.0.1:${pay.address().port}/charge`;

  async function startServer(envExtra = {}) {
    const p = spawn("/tmp/ordering-go-server", [], {
      env: {
        ...process.env,
        PORT: "0",
        HTTP_TIMEOUT_MS: "150",
        INVENTORY_URL: invUrl,
        PAYMENT_URL: payUrl,
        ...envExtra,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const url = await new Promise((res, rej) => {
      let out = "";
      const t = setTimeout(() => rej(new Error("timeout: " + out)), 10000);
      p.stdout.on("data", (d) => { out += d; const m = out.match(/LISTENING (http:\/\/[^\s]+)/); if (m) { clearTimeout(t); res(m[1]); } });
      p.stderr.on("data", (d) => { out += d; });
    });
    return { p, url };
  }

  const dataDir = process.argv[1];
  const { p, url } = await startServer({ ORDER_DATA_DIR: dataDir });

  try {
    // IT-ORD-001: Normal lifecycle Draft -> Confirmed -> Cancelled
    const r1 = await fetch(url + "/orders", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "orderId=ORD-INT-1&customerId=C1&productId=P1&quantity=2&unitAmount=1500&currency=JPY" });
    assert.equal(r1.status, 200);
    assert.match(await r1.text(), /Draft/);
    const r2 = await fetch(url + "/orders/ORD-INT-1/confirm", { method: "POST" });
    assert.equal(r2.status, 200);
    assert.match(await r2.text(), /Confirmed/);
    const r3 = await fetch(url + "/orders/ORD-INT-1/cancel", { method: "POST" });
    assert.equal(r3.status, 200);
    assert.match(await r3.text(), /Cancelled/);
    assert.ok(fs.existsSync(path.join(dataDir, "ORD-INT-1.json")));

    // IT-ORD-003: Invalid state transition on Cancelled order
    const reConfirm = await fetch(url + "/orders/ORD-INT-1/confirm", { method: "POST" });
    assert.equal(reConfirm.status, 422);
    assert.match(await reConfirm.text(), /INVALID_ORDER_STATE/);
    const reCancel = await fetch(url + "/orders/ORD-INT-1/cancel", { method: "POST" });
    assert.equal(reCancel.status, 422);
    assert.match(await reCancel.text(), /INVALID_ORDER_STATE/);

    // IT-ORD-002: Input boundary / invalid quantity
    const badQty = await fetch(url + "/orders", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "orderId=ORD-BAD-QTY&customerId=C1&productId=P1&quantity=0&unitAmount=1500&currency=JPY" });
    assert.equal(badQty.status, 422);
    assert.match(await badQty.text(), /INVALID_QUANTITY/);
    assert.equal(fs.existsSync(path.join(dataDir, "ORD-BAD-QTY.json")), false);

    // IT-ORD-004: Inventory shortage (409) keeps Draft
    await fetch(url + "/orders", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "orderId=ORD-ABN-1&customerId=C1&productId=P1&quantity=1&unitAmount=500&currency=JPY" });
    invMode = "short";
    const shortRes = await fetch(url + "/orders/ORD-ABN-1/confirm", { method: "POST" });
    assert.equal(shortRes.status, 422);
    assert.match(await shortRes.text(), /INSUFFICIENT_STOCK/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, "ORD-ABN-1.json"), "utf8")).status, "Draft");
    invMode = "ok";

    // IT-ORD-005: Payment declined (402) keeps Draft
    payMode = "declined";
    const declRes = await fetch(url + "/orders/ORD-ABN-1/confirm", { method: "POST" });
    assert.equal(declRes.status, 422);
    assert.match(await declRes.text(), /PAYMENT_DECLINED/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, "ORD-ABN-1.json"), "utf8")).status, "Draft");

    // IT-ORD-006: External timeout keeps Draft
    payMode = "slow";
    const toRes = await fetch(url + "/orders/ORD-ABN-1/confirm", { method: "POST" });
    assert.equal(toRes.status, 422);
    assert.match(await toRes.text(), /EXTERNAL_TIMEOUT/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, "ORD-ABN-1.json"), "utf8")).status, "Draft");
    payMode = "ok";

    // IT-ORD-009: Target not found (404)
    const nfRes = await fetch(url + "/orders/NO-SUCH");
    assert.equal(nfRes.status, 404);
    assert.match(await nfRes.text(), /ORDER_NOT_FOUND/);

    // IT-ORD-007: External service unavailable (unreachable port)
    const closedSrv = http.createServer();
    await new Promise((res) => closedSrv.listen(0, "127.0.0.1", res));
    const deadPort = closedSrv.address().port;
    closedSrv.close();
    const uSrv = await startServer({ ORDER_DATA_DIR: dataDir, INVENTORY_URL: `http://127.0.0.1:${deadPort}/reserve` });
    try {
      const uRes = await fetch(uSrv.url + "/orders/ORD-ABN-1/confirm", { method: "POST" });
      assert.equal(uRes.status, 422);
      assert.match(await uRes.text(), /EXTERNAL_TIMEOUT/);
    } finally {
      uSrv.p.kill("SIGTERM");
    }

    // IT-ORD-008: Persistence failure (ORDER_DATA_DIR points to regular file)
    const notADir = path.join(os.tmpdir(), `ai-ddd-ex-go-file-${Date.now()}`);
    fs.writeFileSync(notADir, "lock");
    const bSrv = await startServer({ ORDER_DATA_DIR: notADir });
    try {
      const bRes = await fetch(bSrv.url + "/orders", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "orderId=ORD-STORE-FAIL&customerId=C1&productId=P1&quantity=1&unitAmount=500&currency=JPY" });
      assert.equal(bRes.status, 422);
      assert.match(await bRes.text(), /REPOSITORY_ERROR/);
    } finally {
      bSrv.p.kill("SIGTERM");
      fs.rmSync(notADir, { force: true });
    }

    // IT-ORD-010: Localized Web UI rendering (ja default & APP_LOCALE=en)
    const jaPage = await (await fetch(url + "/")).text();
    assert.match(jaPage, /<html lang=\x27ja\x27>/);
    assert.match(jaPage, /注文作成/);
    const eSrv = await startServer({ ORDER_DATA_DIR: dataDir, APP_LOCALE: "en" });
    try {
      const enPage = await (await fetch(eSrv.url + "/")).text();
      assert.match(enPage, /<html lang=\x27en\x27>/);
      assert.match(enPage, /Place Order/);
    } finally {
      eSrv.p.kill("SIGTERM");
    }

    console.log("PASS: Go Ordering integration tests (IT-ORD-001..010) verified drivers/ and cmd/server/main.go");
  } finally {
    p.kill("SIGTERM");
    inv.close();
    pay.close();
  }
})();
' "$DATA_DIR"
