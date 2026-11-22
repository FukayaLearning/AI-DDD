#!/usr/bin/env bash
set -euo pipefail
openspec schema validate ddd-driven
openspec validate --all --strict
bash scripts/run-unit-tests.sh
bash scripts/test-integration.sh
