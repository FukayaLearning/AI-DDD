#!/usr/bin/env bash
set -euo pipefail
openspec schema validate ddd-driven
openspec validate --all --strict
bash scripts/test-unit-c1.sh
bash scripts/test-integration.sh
