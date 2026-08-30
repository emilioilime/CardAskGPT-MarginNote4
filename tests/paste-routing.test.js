const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "..")
const panelSource = fs.readFileSync(
  path.join(root, "src", "panel.js"),
  "utf8"
)
const mainSource = fs.readFileSync(
  path.join(root, "src", "main.js"),
  "utf8"
)

assert.match(
  mainSource,
  /if \(!extension\.cardSyncEnabled\)[\s\S]*?focusMarginNoteSelection/
)
assert.match(panelSource, /document\.activeElement/)
assert.match(panelSource, /resignResponderTree\(controller\.webview\)/)
assert.match(panelSource, /context\.selectedNode/)
assert.match(panelSource, /context\.mindmapView/)
assert.match(panelSource, /appendPayloadToSelectedCard/)

const calls = []
const note = {
  noteId: "note-1",
  notebookId: "notebook-1",
  appendHtmlComment(html, plainText, size, source) {
    calls.push(["appendHtml", html, plainText, size, source])
  }
}
const selectedNode = {
  note,
  becomeFirstResponder() {
    calls.push(["selectedFirstResponder"])
    return true
  }
}
const studyController = {
  notebookController: {
    mindmapView: {
      selViewLst: [selectedNode]
    }
  },
  focusNoteInMindMapById(noteId) {
    calls.push(["focusNote", noteId])
  }
}

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
  },
  UndoManager: {
    sharedInstance() {
      return {
        undoGrouping(title, notebookId, callback) {
          calls.push(["undo", title, notebookId])
          callback()
        }
      }
    }
  }
}
vm.createContext(context)
vm.runInContext(panelSource, context)

const controller = {
  cardSyncEnabled: false,
  pasteTargetsSelectedCard: true,
  hostExtension: {
    window: {}
  },
  app: {
    studyController() {
      return studyController
    },
    refreshAfterDBChanged(notebookId) {
      calls.push(["refresh", notebookId])
    }
  },
  webview: {
    evaluateJavaScript(script) {
      calls.push(["javascript", script])
    },
    endEditing() {},
    resignFirstResponder() {},
    subviews: []
  },
  lastClipboardPayload: {
    plainText: "标题\n正文",
    html: "<h2>标题</h2><p><strong>正文</strong></p>",
    markdown: "## 标题\n\n**正文**"
  }
}

assert.equal(
  context.CardAskGPTPanelAPI.focusMarginNoteSelection(controller),
  true
)
assert.ok(calls.some((call) => call[0] === "selectedFirstResponder"))
assert.ok(
  calls.some(
    (call) =>
      call[0] === "javascript" &&
      call[1].includes("__mnCardAskGPTPasteTarget=true")
  )
)

assert.equal(
  context.CardAskGPTPanelAPI.appendPayloadToSelectedCard(controller),
  true
)
const appendCall = calls.find((call) => call[0] === "appendHtml")
assert.ok(appendCall)
assert.equal(
  appendCall[1],
  "<h2>标题</h2><p><strong>正文</strong></p>"
)
assert.equal(appendCall[2], "标题\n正文")
assert.equal(appendCall[4], "cardaskgpt")
assert.ok(calls.some((call) => call[0] === "refresh"))
assert.ok(calls.some((call) => call[0] === "focusNote"))

controller.cardSyncEnabled = true
assert.equal(
  context.CardAskGPTPanelAPI.appendPayloadToSelectedCard(controller),
  false
)

console.log("Web and card paste routing test passed.")
