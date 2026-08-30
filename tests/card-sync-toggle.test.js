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

assert.match(mainSource, /CardAskGPT_CardSyncEnabled/)
assert.match(mainSource, /if \(!extension\.cardSyncEnabled\)/)
assert.match(
  mainSource,
  /if \(!extension\.cardSyncEnabled\)[\s\S]*?return/
)
assert.doesNotMatch(
  mainSource,
  /if \(!extension\.cardSyncEnabled\)[\s\S]{0,300}?releaseWebFocus/
)
assert.match(panelSource, /setTitleForState\("同步：开"/)
assert.match(panelSource, /setTitleForState\("同步：停"/)
assert.match(panelSource, /cardSyncButton\.frame = \{[\s\S]*?bounds\.width - 130/)
assert.match(
  panelSource,
  /y: Math\.max\(toolbarHeight \+ 12, bounds\.height - 148\)/
)
assert.match(panelSource, /width: 116,[\s\S]*?height: 44/)
assert.match(panelSource, /cardSyncButton\.layer\.shadowOpacity = 0\.24/)
assert.match(panelSource, /cardSyncButton\.titleLabel\.font = UIFont\.boldSystemFontOfSize\(14\)/)
assert.match(panelSource, /temporaryButton\.frame = \{[\s\S]*?bounds\.width - 142/)
assert.match(panelSource, /function releaseWebFocus/)
assert.match(panelSource, /function focusMarginNoteSelection/)
assert.match(panelSource, /function resignResponderTree/)
assert.match(panelSource, /function setCardSyncEnabled/)
assert.doesNotMatch(panelSource, /webview\.userInteractionEnabled\s*=/)
assert.doesNotMatch(panelSource, /controller\.view\.window\.endEditing\(true\)/)
assert.match(
  panelSource,
  /toggleCardSync:[\s\S]*?CardAskGPT_CardSyncEnabled/
)
assert.match(
  mainSource,
  /if \(!extension\.cardSyncEnabled\)[\s\S]*?focusMarginNoteSelection[\s\S]*?return/
)

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
  cardSyncEnabled: true,
  cardSyncButton: {
    setTitleForState(value) {
      calls.push(["title", value])
    },
    setTitleColorForState(value) {
      calls.push(["color", value])
    }
  },
  webview: {
    evaluateJavaScript(script) {
      calls.push(["cancel", script])
    },
    endEditing() {
      calls.push(["endEditing"])
    },
    resignFirstResponder() {
      calls.push(["resign"])
    }
  }
}

context.CardAskGPTPanelAPI.setCardSyncEnabled(controller, false)
assert.equal(controller.cardSyncEnabled, false)
assert.ok(calls.some((call) => call[0] === "title" && call[1] === "同步：停"))
assert.ok(calls.some((call) => call[0] === "cancel"))
assert.ok(calls.some((call) => call[0] === "endEditing"))
assert.ok(calls.some((call) => call[0] === "resign"))
assert.ok(!calls.some((call) => call[0] === "windowEndEditing"))

context.CardAskGPTPanelAPI.setCardSyncEnabled(controller, true)
assert.equal(controller.cardSyncEnabled, true)
assert.ok(calls.some((call) => call[0] === "title" && call[1] === "同步：开"))

console.log("Card synchronization toggle test passed.")
