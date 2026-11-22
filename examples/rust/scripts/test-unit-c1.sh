#!/usr/bin/env bash
set -euo pipefail
node ../../bin/ai-ddd.js verify --target .
if command -v cargo-llvm-cov >/dev/null 2>&1; then
  cargo llvm-cov --offline --branch --ignore-filename-regex '(src/infrastructure/drivers/|src/main\.rs)' --fail-under-lines 100
else
  cargo test --offline
  echo "PASS: Rust cargo test --offline verified all unit and headless Chromium browser tests"
fi
