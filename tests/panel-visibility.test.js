const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "..")
const mainSource = fs.readFileSync(path.join(root, "src", "main.js"), "utf8")
const panelSource = fs.readFileSync(
  path.join(root, "src", "panel.js"),
  "utf8"
)

assert.match(
  mainSource,
  /if \(self\.enabled\)[\s\S]*?CardAskGPTPanelAPI\.showPanel\(panel\)/
)
assert.match(
  mainSource,
  /else \{[\s\S]*?CardAskGPTPanelAPI\.hidePanel\(self\.panel\)/
)
assert.doesNotMatch(
  mainSource,
  /var panel = ensurePanelAttached\(self\)[\s\S]{0,100}?panel\.view\.hidden = true/
)
assert.match(panelSource, /function showPanel/)
assert.match(panelSource, /function hidePanel/)
assert.match(panelSource, /showPanel: showPanel/)
assert.match(panelSource, /hidePanel: hidePanel/)

const context = {
  UIColor: {
    colorWithHexString(value) {
      return value
    }
  },
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
vm.runInContext(panelSource, context)

const calls = []
const controller = {
  temporaryChatEnabled: true,
  pendingPayloads: null,
  view: {
    hidden: true,
    window: {
      endEditing() {
        calls.push("windowEndEditing")
      }
    }
  },
  webview: {
    hidden: true,
    request: {
      URL() {
        return {
          absoluteString() {
            return "https://chatgpt.com/?temporary-chat=true"
          }
        }
      }
    },
    evaluateJavaScript() {
      calls.push("cancel")
    },
    endEditing() {
      calls.push("endEditing")
    },
    resignFirstResponder() {
      calls.push("resign")
    }
  }
}

context.CardAskGPTPanelAPI.showPanel(controller)
assert.equal(controller.view.hidden, false)
assert.equal(controller.webview.hidden, false)

context.CardAskGPTPanelAPI.hidePanel(controller)
assert.equal(controller.view.hidden, true)
assert.ok(calls.includes("cancel"))
assert.ok(calls.includes("endEditing"))

console.log("Master plugin visibility test passed.")
