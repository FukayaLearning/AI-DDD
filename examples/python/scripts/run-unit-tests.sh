#!/usr/bin/env bash
set -euo pipefail
node ../../bin/ai-ddd.js verify --target .
python3 scripts/run_c1_coverage.py
