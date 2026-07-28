#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SOURCE_DIR="$PROJECT_DIR/src"
OUTPUT_DIR="$PROJECT_DIR/dist"
OUTPUT_FILE="$OUTPUT_DIR/CardAskGPT.mnaddon"
STAGE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/cardaskgpt-build.XXXXXX")

cleanup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT INT TERM

node --check "$SOURCE_DIR/main.js"
node --check "$SOURCE_DIR/panel.js"
node --check "$SOURCE_DIR/chatgptBridge.js"

mkdir -p "$OUTPUT_DIR"
cp "$SOURCE_DIR/main.js" "$STAGE_DIR/main.js"
cp "$SOURCE_DIR/panel.js" "$STAGE_DIR/panel.js"
cp "$SOURCE_DIR/chatgptBridge.js" "$STAGE_DIR/chatgptBridge.js"
cp "$SOURCE_DIR/mnaddon.json" "$STAGE_DIR/mnaddon.json"
cp "$SOURCE_DIR/icon.png" "$STAGE_DIR/icon.png"
cp "$PROJECT_DIR/README.md" "$STAGE_DIR/README.md"

rm -f "$OUTPUT_FILE"
(
  cd "$STAGE_DIR"
  zip -q -r "$OUTPUT_FILE" .
)

echo "$OUTPUT_FILE"
