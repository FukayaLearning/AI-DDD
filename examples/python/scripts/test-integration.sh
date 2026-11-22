#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
from http.server import BaseHTTPRequestHandler, HTTPServer
import os, pathlib, re, shutil, subprocess, tempfile, threading, time, urllib.parse, urllib.request

class OkHandler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_POST(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"{}")

inv = HTTPServer(("127.0.0.1", 0), OkHandler)
pay = HTTPServer(("127.0.0.1", 0), OkHandler)
threading.Thread(target=inv.serve_forever, daemon=True).start()
threading.Thread(target=pay.serve_forever, daemon=True).start()

data_dir = tempfile.mkdtemp(prefix="ai-ddd-ex-py-data-")
env = dict(
    os.environ,
    PORT="0",
    ORDER_DATA_DIR=data_dir,
    INVENTORY_URL=f"http://127.0.0.1:{inv.server_address[1]}/reserve",
    PAYMENT_URL=f"http://127.0.0.1:{pay.server_address[1]}/charge",
)
proc = subprocess.Popen(["python3", "-m", "src.main"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
try:
    base_url = None
    deadline = time.time() + 10
    while time.time() < deadline:
        line = proc.stdout.readline()
        m = re.search(r"LISTENING (http://\S+)", line)
        if m:
            base_url = m.group(1)
            break
    assert base_url is not None, "Server failed to start"

    form = urllib.parse.urlencode({
        "orderId": "ORD-INT-1",
        "customerId": "CUST-INT",
        "productId": "SKU-1",
        "quantity": "2",
        "unitAmount": "1500",
        "currency": "JPY",
    }).encode("utf-8")
    with urllib.request.urlopen(urllib.request.Request(f"{base_url}/orders", data=form, method="POST")) as r:
        assert r.status == 200
        body = r.read().decode("utf-8")
        assert "Draft" in body and "3000 JPY" in body

    with urllib.request.urlopen(urllib.request.Request(f"{base_url}/orders/ORD-INT-1/confirm", data=b"", method="POST")) as r:
        assert r.status == 200
        assert "Confirmed" in r.read().decode("utf-8")

    with urllib.request.urlopen(urllib.request.Request(f"{base_url}/orders/ORD-INT-1/cancel", data=b"", method="POST")) as r:
        assert r.status == 200
        assert "Cancelled" in r.read().decode("utf-8")

    assert (pathlib.Path(data_dir) / "ORD-INT-1.json").exists()
    print("PASS: Python Ordering binary integration test verified drivers/ and main.py")
finally:
    proc.terminate()
    proc.wait(timeout=5)
    inv.shutdown()
    pay.shutdown()
    shutil.rmtree(data_dir, ignore_errors=True)
PY
