#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
from http.server import BaseHTTPRequestHandler, HTTPServer
import json, os, pathlib, re, shutil, subprocess, tempfile, threading, time, urllib.error, urllib.parse, urllib.request

inv_mode = "ok"
pay_mode = "ok"

class InvHandler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_POST(self):
        if inv_mode == "short":
            self.send_response(409); self.end_headers(); self.wfile.write(b"{}"); return
        self.send_response(200); self.end_headers(); self.wfile.write(b"{}")

class PayHandler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_POST(self):
        if pay_mode == "declined":
            self.send_response(402); self.end_headers(); self.wfile.write(b"{}"); return
        if pay_mode == "slow":
            time.sleep(0.5)
        self.send_response(200); self.end_headers(); self.wfile.write(b"{}")

inv = HTTPServer(("127.0.0.1", 0), InvHandler)
pay = HTTPServer(("127.0.0.1", 0), PayHandler)
threading.Thread(target=inv.serve_forever, daemon=True).start()
threading.Thread(target=pay.serve_forever, daemon=True).start()

inv_url = f"http://127.0.0.1:{inv.server_address[1]}/reserve"
pay_url = f"http://127.0.0.1:{pay.server_address[1]}/charge"

def start_server(env_extra=None):
    env = dict(os.environ, PORT="0", INVENTORY_URL=inv_url, PAYMENT_URL=pay_url, HTTP_TIMEOUT_SEC="0.15")
    if env_extra:
        env.update(env_extra)
    proc = subprocess.Popen(["python3", "-m", "src.main"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
    base_url = None
    deadline = time.time() + 10
    while time.time() < deadline:
        line = proc.stdout.readline()
        m = re.search(r"LISTENING (http://\S+)", line)
        if m:
            base_url = m.group(1)
            break
    assert base_url is not None, "Server failed to start"
    return proc, base_url

def http_req(url, method="GET", form=None):
    data = urllib.parse.urlencode(form).encode("utf-8") if form is not None else (b"" if method == "POST" else None)
    req = urllib.request.Request(url, data=data, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")

data_dir = tempfile.mkdtemp(prefix="ai-ddd-ex-py-data-")
proc, base_url = start_server({"ORDER_DATA_DIR": data_dir})
try:
    # IT-ORD-001: Normal lifecycle Draft -> Confirmed -> Cancelled
    st, body = http_req(f"{base_url}/orders", "POST", {
        "orderId": "ORD-INT-1", "customerId": "CUST-INT", "productId": "SKU-1",
        "quantity": "2", "unitAmount": "1500", "currency": "JPY",
    })
    assert st == 200 and "Draft" in body and "3000 JPY" in body
    st, body = http_req(f"{base_url}/orders/ORD-INT-1/confirm", "POST")
    assert st == 200 and "Confirmed" in body
    st, body = http_req(f"{base_url}/orders/ORD-INT-1/cancel", "POST")
    assert st == 200 and "Cancelled" in body
    assert (pathlib.Path(data_dir) / "ORD-INT-1.json").exists()

    # IT-ORD-003: Invalid state transition
    st, body = http_req(f"{base_url}/orders/ORD-INT-1/confirm", "POST")
    assert st == 422 and "INVALID_ORDER_STATE" in body
    st, body = http_req(f"{base_url}/orders/ORD-INT-1/cancel", "POST")
    assert st == 422 and "INVALID_ORDER_STATE" in body

    # IT-ORD-002: Input boundary / invalid quantity
    st, body = http_req(f"{base_url}/orders", "POST", {
        "orderId": "ORD-BAD-QTY", "customerId": "CUST-INT", "productId": "SKU-1",
        "quantity": "0", "unitAmount": "1500", "currency": "JPY",
    })
    assert st == 422 and "INVALID_QUANTITY" in body
    assert not (pathlib.Path(data_dir) / "ORD-BAD-QTY.json").exists()

    # IT-ORD-004: Inventory shortage (409)
    http_req(f"{base_url}/orders", "POST", {
        "orderId": "ORD-ABN-1", "customerId": "CUST-INT", "productId": "SKU-1",
        "quantity": "1", "unitAmount": "500", "currency": "JPY",
    })
    inv_mode = "short"
    st, body = http_req(f"{base_url}/orders/ORD-ABN-1/confirm", "POST")
    assert st == 422 and "INSUFFICIENT_STOCK" in body
    assert json.loads((pathlib.Path(data_dir) / "ORD-ABN-1.json").read_text())["status"] == "Draft"
    inv_mode = "ok"

    # IT-ORD-005: Payment declined (402)
    pay_mode = "declined"
    st, body = http_req(f"{base_url}/orders/ORD-ABN-1/confirm", "POST")
    assert st == 422 and "PAYMENT_DECLINED" in body
    assert json.loads((pathlib.Path(data_dir) / "ORD-ABN-1.json").read_text())["status"] == "Draft"

    # IT-ORD-006: External timeout
    pay_mode = "slow"
    st, body = http_req(f"{base_url}/orders/ORD-ABN-1/confirm", "POST")
    assert st == 422 and "EXTERNAL_TIMEOUT" in body
    pay_mode = "ok"

    # IT-ORD-009: Target not found (404)
    st, body = http_req(f"{base_url}/orders/NO-SUCH", "GET")
    assert st == 404 and "ORDER_NOT_FOUND" in body

    # IT-ORD-007: External service unavailable
    dead_srv = HTTPServer(("127.0.0.1", 0), InvHandler)
    dead_port = dead_srv.server_address[1]
    dead_srv.server_close()
    u_proc, u_url = start_server({"ORDER_DATA_DIR": data_dir, "INVENTORY_URL": f"http://127.0.0.1:{dead_port}/reserve"})
    try:
        st, body = http_req(f"{u_url}/orders/ORD-ABN-1/confirm", "POST")
        assert st == 422 and "EXTERNAL_TIMEOUT" in body
    finally:
        u_proc.terminate(); u_proc.wait(timeout=5)

    # IT-ORD-008: Persistence failure (regular file as ORDER_DATA_DIR)
    fd, bad_path = tempfile.mkstemp(prefix="ai-ddd-ex-py-lock-")
    os.close(fd)
    b_proc, b_url = start_server({"ORDER_DATA_DIR": bad_path})
    try:
        st, body = http_req(f"{b_url}/orders", "POST", {
            "orderId": "ORD-STORE-FAIL", "customerId": "CUST-INT", "productId": "SKU-1",
            "quantity": "1", "unitAmount": "500", "currency": "JPY",
        })
        assert st == 422 and "REPOSITORY_ERROR" in body
    finally:
        b_proc.terminate(); b_proc.wait(timeout=5)
        os.remove(bad_path)

    # IT-ORD-010: Localized Web UI rendering (ja default & APP_LOCALE=en)
    st, ja_body = http_req(f"{base_url}/", "GET")
    assert st == 200 and "<html lang='ja'>" in ja_body and "注文作成" in ja_body
    e_proc, e_url = start_server({"ORDER_DATA_DIR": data_dir, "APP_LOCALE": "en"})
    try:
        st, en_body = http_req(f"{e_url}/", "GET")
        assert st == 200 and "<html lang='en'>" in en_body and "Place Order" in en_body
    finally:
        e_proc.terminate(); e_proc.wait(timeout=5)

    print("PASS: Python Ordering integration tests (IT-ORD-001..010) verified drivers/ and main.py")
finally:
    proc.terminate()
    proc.wait(timeout=5)
    inv.shutdown()
    pay.shutdown()
    shutil.rmtree(data_dir, ignore_errors=True)
PY
