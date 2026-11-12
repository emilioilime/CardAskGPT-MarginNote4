const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const source = fs.readFileSync(path.resolve(__dirname, "../src/panel.js"), "utf8")
const requests = []
const timers = []
const injections = []
let members
const context = {
  JSB: {
    defineClass(name, methods) {
      members = methods
      return { new: () => ({}) }
    }
  },
  NSURL: { URLWithString: (value) => value },
  NSURLRequest: { requestWithURL: (value) => value },
  NSTimer: {
    scheduledTimerWithTimeInterval(interval, repeats, callback) {
      timers.push(callback)
    }
  },
  NSUserDefaults: { standardUserDefaults: () => ({ setObjectForKey() {} }) },
  CardAskGPTBridge: { makeInjection: (cards) => JSON.stringify(cards) }
}
vm.createContext(context)
vm.runInContext(source, context)
const api = context.CardAskGPTPanelAPI

function controller(url, overrides = {}) {
  return {
    view: { hidden: true },
    temporaryChatEnabled: true,
    chatURL: "https://chatgpt.com/?temporary-chat=true",
    webview: {
      hidden: true,
      request: { URL: () => ({ absoluteString: () => url }) },
      loadRequest: (request) => requests.push(request),
      evaluateJavaScript: (script) => injections.push(script)
    },
    ...overrides
  }
}

const cards = [{ id: "fixture-card" }]
// A settled login form can have isLoadingChat=false. Selecting a card must
// preserve it, including federated identity providers, without opening a new URL.
for (const url of [
  "https://auth.openai.com/log-in",
  "https://chatgpt.com/auth/login",
  "https://accounts.google.com/o/oauth2/auth",
  "https://appleid.apple.com/auth/authorize"
]) {
  const panel = controller(url)
  api.enqueueCards(panel, cards)
  api.showPanel(panel)
  assert.equal(requests.length, 0, `card selection interrupted login at ${url}`)
  assert.equal(panel.pendingPayloads, cards)
}
assert.equal(timers.length, 0, "do not inject card scripts on a login page")

// ChatGPT can remove temporary-chat from the URL after navigation. This is not
// evidence that the user changed modes or logged out.
const conversation = controller("https://chatgpt.com/c/fixture")
api.showPanel(conversation)
api.enqueueCards(conversation, cards)
assert.equal(requests.length, 0, "opening the panel reset the current conversation")
timers.shift()()
assert.equal(injections.length, 1)

// Queued callbacks must not inject into an authentication page reached later.
const navigating = controller("https://chatgpt.com/c/fixture")
api.enqueueCards(navigating, cards)
navigating.webview.request.URL = () => ({ absoluteString: () => "https://auth.openai.com/log-in" })
timers.shift()()
assert.equal(injections.length, 1)
assert.equal(navigating.pendingPayloads, cards)

const loading = controller("https://chatgpt.com/", { isLoadingChat: true })
api.enqueueCards(loading, cards)
assert.equal(requests.length, 0)
assert.equal(timers.length, 0)

// An explicitly changed preference or manual refresh may open a new page.
context.self = conversation
members.toggleTemporary()
assert.equal(requests.pop(), "https://chatgpt.com/")
members.reloadChatGPT()
assert.equal(requests.pop(), "https://chatgpt.com/")

const fresh = controller("")
api.showPanel(fresh)
assert.equal(requests.pop(), "https://chatgpt.com/?temporary-chat=true")
assert.equal(fresh.isLoadingChat, true)
api.showPanel(fresh)
assert.equal(requests.length, 0, "repeated show duplicated an in-flight load")

console.log("Login and conversation navigation regression test passed.")
