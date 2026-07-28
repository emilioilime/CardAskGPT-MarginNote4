const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const source = fs.readFileSync(
  path.resolve(__dirname, "../src/panel.js"),
  "utf8"
)

assert.match(source, /function desiredChatURL/)
assert.match(source, /https:\/\/chatgpt\.com\/\?temporary-chat=true/)
assert.match(source, /currentIsTemporary !== Boolean/)
assert.match(
  source,
  /toggleTemporary:[\s\S]*?cancelPendingCards\(self\)[\s\S]*?loadChatGPT\(self\)/
)
assert.match(source, /reloadChatGPT:[\s\S]*?loadChatGPT\(self\)/)
assert.doesNotMatch(source, /reloadChatGPT:[\s\S]*?self\.webview\.reload\(\)/)

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

assert.equal(
  context.CardAskGPTPanelAPI.desiredChatURL({
    temporaryChatEnabled: true
  }),
  "https://chatgpt.com/?temporary-chat=true"
)
assert.equal(
  context.CardAskGPTPanelAPI.desiredChatURL({
    temporaryChatEnabled: false
  }),
  "https://chatgpt.com/"
)
assert.equal(
  context.CardAskGPTPanelAPI.isTemporaryURL(
    "https://chatgpt.com/?temporary-chat=true"
  ),
  true
)
assert.equal(
  context.CardAskGPTPanelAPI.isTemporaryURL("https://chatgpt.com/"),
  false
)

console.log("Temporary chat mode structure test passed.")
