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
  assert.match(script, /rtfFromHtml/)
  assert.match(script, /\\\\rtf1/)
  assert.match(script, /tag==='strong'\|\|tag==='b'/)
  assert.match(script, /tag==='li'/)
  assert.match(script, /tag==='pre'/)
  assert.match(script, /text\/markdown/)
  assert.match(script, /__mnCardAskGPTClipboardPayload/)
  assert.match(
    script,
    /addEventListener\('copy',function\(event\)\{signal\(selectionPayload\(event\),'copy-event'\);\}/
  )
  assert.match(
    script,
    /addEventListener\('paste'[\s\S]*?event\.preventDefault\(\)[\s\S]*?cardaskgpt:\/\/paste-card/
  )
  assert.match(script, /cardaskgpt:\/\/web-focus/)
  new vm.Script(script)

  assert.match(panelSource, /pasteboard\.items = \[item\]/)
  assert.match(panelSource, /item\["public\.utf8-plain-text"\]/)
  assert.match(panelSource, /item\["public\.html"\]/)
  assert.match(panelSource, /item\["public\.rtf"\]/)
  assert.match(panelSource, /item\["net\.daringfireball\.markdown"\]/)
  assert.match(
    panelSource,
    /NSData\.alloc\(\)\.initWithBase64EncodedStringOptions/
  )
  assert.doesNotMatch(panelSource, /item\["public\.html"\] = html(?:\s|;|$)/)
  assert.doesNotMatch(panelSource, /item\["public\.rtf"\] = rtf(?:\s|;|$)/)
  assert.match(panelSource, /\^cardaskgpt:\\\/\\\/clipboard/)
  assert.match(
    panelSource,
    /webViewDidFinishLoad:[\s\S]*?installClipboardBridge\(self\)/
  )
  assert.match(panelSource, /function focusMarginNoteSelection/)
  assert.match(panelSource, /function resignResponderTree/)
  assert.match(panelSource, /appendHtmlComment/)
  assert.match(panelSource, /\^cardaskgpt:\\\/\\\/paste-card/)
  assert.doesNotMatch(panelSource, /pasteHandoffUntil/)

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
    btoa(value) {
      return Buffer.from(value, "binary").toString("base64")
    },
    unescape,
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

  const selectionPayload = JSON.parse(
    JSON.stringify(runtime.__mnCardAskGPTClipboardPayload)
  )
  assert.equal(selectionPayload.plainText, "标题\n正文")
  assert.equal(
    selectionPayload.html,
    "<h1>标题</h1><p><strong>正文</strong></p>"
  )
  assert.match(selectionPayload.rtf, /^\{\\rtf1\\ansi/)
  assert.match(
    Buffer.from(selectionPayload.rtfUtf8Base64, "base64").toString("utf8"),
    /^\{\\rtf1\\ansi/
  )
  assert.equal(selectionPayload.markdown, "")
  assert.equal(selectionPayload.source, "copy-event")
  assert.match(
    Buffer.from(selectionPayload.htmlUtf8Base64, "base64").toString("utf8"),
    /<meta charset="utf-8">/
  )
  assert.match(
    Buffer.from(selectionPayload.htmlUtf8Base64, "base64").toString("utf8"),
    /<h1>标题<\/h1><p><strong>正文<\/strong><\/p>/
  )
  assert.doesNotMatch(selectionPayload.htmlAscii, /[^\x00-\x7f]/)
  assert.match(selectionPayload.htmlAscii, /&#x6807;&#x9898;/)
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

  const renderedAnswer = {
    innerText: "这是回答\n粗体内容",
    textContent: "这是回答粗体内容",
    innerHTML: "<h2>这是回答</h2><p><strong>粗体内容</strong></p>"
  }
  const responseScope = {
    querySelector() {
      return renderedAnswer
    }
  }
  const copyResponseButton = {
    textContent: "",
    parentElement: responseScope,
    getAttribute(name) {
      if (name === "aria-label") return "Copy response"
      return ""
    },
    closest(selector) {
      if (
        selector.includes("data-message-author-role") ||
        selector === "article"
      ) {
        return responseScope
      }
      return null
    }
  }
  listeners.click({
    target: {
      closest() {
        return copyResponseButton
      }
    }
  })
  await runtime.navigator.clipboard.writeText(
    "# 这是回答\n\n**粗体内容**"
  )
  assert.equal(
    runtime.__mnCardAskGPTClipboardPayload.plainText,
    "# 这是回答\n\n**粗体内容**"
  )
  assert.equal(
    runtime.__mnCardAskGPTClipboardPayload.html,
    "<div><h2>这是回答</h2><p><strong>粗体内容</strong></p></div>"
  )
  assert.doesNotMatch(
    runtime.__mnCardAskGPTClipboardPayload.htmlAscii,
    /[^\x00-\x7f]/
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
  assert.match(
    Buffer.from(
      runtime.__mnCardAskGPTClipboardPayload.htmlUtf8Base64,
      "base64"
    ).toString("utf8"),
    /<p><em>保留富文本<\/em><\/p>/
  )
  assert.equal(
    runtime.__mnCardAskGPTClipboardPayload.source,
    "clipboard-write"
  )
  assert.equal(events.at(-1).detail.payload.html, "<p><em>保留富文本</em></p>")

  let pastePrevented = false
  let pasteStopped = false
  runtime.__mnCardAskGPTPasteTarget = true
  listeners.paste({
    preventDefault() {
      pastePrevented = true
    },
    stopPropagation() {
      pasteStopped = true
    }
  })
  assert.equal(pastePrevented, true)
  assert.equal(pasteStopped, true)
  assert.equal(runtime.__mnCardAskGPTPasteTarget, false)
  assert.equal(runtime.location.href, "cardaskgpt://paste-card")

  runtime.__mnCardAskGPTPasteTarget = true
  listeners.pointerdown({})
  assert.equal(runtime.__mnCardAskGPTPasteTarget, false)
  assert.equal(runtime.location.href, "cardaskgpt://web-focus")

  assert.equal(vm.runInContext(script, runtime), "already-installed")

  console.log("Original-format clipboard bridge test passed.")
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
