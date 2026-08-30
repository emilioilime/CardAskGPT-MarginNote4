const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "..")
const bridgeSource = fs.readFileSync(
  path.join(root, "src", "chatgptBridge.js"),
  "utf8"
)
const panelSource = fs.readFileSync(
  path.join(root, "src", "panel.js"),
  "utf8"
)
const mainSource = fs.readFileSync(path.join(root, "src", "main.js"), "utf8")

const bridgeContext = {}
vm.createContext(bridgeContext)
vm.runInContext(bridgeSource, bridgeContext)

const payloads = [
  {
    id: "preset-card-1",
    title: "原子性",
    blocks: [{ type: "text", kind: "title", text: "原子性" }]
  },
  {
    id: "preset-card-2",
    title: "一致性",
    blocks: [{ type: "text", kind: "title", text: "一致性" }]
  }
]
const prompt = "请比较这两张卡片，并给出一个例子。"
const manualScript = bridgeContext.CardAskGPTBridge.makeInjection(
  payloads,
  false,
  { mode: "question", prompt, autoSend: false }
)
const automaticScript = bridgeContext.CardAskGPTBridge.makeInjection(
  payloads,
  false,
  { mode: "question", prompt, autoSend: true }
)
const imageOnlyScript = bridgeContext.CardAskGPTBridge.makeInjection(
  payloads,
  false,
  { mode: "image", prompt, autoSend: true }
)

assert.match(manualScript, /var questionMode=true/)
assert.match(manualScript, /var autoSend=false/)
assert.match(manualScript, /请比较这两张卡片，并给出一个例子。/)
assert.match(manualScript, /setComposerText\(target,presetPrompt\)/)
assert.match(manualScript, /notify\(questionMode\?'prepared':'uploaded'/)
assert.match(automaticScript, /var autoSend=true/)
assert.match(automaticScript, /waitForSendReady/)
assert.match(automaticScript, /submit\.click\(\)/)
assert.match(automaticScript, /notify\('sent'/)
assert.match(imageOnlyScript, /var questionMode=false/)
assert.match(imageOnlyScript, /var presetPrompt=""/)
assert.match(imageOnlyScript, /var autoSend=false/)
assert.match(imageOnlyScript, /clearManagedPrompt/)
assert.match(imageOnlyScript, /if\(!cards\.length\)[\s\S]*clearManagedPrompt/)
new vm.Script(manualScript)
new vm.Script(automaticScript)
new vm.Script(imageOnlyScript)

assert.match(mainSource, /CardAskGPT_QuestionModeEnabled/)
assert.match(mainSource, /CardAskGPT_PresetPrompt/)
assert.match(mainSource, /CardAskGPT_AutoSendEnabled/)
assert.match(
  mainSource,
  /DEFAULT_PRESET_PROMPT = "请根据图片中的卡片内容进行讲解。"/
)
assert.match(mainSource, /CardAskGPTPanelAPI\.setQuestionSettings/)
assert.match(panelSource, /setTitleForState\("模式：预设提问"/)
assert.match(panelSource, /setTitleForState\("模式：仅图片"/)
assert.match(panelSource, /controller\.autoSendEnabled \? "提问：自动发送" : "提问：手动发送"/)
assert.match(panelSource, /function setQuestionSettings/)
assert.match(panelSource, /editPresetPrompt:/)
assert.match(panelSource, /toggleDraftAutoSend:/)
assert.match(panelSource, /savePromptEditor:/)
assert.match(panelSource, /UITextView\.new\(\)/)
assert.doesNotMatch(panelSource, /new UITextView/)
assert.match(
  panelSource,
  /mode: controller\.questionModeEnabled \? "question" : "image"/
)

const panelContext = {
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
vm.createContext(panelContext)
vm.runInContext(panelSource, panelContext)

const calls = []
const controller = {
  questionModeButton: {
    setTitleForState(value) {
      calls.push(["mode", value])
    },
    setTitleColorForState() {}
  },
  questionSettingsButton: {
    setTitleForState(value) {
      calls.push(["send", value])
    },
    setTitleColorForState() {},
    hidden: false
  }
}
panelContext.CardAskGPTPanelAPI.setQuestionSettings(
  controller,
  true,
  prompt,
  true
)
assert.equal(controller.questionModeEnabled, true)
assert.equal(controller.presetPrompt, prompt)
assert.equal(controller.autoSendEnabled, true)
assert.ok(calls.some((call) => call[1] === "模式：预设提问"))
assert.ok(calls.some((call) => call[1] === "提问：自动发送"))

panelContext.CardAskGPTPanelAPI.setQuestionSettings(
  controller,
  false,
  "",
  false
)
assert.equal(controller.questionModeEnabled, false)
assert.equal(controller.presetPrompt, "请根据图片中的卡片内容进行讲解。")
assert.equal(controller.autoSendEnabled, false)
assert.equal(controller.questionSettingsButton.hidden, true)

console.log("Preset question mode test passed.")
