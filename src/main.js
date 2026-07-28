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

  function nativeArray(value) {
    if (!value) return []
    if (Array.isArray(value)) return value
    var count =
      typeof value.count === "function"
        ? Number(value.count())
        : Number(value.length || 0)
    var result = []
    for (var index = 0; index < count; index++) {
      result.push(
        typeof value.objectAtIndex === "function"
          ? value.objectAtIndex(index)
          : value[index]
      )
    }
    return result
  }

  function noteFromSelectionItem(item) {
    if (!item) return null
    if (item.note && item.note.note && item.note.note.noteId) {
      return item.note.note
    }
    if (item.note && item.note.noteId) return item.note
    if (item.noteId) return item
    return null
  }

  function currentSelectedNotes(extension, fallbackNote) {
    var notes = []
    var seen = {}
    try {
      var studyController = extension.app.studyController(extension.window)
      var notebookController = studyController.notebookController
      var selected = nativeArray(notebookController.mindmapView.selViewLst)
      for (var index = 0; index < selected.length; index++) {
        var note = noteFromSelectionItem(selected[index])
        if (!note || !note.noteId) continue
        var noteId = stringValue(note.noteId)
        if (seen[noteId]) continue
        seen[noteId] = true
        notes.push(note)
      }
    } catch (error) {
      notes = []
    }

    if (!notes.length && fallbackNote) {
      var fallback = noteFromSelectionItem(fallbackNote) || fallbackNote
      if (fallback && fallback.noteId) notes.push(fallback)
    }
    return notes
  }

  function selectionSignature(notes) {
    return notes
      .map(function (note) {
        return stringValue(note.noteId)
      })
      .sort()
      .join("|")
  }

  function stopSelectionSync(extension) {
    if (extension.selectionTimer) {
      extension.selectionTimer.invalidate()
      extension.selectionTimer = null
    }
  }

  function stopFocusPolling(extension) {
    stopSelectionSync(extension)
    if (extension.focusTimer) {
      extension.focusTimer.invalidate()
      extension.focusTimer = null
    }
  }

  function handleCardSelection(extension, notes, source) {
    if (!extension.enabled) return
    notes = notes || []
    var signature = selectionSignature(notes)
    if (!signature && !extension.lastSelectionSignature) return
    var now = Date.now()
    if (
      extension.lastSelectionSignature === signature &&
      now - extension.lastHandledAt < 650
    ) {
      return
    }
    extension.lastSelectionSignature = signature
    extension.lastHandledAt = now

    try {
      if (!notes.length) {
        log("selection cleared from " + source)
        if (extension.panel) {
          CardAskGPTPanelAPI.enqueueCards(extension.panel, [], false)
        }
        return
      }
      log("cards captured from " + source + ": " + signature)
      var payloads = notes.map(function (note) {
        return serializeCard(note)
      })
      var panel = ensurePanelAttached(extension)
      panel.view.hidden = false
      panel.webview.hidden = false
      CardAskGPTPanelAPI.enqueueCards(panel, payloads)
    } catch (error) {
      log("card handling failed: " + stringValue(error))
    }
  }

  function scheduleSelectionSync(extension, fallbackNote, source) {
    stopSelectionSync(extension)
    extension.selectionTimer = NSTimer.scheduledTimerWithTimeInterval(
      0.12,
      false,
      function () {
        extension.selectionTimer = null
        if (!extension.enabled) return
        var notes = currentSelectedNotes(extension, fallbackNote)
        extension.lastObservedSelectionSignature = selectionSignature(notes)
        handleCardSelection(extension, notes, source)
      }
    )
  }

  function startFocusPolling(extension) {
    stopFocusPolling(extension)
    var current = currentSelectedNotes(extension, null)
    extension.lastObservedSelectionSignature = selectionSignature(current)

    extension.focusTimer = NSTimer.scheduledTimerWithTimeInterval(
      0.35,
      true,
      function () {
        if (!extension.enabled) return
        var notes = currentSelectedNotes(extension, null)
        var signature = selectionSignature(notes)
        if (signature === extension.lastObservedSelectionSignature) {
          return
        }
        extension.lastObservedSelectionSignature = signature
        handleCardSelection(extension, notes, "selection-poll")
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
        self.lastSelectionSignature = ""
        self.lastHandledAt = 0
        self.lastObservedSelectionSignature = ""
        self.selectionTimer = null
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
        self.lastSelectionSignature = ""
        self.lastObservedSelectionSignature = ""
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
            log("enabled")
          } catch (error) {
            self.enabled = false
            log("panel initialization failed: " + stringValue(error))
          }
        } else {
          stopFocusPolling(self)
          if (self.panel) {
            CardAskGPTPanelAPI.cancelPendingCard(self.panel)
            self.panel.view.hidden = true
          }
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
        scheduleSelectionSync(self, note, "PopupMenuOnNote")
      }
    },
    {
      addonDidConnect: function () {},
      addonWillDisconnect: function () {}
    }
  )

  return CardAskGPTExtension
}
