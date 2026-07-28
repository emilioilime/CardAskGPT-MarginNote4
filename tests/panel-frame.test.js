const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const source = fs.readFileSync(
  path.resolve(__dirname, "../src/panel.js"),
  "utf8"
)

assert.match(source, /new UIPanGestureRecognizer\(self, "handleMove:"\)/)
assert.match(source, /new UIPanGestureRecognizer\(self, "handleResize:"\)/)
assert.match(source, /function savePanelFrame/)
assert.match(source, /CardAskGPT_PanelWidth/)
assert.match(source, /CardAskGPT_PanelHeight/)
assert.match(source, /resizeArc/)
assert.match(source, /gesture\.locationInView\(self\.view\.superview\)/)

const context = {
  JSB: {
    defineClass() {
      return {
        new() {
          return {}
        }
      }
    }
  }
}
vm.createContext(context)
vm.runInContext(source, context)

const bounds = { x: 0, y: 0, width: 1000, height: 800 }
assert.deepEqual(
  JSON.parse(
    JSON.stringify(
      context.CardAskGPTPanelAPI.normalizePanelFrame(
        { x: -100, y: -100, width: 100, height: 100 },
        bounds
      )
    )
  ),
  { x: 8, y: 8, width: 350, height: 280 }
)
assert.deepEqual(
  JSON.parse(
    JSON.stringify(
      context.CardAskGPTPanelAPI.normalizePanelFrame(
        { x: 900, y: 700, width: 500, height: 600 },
        bounds
      )
    )
  ),
  { x: 492, y: 192, width: 500, height: 600 }
)

console.log("Movable and resizable panel structure test passed.")
