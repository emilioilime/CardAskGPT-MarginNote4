const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

async function run() {
  const root = path.resolve(__dirname, "..")
  const bridgeSource = fs.readFileSync(
    path.join(root, "src", "chatgptBridge.js"),
    "utf8"
  )
  const panelSource = fs.readFileSync(
    path.join(root, "src", "panel.js"),
    "utf8"
  )

  const bridgeContext = {}
  vm.createContext(bridgeContext)
  vm.runInContext(bridgeSource, bridgeContext)

  assert.equal(
    typeof bridgeContext.CardAskGPTBridge.makeClipboardBridge,
    "function"
  )

  const script = bridgeContext.CardAskGPTBridge.makeClipboardBridge()
  assert.match(script, /cardaskgpt:\/\/clipboard/)
  assert.match(script, /addEventListener\('copy'/)
  assert.match(script, /navigator\.clipboard/)
  assert.match(script, /clipboard\.writeText/)
  assert.match(script, /clipboard\.write/)
  assert.match(script, /text\/html/)
  assert.match(script, /text\/markdown/)
  assert.match(script, /__mnCardAskGPTClipboardPayload/)
  assert.doesNotMatch(script, /preventDefault\(\)/)
  new vm.Script(script)

  assert.match(panelSource, /pasteboard\.items = \[item\]/)
  assert.match(panelSource, /item\["public\.utf8-plain-text"\]/)
  assert.match(panelSource, /item\["public\.html"\]/)
  assert.match(panelSource, /item\["public\.rtf"\]/)
  assert.match(panelSource, /item\["net\.daringfireball\.markdown"\]/)
  assert.match(panelSource, /\^cardaskgpt:\\\/\\\/clipboard/)
  assert.match(
    panelSource,
    /webViewDidFinishLoad:[\s\S]*?installClipboardBridge\(self\)/
  )

  const listeners = {}
  const events = []
  let browserClipboardText = ""
  let browserClipboardItems = null
  const runtime = {
    CustomEvent: function (type, options) {
      this.type = type
      this.detail = options.detail
    },
    Promise,
    Math,
    Date,
    encodeURIComponent,
    setTimeout(callback) {
      callback()
      return 1
    },
    document: {
      addEventListener(type, listener) {
        listeners[type] = listener
      },
      dispatchEvent(event) {
        events.push(event)
      },
      createElement() {
        return {
          innerHTML: "",
          appendChild() {}
        }
      }
    },
    navigator: {
      clipboard: {
        writeText(text) {
          browserClipboardText = text
          return Promise.resolve()
        },
        write(items) {
          browserClipboardItems = items
          return Promise.resolve()
        }
      }
    },
    location: { href: "https://chatgpt.com/" },
    getSelection() {
      return {
        rangeCount: 0,
        toString() {
          return ""
        }
      }
    }
  }
  runtime.window = runtime
  vm.createContext(runtime)

  assert.equal(vm.runInContext(script, runtime), "installed")
  assert.equal(typeof listeners.copy, "function")

  listeners.copy({
    clipboardData: {
      getData(type) {
        if (type === "text/plain") return "标题\n正文"
        if (type === "text/html") {
          return "<h1>标题</h1><p><strong>正文</strong></p>"
        }
        return ""
      }
    }
  })

  assert.deepEqual(
    JSON.parse(
      JSON.stringify(runtime.__mnCardAskGPTClipboardPayload)
    ),
    {
      plainText: "标题\n正文",
      html: "<h1>标题</h1><p><strong>正文</strong></p>",
      rtf: "",
      markdown: "",
      source: "copy-event"
    }
  )
  assert.match(runtime.location.href, /^cardaskgpt:\/\/clipboard\?token=/)

  await runtime.navigator.clipboard.writeText("  原始 Markdown\n\n")
  assert.equal(browserClipboardText, "  原始 Markdown\n\n")
  assert.equal(
    runtime.__mnCardAskGPTClipboardPayload.plainText,
    "  原始 Markdown\n\n"
  )
  assert.equal(
    runtime.__mnCardAskGPTClipboardPayload.source,
    "clipboard-writeText"
  )

  const clipboardItem = {
    types: ["text/plain", "text/html"],
    getType(type) {
      const value =
        type === "text/html"
          ? "<p><em>保留富文本</em></p>"
          : "保留富文本"
      return Promise.resolve({
        text() {
          return Promise.resolve(value)
        }
      })
    }
  }
  await runtime.navigator.clipboard.write([clipboardItem])
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(browserClipboardItems[0], clipboardItem)
  assert.equal(
    runtime.__mnCardAskGPTClipboardPayload.plainText,
    "保留富文本"
  )
  assert.equal(
    runtime.__mnCardAskGPTClipboardPayload.html,
    "<p><em>保留富文本</em></p>"
  )
  assert.equal(
    runtime.__mnCardAskGPTClipboardPayload.source,
    "clipboard-write"
  )
  assert.equal(events.at(-1).detail.payload.html, "<p><em>保留富文本</em></p>")
  assert.equal(vm.runInContext(script, runtime), "already-installed")

  console.log("Original-format clipboard bridge test passed.")
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
