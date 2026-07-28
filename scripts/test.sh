#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

node --check "$PROJECT_DIR/src/main.js"
node --check "$PROJECT_DIR/src/panel.js"
node --check "$PROJECT_DIR/src/chatgptBridge.js"
node "$PROJECT_DIR/tests/bridge.test.js"
node "$PROJECT_DIR/tests/selection.test.js"
node "$PROJECT_DIR/tests/temporary-mode.test.js"
node "$PROJECT_DIR/tests/clipboard.test.js"
node "$PROJECT_DIR/tests/panel-frame.test.js"
node "$PROJECT_DIR/tests/no-hud.test.js"

echo "All checks passed."
