#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

node --check "$PROJECT_DIR/src/main.js"
node --check "$PROJECT_DIR/src/panel.js"
node --check "$PROJECT_DIR/src/chatgptBridge.js"
node "$PROJECT_DIR/tests/bridge.test.js"

echo "All checks passed."
