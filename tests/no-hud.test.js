const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const root = path.resolve(__dirname, "..")
const mainSource = fs.readFileSync(path.join(root, "src", "main.js"), "utf8")
const panelSource = fs.readFileSync(
  path.join(root, "src", "panel.js"),
  "utf8"
)

assert.doesNotMatch(mainSource, /showHUD/)
assert.doesNotMatch(panelSource, /showHUD/)

console.log("Silent operation test passed.")
