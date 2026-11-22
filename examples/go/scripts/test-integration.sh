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

# Launch lightweight stub HTTP services and run real binary flow via Node fetch helper
node -e '
const http = require("node:http");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
(async () => {
  const inv = http.createServer((_, r) => { r.writeHead(200); r.end("{}"); });
  const pay = http.createServer((_, r) => { r.writeHead(200); r.end("{}"); });
  await new Promise(res => inv.listen(0, "127.0.0.1", res));
  await new Promise(res => pay.listen(0, "127.0.0.1", res));
  const p = spawn("/tmp/ordering-go-server", [], {
    env: {
      ...process.env,
      PORT: "0",
      ORDER_DATA_DIR: process.argv[1],
      INVENTORY_URL: `http://127.0.0.1:${inv.address().port}/reserve`,
      PAYMENT_URL: `http://127.0.0.1:${pay.address().port}/charge`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const url = await new Promise((res, rej) => {
    let out = "";
    const t = setTimeout(() => rej(new Error("timeout: " + out)), 10000);
    p.stdout.on("data", d => { out += d; const m = out.match(/LISTENING (http:\/\/[^\s]+)/); if (m) { clearTimeout(t); res(m[1]); } });
  });
  try {
    const r1 = await fetch(url + "/orders", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "orderId=ORD-INT-1&customerId=C1&productId=P1&quantity=2&unitAmount=1500&currency=JPY" });
    assert.equal(r1.status, 200);
    assert.match(await r1.text(), /Draft/);
    const r2 = await fetch(url + "/orders/ORD-INT-1/confirm", { method: "POST" });
    assert.equal(r2.status, 200);
    assert.match(await r2.text(), /Confirmed/);
    const r3 = await fetch(url + "/orders/ORD-INT-1/cancel", { method: "POST" });
    assert.equal(r3.status, 200);
    assert.match(await r3.text(), /Cancelled/);
    console.log("PASS: Go Ordering binary integration test verified drivers/ and cmd/server/main.go");
  } finally {
    p.kill("SIGTERM");
    inv.close();
    pay.close();
  }
})();
' "$DATA_DIR"
