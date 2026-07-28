JSB.newAddon = function (mainPath) {
  JSB.require("chatgptBridge")
  JSB.require("panel")

  var ADDON_TITLE = "Card → ChatGPT"
  var DEFAULTS_KEY = "CardAskGPT_TemporaryChat"

  function stringValue(value) {
    if (value === undefined || value === null) return ""
    return String(value)
  }

  function trimmed(value) {
    return stringValue(value).replace(/^\s+|\s+$/g, "")
  }

  function mimeTypeFromBase64(base64) {
    if (base64.indexOf("iVBOR") === 0) return "image/png"
    if (base64.indexOf("R0lGOD") === 0) return "image/gif"
    if (base64.indexOf("UklGR") === 0) return "image/webp"
    return "image/jpeg"
  }

  function imageDataURLFromPaint(paint) {
    if (!paint) return ""
    try {
      var data = Database.sharedInstance().getMediaByHash(paint)
      if (!data || !data.length()) return ""
      var base64 = data.base64Encoding()
      return "data:" + mimeTypeFromBase64(base64) + ";base64," + base64
    } catch (error) {
      return ""
    }
  }

  function addTextBlock(blocks, kind, text) {
    text = trimmed(text)
    if (!text) return
    blocks.push({ type: "text", kind: kind, text: text })
  }

  function addImageBlock(blocks, kind, pic) {
    if (!pic || !pic.paint) return
    var dataURL = imageDataURLFromPaint(pic.paint)
    if (!dataURL) return
    blocks.push({ type: "image", kind: kind, dataURL: dataURL })
  }

  function addLinkedNote(blocks, comment) {
    if (!comment || !comment.noteid) return
    try {
      var linked = Database.sharedInstance().getNoteById(comment.noteid)
      if (!linked) return
      addTextBlock(blocks, "linked-title", linked.noteTitle)
      addTextBlock(blocks, "linked-excerpt", linked.excerptText)
      addImageBlock(blocks, "linked-image", linked.excerptPic)
    } catch (error) {
      addTextBlock(blocks, "linked-excerpt", comment.q_htext)
      addImageBlock(blocks, "linked-image", comment.q_hpic)
    }
  }

  function serializeCard(note) {
    var blocks = []
    var title = trimmed(note.noteTitle)

    addTextBlock(blocks, "title", title)
    addTextBlock(blocks, "excerpt", note.excerptText)
    addImageBlock(blocks, "excerpt-image", note.excerptPic)

    var comments = note.comments || []
    for (var index = 0; index < comments.length; index++) {
      var comment = comments[index]
      if (!comment) continue
      if (comment.type === "TextNote") {
        addTextBlock(blocks, "comment", comment.text)
      } else if (comment.type === "HtmlNote") {
        addTextBlock(blocks, "comment", comment.text)
      } else if (comment.type === "PaintNote") {
        addImageBlock(blocks, "comment-image", comment)
      } else if (comment.type === "LinkNote") {
        addLinkedNote(blocks, comment)
      }
    }

    if (!blocks.length) {
      try {
        addTextBlock(blocks, "excerpt", note.allNoteText())
      } catch (error) {
        addTextBlock(blocks, "excerpt", "（此卡片没有可渲染的内容）")
      }
    }

    return {
      id: stringValue(note.noteId),
      title: title || "MarginNote 卡片",
      notebookId: stringValue(note.notebookId),
      page:
        note.startPage === undefined || note.startPage === null
          ? ""
          : stringValue(note.startPage),
      blocks: blocks
    }
  }

  function log(message) {
    try {
      JSB.log("CardAskGPT: " + stringValue(message))
    } catch (error) {}
  }

  function registerNoteObserver(extension) {
    try {
      NSNotificationCenter.defaultCenter().removeObserverName(
        extension,
        "PopupMenuOnNote"
      )
      NSNotificationCenter.defaultCenter().addObserverSelectorName(
        extension,
        "onPopupMenuOnNote:",
        "PopupMenuOnNote"
      )
    } catch (error) {
      log("observer registration failed: " + stringValue(error))
    }
  }

  function unregisterNoteObserver(extension) {
    try {
      NSNotificationCenter.defaultCenter().removeObserverName(
        extension,
        "PopupMenuOnNote"
      )
    } catch (error) {}
  }

  function ensurePanelAttached(extension) {
    if (!extension.panel) {
      log("creating panel")
      extension.panel = CardAskGPTPanelAPI.create()
      extension.panel.mainPath = mainPath
      extension.panel.hostExtension = extension
      extension.panel.notebookId = extension.notebookId || ""
      CardAskGPTPanelAPI.setTemporaryChatEnabled(
        extension.panel,
        Boolean(extension.storedTemporary)
      )
    }

    var studyController = extension.app.studyController(extension.window)
    if (!extension.panel.view.superview) {
      studyController.view.addSubview(extension.panel.view)
    }
    CardAskGPTPanelAPI.layoutDocked(extension.panel)
    return extension.panel
  }

  function currentFocusNote(extension) {
    try {
      var studyController = extension.app.studyController(extension.window)
      var notebookController = studyController.notebookController
      var note =
        notebookController.focusNote || notebookController.visibleFocusNote
      if (note) return note.note || note

      var selected = notebookController.mindmapView.selViewLst
      if (selected && selected.length) {
        var selectedNote = selected[0].note
        return (selectedNote && selectedNote.note) || selectedNote
      }
    } catch (error) {
      return null
    }
    return null
  }

  function stopFocusPolling(extension) {
    if (extension.focusTimer) {
      extension.focusTimer.invalidate()
      extension.focusTimer = null
    }
  }

  function handleCardNote(extension, note, source) {
    if (!extension.enabled || !note || !note.noteId) return
    var now = Date.now()
    if (
      extension.lastNoteId === note.noteId &&
      now - extension.lastHandledAt < 650
    ) {
      return
    }
    extension.lastNoteId = note.noteId
    extension.lastHandledAt = now

    try {
      log("card captured from " + source + ": " + note.noteId)
      extension.app.showHUD(
        "已捕获卡片，正在打开 ChatGPT…",
        extension.window,
        1.2
      )
      var payload = serializeCard(note)
      var panel = ensurePanelAttached(extension)
      panel.view.hidden = false
      panel.webview.hidden = false
      CardAskGPTPanelAPI.enqueueCard(panel, payload)
    } catch (error) {
      extension.app.showHUD(
        "卡片处理失败：" +
          stringValue(error && error.message ? error.message : error),
        extension.window,
        5
      )
      log("card handling failed: " + stringValue(error))
    }
  }

  function startFocusPolling(extension) {
    stopFocusPolling(extension)
    var current = currentFocusNote(extension)
    extension.lastObservedFocusNoteId =
      current && current.noteId ? stringValue(current.noteId) : ""

    extension.focusTimer = NSTimer.scheduledTimerWithTimeInterval(
      0.35,
      true,
      function () {
        if (!extension.enabled) return
        var note = currentFocusNote(extension)
        if (!note || !note.noteId) return
        var noteId = stringValue(note.noteId)
        if (noteId === extension.lastObservedFocusNoteId) return
        extension.lastObservedFocusNoteId = noteId
        handleCardNote(extension, note, "focus-poll")
      }
    )
  }

  var CardAskGPTExtension = JSB.defineClass(
    "CardAskGPTExtension : JSExtension",
    {
      sceneWillConnect: function () {
        self.app = Application.sharedInstance()
        self.panel = null
        self.enabled = false
        self.lastNoteId = ""
        self.lastHandledAt = 0
        self.lastObservedFocusNoteId = ""
        self.focusTimer = null

        self.storedTemporary = NSUserDefaults.standardUserDefaults().objectForKey(
          DEFAULTS_KEY
        )
        if (
          self.storedTemporary === undefined ||
          self.storedTemporary === null
        ) {
          self.storedTemporary = true
          NSUserDefaults.standardUserDefaults().setObjectForKey(
            true,
            DEFAULTS_KEY
          )
        }
        registerNoteObserver(self)
        log("scene connected; observer registered")
      },

      sceneDidDisconnect: function () {
        stopFocusPolling(self)
        unregisterNoteObserver(self)
        if (self.panel && self.panel.webview) {
          self.panel.webview.stopLoading()
          self.panel.webview.delegate = null
        }
      },

      sceneDidBecomeActive: function () {
        registerNoteObserver(self)
        if (self.enabled) startFocusPolling(self)
      },

      notebookWillOpen: function (notebookId) {
        var studyController = self.app.studyController(self.window)
        self.notebookId = notebookId
        registerNoteObserver(self)
        studyController.refreshAddonCommands()
        log("notebook opened; observer refreshed")
      },

      notebookWillClose: function () {
        self.enabled = false
        self.lastNoteId = ""
        stopFocusPolling(self)
        if (self.panel) {
          CardAskGPTPanelAPI.cancelPendingCard(self.panel)
          self.panel.view.hidden = true
        }
        unregisterNoteObserver(self)
      },

      controllerWillLayoutSubviews: function (controller) {
        if (controller !== self.app.studyController(self.window)) return
        if (self.panel && !self.panel.view.hidden) {
          CardAskGPTPanelAPI.layoutDocked(self.panel)
        }
      },

      queryAddonCommandStatus: function () {
        return {
          image: "icon.png",
          object: self,
          selector: "toggleAddon:",
          checked: self.enabled
        }
      },

      toggleAddon: function () {
        self.enabled = !self.enabled

        if (self.enabled) {
          try {
            registerNoteObserver(self)
            var panel = ensurePanelAttached(self)
            panel.view.hidden = true
            startFocusPolling(self)
            self.app.showHUD(
              "Card → ChatGPT v0.1.3 已开启：点击卡片即可附加图片",
              self.window,
              2
            )
            log("enabled")
          } catch (error) {
            self.enabled = false
            self.app.showHUD(
              "Card → ChatGPT 初始化失败：" +
                stringValue(error && error.message ? error.message : error),
              self.window,
              5
            )
            log("panel initialization failed: " + stringValue(error))
          }
        } else {
          stopFocusPolling(self)
          if (self.panel) {
            CardAskGPTPanelAPI.cancelPendingCard(self.panel)
            self.panel.view.hidden = true
          }
          self.app.showHUD("Card → ChatGPT 已关闭", self.window, 1.5)
          log("disabled")
        }
        self.app.studyController(self.window).refreshAddonCommands()
      },

      onPopupMenuOnNote: function (sender) {
        if (!self.enabled) return
        if (!sender.userInfo || !sender.userInfo.note) return

        try {
          if (self.app.focusWindow && self.window !== self.app.focusWindow) return
        } catch (error) {}

        var note = sender.userInfo.note.note || sender.userInfo.note
        self.lastObservedFocusNoteId = stringValue(note.noteId)
        handleCardNote(self, note, "PopupMenuOnNote")
      }
    },
    {
      addonDidConnect: function () {},
      addonWillDisconnect: function () {}
    }
  )

  return CardAskGPTExtension
}
