#!/usr/bin/env bash
set -euo pipefail
node ../../bin/ai-ddd.js verify --target .
if ! command -v go >/dev/null 2>&1; then
  echo "ERROR: 'go' toolchain not found in PATH." >&2
  exit 1
fi
go test -v -covermode=atomic -coverprofile=coverage.out ./internal/domain/... ./internal/application/... ./internal/infrastructure/persistence/... ./internal/infrastructure/acl/... ./internal/presentation/...
go tool cover -func=coverage.out
total=$(go tool cover -func=coverage.out | awk '/^total:/ {print $3}')
if [ "$total" != "100.0%" ]; then
  echo "Coverage below 100.0%: $total" >&2
  exit 1
fi
