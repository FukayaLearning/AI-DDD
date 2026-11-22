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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-ddd-ex-rs-data-"));
  const inv = http.createServer((_, res) => { res.writeHead(200, { "Connection": "close" }); res.end("{}"); });
  const pay = http.createServer((_, res) => { res.writeHead(200, { "Connection": "close" }); res.end("{}"); });
  await new Promise((r) => inv.listen(0, "127.0.0.1", r));
  await new Promise((r) => pay.listen(0, "127.0.0.1", r));

  const proc = spawn("./target/debug/ordering_rs", [], {
    env: {
      ...process.env,
      PORT: "0",
      ORDER_DATA_DIR: dataDir,
      INVENTORY_URL: `http://127.0.0.1:${inv.address().port}/reserve`,
      PAYMENT_URL: `http://127.0.0.1:${pay.address().port}/charge`,
    },
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

  try {
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
    console.log("PASS: Rust Ordering binary integration test verified drivers/ and main.rs");
  } finally {
    proc.kill("SIGTERM");
    inv.close();
    pay.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
})();
'
