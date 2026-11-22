#!/usr/bin/env bash
set -euo pipefail
openspec schema validate ddd-driven
openspec validate --all --strict
node ../../bin/ai-ddd.js verify --target .
if command -v go >/dev/null 2>&1; then
  bash scripts/test-unit-c1.sh
  bash scripts/test-integration.sh
else
  echo "INFO: 'go' compiler is not installed in this environment; OpenSpec and static DDD governance checks passed."
fi
