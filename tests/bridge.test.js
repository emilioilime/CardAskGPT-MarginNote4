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

const payloads = [
  payload,
  { ...payload, id: "note-2", title: "测试卡片 2", page: "13" },
  { ...payload, id: "note-3", title: "测试卡片 3", page: "14" }
]

const script = context.CardAskGPTBridge.makeInjection(payloads, true)

assert.match(script, /cardaskgpt:\/\/status/)
assert.match(script, /input\[type="file"\]/)
assert.match(script, /ClipboardEvent/)
assert.match(script, /temporary chat\|temporary\|临时聊天/)
assert.match(script, /marginnote-card-/)
assert.match(script, /clearExistingAttachments/)
assert.match(script, /attachmentRemovalButtons/)
assert.match(script, /Remove file|remove\|delete\|clear/)
assert.match(script, /测试卡片/)
assert.match(script, /测试卡片 2/)
assert.match(script, /测试卡片 3/)
assert.doesNotMatch(script, /function paginate/)

new vm.Script(script)

const legacySingleScript = context.CardAskGPTBridge.makeInjection(payload, false)
assert.match(legacySingleScript, /var cards=\[/)
new vm.Script(legacySingleScript)

const emptySelectionScript = context.CardAskGPTBridge.makeInjection([], true)
assert.match(emptySelectionScript, /selection-cleared/)
assert.match(emptySelectionScript, /if\(!cards\.length\)/)
new vm.Script(emptySelectionScript)

console.log("Bridge structure test passed.")
