#!/usr/bin/env bash
set -euo pipefail
openspec schema validate ddd-driven
openspec validate --all --strict
node ../../bin/ai-ddd.js verify --target .
npm run test:unit
npm run test:integration
