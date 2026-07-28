const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "..")
const bridgeSource = fs.readFileSync(
  path.join(root, "src", "chatgptBridge.js"),
  "utf8"
)

const context = {}
vm.createContext(context)
vm.runInContext(bridgeSource, context)

assert.ok(context.CardAskGPTBridge, "bridge global should exist")

const payload = {
  id: "note-'\"-中文",
  title: "测试卡片",
  page: "12",
  blocks: [
    { type: "text", kind: "title", text: "事务隔离性" },
    {
      type: "image",
      kind: "excerpt-image",
      dataURL: "data:image/png;base64,aGVsbG8="
    }
  ]
}

const script = context.CardAskGPTBridge.makeInjection(payload, true)

assert.match(script, /cardaskgpt:\/\/status/)
assert.match(script, /input\[type="file"\]/)
assert.match(script, /ClipboardEvent/)
assert.match(script, /temporary chat\|temporary\|临时聊天/)
assert.match(script, /marginnote-card-/)
assert.match(script, /测试卡片/)

new vm.Script(script)

console.log("Bridge structure test passed.")
