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
node "$PROJECT_DIR/tests/card-sync-toggle.test.js"
node "$PROJECT_DIR/tests/panel-visibility.test.js"
node "$PROJECT_DIR/tests/paste-routing.test.js"
node "$PROJECT_DIR/tests/preset-question-mode.test.js"
node "$PROJECT_DIR/tests/session-persistence.test.js"

echo "All checks passed."
