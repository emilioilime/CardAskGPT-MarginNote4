var CardAskGPTPanelAPI = (function () {
  var PANEL_MIN_WIDTH = 350
  var PANEL_MIN_HEIGHT = 280
  var PANEL_FRAME_X_KEY = "CardAskGPT_PanelX"
  var PANEL_FRAME_Y_KEY = "CardAskGPT_PanelY"
  var PANEL_FRAME_WIDTH_KEY = "CardAskGPT_PanelWidth"
  var PANEL_FRAME_HEIGHT_KEY = "CardAskGPT_PanelHeight"
  var QUESTION_MODE_DEFAULTS_KEY = "CardAskGPT_QuestionModeEnabled"
  var PRESET_PROMPT_DEFAULTS_KEY = "CardAskGPT_PresetPrompt"
  var AUTO_SEND_DEFAULTS_KEY = "CardAskGPT_AutoSendEnabled"
  var DEFAULT_PRESET_PROMPT = "请根据图片中的卡片内容进行讲解。"
  var SESSION_KEYCHAIN_SERVICE =
    "com.cardaskgpt.marginnote4.chatgpt-session"
  var SESSION_KEYCHAIN_ACCOUNT = "persistent-web-data"
  var SESSION_SAVE_INTERVAL = 45

  function clampNumber(value, minimum, maximum) {
    var number = Number(value)
    if (isNaN(number)) number = minimum
    return Math.max(minimum, Math.min(maximum, number))
  }

  function savedNumber(key) {
    try {
      var value = NSUserDefaults.standardUserDefaults().objectForKey(key)
      if (value === undefined || value === null) return null
      var number = Number(value)
      return isNaN(number) ? null : number
    } catch (error) {
      return null
    }
  }

  function dataFromBase64(value) {
    var encoded = String(value || "")
    if (!encoded) return null
    try {
      return NSData.alloc().initWithBase64EncodedStringOptions(encoded, 0)
    } catch (error) {}
    try {
      return NSData.dataWithBase64EncodedStringOptions(encoded, 0)
    } catch (error) {
      return null
    }
  }

  function normalizePanelFrame(frame, bounds) {
    bounds = bounds || { x: 0, y: 0, width: 1920, height: 1080 }
    frame = frame || {}
    var inset = 8
    var availableWidth = Math.max(1, bounds.width - inset * 2)
    var availableHeight = Math.max(1, bounds.height - inset * 2)
    var minimumWidth = Math.min(PANEL_MIN_WIDTH, availableWidth)
    var minimumHeight = Math.min(PANEL_MIN_HEIGHT, availableHeight)
    var width = clampNumber(frame.width, minimumWidth, availableWidth)
    var height = clampNumber(frame.height, minimumHeight, availableHeight)
    var minimumX = bounds.x + inset
    var minimumY = bounds.y + inset
    var maximumX = Math.max(
      minimumX,
      bounds.x + bounds.width - width - inset
    )
    var maximumY = Math.max(
      minimumY,
      bounds.y + bounds.height - height - inset
    )
    return {
      x: clampNumber(frame.x, minimumX, maximumX),
      y: clampNumber(frame.y, minimumY, maximumY),
      width: width,
      height: height
    }
  }

  function initialPanelFrame(controller, bounds) {
    var defaultWidth = controller.app.osType === 2 ? 460 : 420
    var width = savedNumber(PANEL_FRAME_WIDTH_KEY)
    var height = savedNumber(PANEL_FRAME_HEIGHT_KEY)
    if (width === null) width = Math.min(defaultWidth, bounds.width - 16)
    if (height === null) height = bounds.height - 16
    var x = savedNumber(PANEL_FRAME_X_KEY)
    var y = savedNumber(PANEL_FRAME_Y_KEY)
    if (x === null) x = bounds.x + bounds.width - width - 10
    if (y === null) y = bounds.y + 8
    return normalizePanelFrame(
      { x: x, y: y, width: width, height: height },
      bounds
    )
  }

  function savePanelFrame(controller) {
    if (!controller.view || !controller.view.frame) return
    var frame = controller.view.frame
    try {
      var defaults = NSUserDefaults.standardUserDefaults()
      defaults.setObjectForKey(frame.x, PANEL_FRAME_X_KEY)
      defaults.setObjectForKey(frame.y, PANEL_FRAME_Y_KEY)
      defaults.setObjectForKey(frame.width, PANEL_FRAME_WIDTH_KEY)
      defaults.setObjectForKey(frame.height, PANEL_FRAME_HEIGHT_KEY)
      if (defaults.synchronize) defaults.synchronize()
    } catch (error) {}
    controller._preferredFrame = frame
  }

  function updateTemporaryButton(controller) {
    if (!controller.temporaryButton) return
    if (controller.temporaryChatEnabled) {
      controller.temporaryButton.setTitleForState("临时：开", 0)
      controller.temporaryButton.backgroundColor =
        UIColor.colorWithHexString("#d9ead9")
      controller.temporaryButton.setTitleColorForState(
        UIColor.colorWithHexString("#285b32"),
        0
      )
    } else {
      controller.temporaryButton.setTitleForState("临时：关", 0)
      controller.temporaryButton.backgroundColor =
        UIColor.colorWithHexString("#ddd8cd")
      controller.temporaryButton.setTitleColorForState(
        UIColor.colorWithHexString("#5b564d"),
        0
      )
    }
  }

  function updateCardSyncButton(controller) {
    if (!controller.cardSyncButton) return
    if (controller.cardSyncEnabled) {
      controller.cardSyncButton.setTitleForState("同步：开", 0)
      controller.cardSyncButton.backgroundColor =
        UIColor.colorWithHexString("#d9ead9")
      controller.cardSyncButton.setTitleColorForState(
        UIColor.colorWithHexString("#285b32"),
        0
      )
    } else {
      controller.cardSyncButton.setTitleForState("同步：停", 0)
      controller.cardSyncButton.backgroundColor =
        UIColor.colorWithHexString("#eadfc9")
      controller.cardSyncButton.setTitleColorForState(
        UIColor.colorWithHexString("#6b5428"),
        0
      )
    }
  }

  function updateQuestionControls(controller) {
    if (controller.questionModeButton) {
      if (controller.questionModeEnabled) {
        controller.questionModeButton.setTitleForState("模式：预设提问", 0)
        controller.questionModeButton.backgroundColor =
          UIColor.colorWithHexString("#dbe6f5")
        controller.questionModeButton.setTitleColorForState(
          UIColor.colorWithHexString("#284b70"),
          0
        )
      } else {
        controller.questionModeButton.setTitleForState("模式：仅图片", 0)
        controller.questionModeButton.backgroundColor =
          UIColor.colorWithHexString("#e5e1d8")
        controller.questionModeButton.setTitleColorForState(
          UIColor.colorWithHexString("#554f46"),
          0
        )
      }
    }
    if (controller.questionSettingsButton) {
      controller.questionSettingsButton.hidden =
        !controller.questionModeEnabled
      controller.questionSettingsButton.setTitleForState(
        controller.autoSendEnabled ? "提问：自动发送" : "提问：手动发送",
        0
      )
      controller.questionSettingsButton.backgroundColor =
        controller.autoSendEnabled
          ? UIColor.colorWithHexString("#f0dccf")
          : UIColor.colorWithHexString("#ece8df")
      controller.questionSettingsButton.setTitleColorForState(
        controller.autoSendEnabled
          ? UIColor.colorWithHexString("#74412b")
          : UIColor.colorWithHexString("#554f46"),
        0
      )
    }
  }

  function updatePromptEditorAutoSendButton(controller) {
    if (!controller.promptAutoSendButton) return
    controller.promptAutoSendButton.setTitleForState(
      controller.draftAutoSendEnabled ? "自动发送：开" : "自动发送：关",
      0
    )
    controller.promptAutoSendButton.backgroundColor =
      controller.draftAutoSendEnabled
        ? UIColor.colorWithHexString("#f0dccf")
        : UIColor.colorWithHexString("#e9e5dc")
    controller.promptAutoSendButton.setTitleColorForState(
      controller.draftAutoSendEnabled
        ? UIColor.colorWithHexString("#74412b")
        : UIColor.colorWithHexString("#554f46"),
      0
    )
  }

  function desiredChatURL(controller) {
    return controller.temporaryChatEnabled
      ? "https://chatgpt.com/?temporary-chat=true"
      : "https://chatgpt.com/"
  }

  function isTemporaryURL(url) {
    return /[?&]temporary-chat=true(?:[&#]|$)/i.test(String(url || ""))
  }

  function layoutSubviews(controller) {
    var bounds = controller.view.bounds
    var toolbarHeight = 36
    if (controller.dragRegion) {
      controller.dragRegion.frame = {
        x: 0,
        y: 0,
        width: Math.max(120, bounds.width - 150),
        height: toolbarHeight
      }
    }
    controller.titleButton.frame = {
      x: 10,
      y: 2,
      width: Math.max(120, bounds.width - 160),
      height: 32
    }
    controller.cardSyncButton.frame = {
      x: bounds.width - 130,
      y: Math.max(toolbarHeight + 12, bounds.height - 148),
      width: 116,
      height: 44
    }
    controller.questionModeButton.frame = {
      x: bounds.width - 130,
      y: Math.max(toolbarHeight + 12, bounds.height - 196),
      width: 116,
      height: 40
    }
    controller.questionSettingsButton.frame = {
      x: bounds.width - 130,
      y: Math.max(toolbarHeight + 12, bounds.height - 238),
      width: 116,
      height: 34
    }
    controller.temporaryButton.frame = {
      x: bounds.width - 142,
      y: 5,
      width: 78,
      height: 26
    }
    controller.reloadButton.frame = {
      x: bounds.width - 61,
      y: 2,
      width: 28,
      height: 32
    }
    controller.closeButton.frame = {
      x: bounds.width - 31,
      y: 2,
      width: 28,
      height: 32
    }
    controller.webview.frame = {
      x: 0,
      y: toolbarHeight,
      width: bounds.width,
      height: bounds.height - toolbarHeight
    }
    if (controller.resizeHandle) {
      controller.resizeHandle.frame = {
        x: bounds.width - 44,
        y: bounds.height - 44,
        width: 44,
        height: 44
      }
    }
    if (controller.promptEditorOverlay && controller.promptEditorCard) {
      controller.promptEditorOverlay.frame = bounds
      var editorWidth = Math.min(380, Math.max(300, bounds.width - 28))
      var editorHeight = Math.min(280, Math.max(226, bounds.height - 48))
      var editorX = (bounds.width - editorWidth) / 2
      var editorY = (bounds.height - editorHeight) / 2
      controller.promptEditorCard.frame = {
        x: editorX,
        y: editorY,
        width: editorWidth,
        height: editorHeight
      }
      controller.promptEditorTitle.frame = {
        x: 14,
        y: 8,
        width: editorWidth - 28,
        height: 30
      }
      controller.promptTextView.frame = {
        x: 14,
        y: 42,
        width: editorWidth - 28,
        height: editorHeight - 108
      }
      controller.promptAutoSendButton.frame = {
        x: 14,
        y: editorHeight - 54,
        width: 124,
        height: 38
      }
      controller.promptCancelButton.frame = {
        x: editorWidth - 154,
        y: editorHeight - 54,
        width: 64,
        height: 38
      }
      controller.promptSaveButton.frame = {
        x: editorWidth - 82,
        y: editorHeight - 54,
        width: 68,
        height: 38
      }
    }
  }

  function layoutDocked(controller) {
    if (!controller.hostExtension || !controller.hostExtension.window) return
    var studyController = controller.app.studyController(
      controller.hostExtension.window
    )
    var bounds = studyController.view.bounds
    var frame = controller._preferredFrame
      ? normalizePanelFrame(controller._preferredFrame, bounds)
      : initialPanelFrame(controller, bounds)
    controller.view.frame = frame
    controller._preferredFrame = frame
    layoutSubviews(controller)
  }

  function setTemporaryChatEnabled(controller, enabled) {
    controller.temporaryChatEnabled = Boolean(enabled)
    controller.chatURL = desiredChatURL(controller)
    updateTemporaryButton(controller)
  }

  function releaseWebFocus(controller) {
    if (!controller || !controller.webview) return
    try {
      controller.webview.evaluateJavaScript(
        "(function(){try{var active=document.activeElement;" +
          "if(active&&typeof active.blur==='function')active.blur();" +
          "}catch(error){}return true;})()",
        function () {}
      )
    } catch (error) {}
    try {
      controller.webview.endEditing(true)
    } catch (error) {}
    resignResponderTree(controller.webview)
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

  function cookieValue(cookie, name) {
    if (!cookie) return ""
    try {
      var value = cookie[name]
      if (typeof value === "function") value = value.call(cookie)
      return value === undefined || value === null ? "" : value
    } catch (error) {
      return ""
    }
  }

  function isChatGPTCookie(cookie) {
    var domain = String(cookieValue(cookie, "domain") || "")
      .toLowerCase()
      .replace(/^\./, "")
    return /(^|\.)(chatgpt\.com|openai\.com)$/.test(domain)
  }

  function sharedCookieStorage() {
    try {
      if (typeof NSHTTPCookieStorage === "undefined") return null
      var storage = NSHTTPCookieStorage.sharedHTTPCookieStorage()
      if (storage) storage.cookieAcceptPolicy = 0
      return storage
    } catch (error) {
      return null
    }
  }

  function keychainReadSession() {
    try {
      if (
        typeof SSKeychain === "undefined" ||
        typeof SSKeychain.passwordForServiceAccount !== "function"
      ) {
        return ""
      }
      return String(
        SSKeychain.passwordForServiceAccount(
          SESSION_KEYCHAIN_SERVICE,
          SESSION_KEYCHAIN_ACCOUNT
        ) || ""
      )
    } catch (error) {
      return ""
    }
  }

  function keychainWriteSession(value) {
    try {
      if (
        typeof SSKeychain === "undefined" ||
        typeof SSKeychain.setPasswordForServiceAccount !== "function"
      ) {
        return false
      }
      return Boolean(
        SSKeychain.setPasswordForServiceAccount(
          String(value || ""),
          SESSION_KEYCHAIN_SERVICE,
          SESSION_KEYCHAIN_ACCOUNT
        )
      )
    } catch (error) {
      return false
    }
  }

  function keychainDeleteSession() {
    try {
      if (
        typeof SSKeychain === "undefined" ||
        typeof SSKeychain.deletePasswordForServiceAccount !== "function"
      ) {
        return false
      }
      return Boolean(
        SSKeychain.deletePasswordForServiceAccount(
          SESSION_KEYCHAIN_SERVICE,
          SESSION_KEYCHAIN_ACCOUNT
        )
      )
    } catch (error) {
      return false
    }
  }

  function savePersistentSession(controller) {
    var storage = sharedCookieStorage()
    if (!storage) return false
    try {
      var source =
        typeof storage.cookies === "function"
          ? storage.cookies()
          : storage.cookies
      if (source === undefined || source === null) return false
      var cookies = nativeArray(source).filter(isChatGPTCookie)
      if (!cookies.length) {
        keychainDeleteSession()
        return true
      }
      if (
        typeof NSMutableArray === "undefined" ||
        typeof NSKeyedArchiver === "undefined"
      ) {
        return false
      }
      var archivedCookies =
        typeof NSMutableArray.array === "function"
          ? NSMutableArray.array()
          : NSMutableArray.new()
      for (var index = 0; index < cookies.length; index++) {
        archivedCookies.addObject(cookies[index])
      }
      var data = NSKeyedArchiver.archivedDataWithRootObject(archivedCookies)
      if (!data) return false
      var encoded = data.base64Encoding()
      if (!encoded) return false
      var saved = keychainWriteSession(encoded)
      if (saved && controller) controller.lastSessionSavedAt = Date.now()
      return saved
    } catch (error) {
      return false
    }
  }

  function restorePersistentSession(controller) {
    if (controller && controller.persistentSessionRestored) return true
    if (controller) controller.persistentSessionRestored = true
    var storage = sharedCookieStorage()
    if (!storage) return false
    var encoded = keychainReadSession()
    if (!encoded) return false
    try {
      if (
        typeof NSData === "undefined" ||
        typeof NSKeyedUnarchiver === "undefined"
      ) {
        return false
      }
      var data = dataFromBase64(encoded)
      if (!data) return false
      var restored = NSKeyedUnarchiver.unarchiveObjectWithData(data)
      var cookies = nativeArray(restored).filter(isChatGPTCookie)
      for (var index = 0; index < cookies.length; index++) {
        storage.setCookie(cookies[index])
      }
      return cookies.length > 0
    } catch (error) {
      return false
    }
  }

  function resignResponderTree(view) {
    if (!view) return
    var subviews = []
    try {
      subviews = nativeArray(view.subviews)
    } catch (error) {
      subviews = []
    }
    for (var index = 0; index < subviews.length; index++) {
      resignResponderTree(subviews[index])
    }
    try {
      view.resignFirstResponder()
    } catch (error) {}
  }

  function noteFromMindmapNode(node) {
    if (!node) return null
    if (node.note && node.note.note && node.note.note.noteId) {
      return node.note.note
    }
    if (node.note && node.note.noteId) return node.note
    if (node.noteId) return node
    return null
  }

  function selectedMindmapContext(controller) {
    try {
      if (!controller.hostExtension || !controller.hostExtension.window) {
        return null
      }
      var studyController = controller.app.studyController(
        controller.hostExtension.window
      )
      var notebookController = studyController.notebookController
      var mindmapView = notebookController.mindmapView
      var selectedNodes = nativeArray(mindmapView.selViewLst)
      var selectedNode = selectedNodes.length ? selectedNodes[0] : null
      return {
        studyController: studyController,
        notebookController: notebookController,
        mindmapView: mindmapView,
        selectedNode: selectedNode,
        note: noteFromMindmapNode(selectedNode)
      }
    } catch (error) {
      return null
    }
  }

  function tryBecomeFirstResponder(target) {
    if (!target) return false
    try {
      if (typeof target.becomeFirstResponder !== "function") return false
      return target.becomeFirstResponder() !== false
    } catch (error) {
      return false
    }
  }

  function setWebPasteTarget(controller, enabled) {
    controller.pasteTargetsSelectedCard = Boolean(enabled)
    if (!controller.webview) return
    controller.webview.evaluateJavaScript(
      "window.__mnCardAskGPTPasteTarget=" +
        (enabled ? "true" : "false") +
        ";",
      function () {}
    )
  }

  function focusMarginNoteSelection(controller) {
    if (!controller) return false
    releaseWebFocus(controller)
    var context = selectedMindmapContext(controller)
    var hasTarget = Boolean(context && context.note)
    setWebPasteTarget(controller, hasTarget)
    if (!context) return false

    var responders = [
      context.selectedNode,
      context.mindmapView,
      context.notebookController,
      context.studyController
    ]
    for (var index = 0; index < responders.length; index++) {
      if (tryBecomeFirstResponder(responders[index])) return true
    }
    return false
  }

  function setCardSyncEnabled(controller, enabled) {
    controller.cardSyncEnabled = Boolean(enabled)
    updateCardSyncButton(controller)
    if (controller.cardSyncEnabled) {
      setWebPasteTarget(controller, false)
      return
    } else {
      cancelPendingCards(controller)
      focusMarginNoteSelection(controller)
    }
  }

  function setQuestionSettings(
    controller,
    questionModeEnabled,
    presetPrompt,
    autoSendEnabled
  ) {
    controller.questionModeEnabled = Boolean(questionModeEnabled)
    controller.presetPrompt = String(presetPrompt || "").replace(
      /^\s+|\s+$/g,
      ""
    )
    if (!controller.presetPrompt) {
      controller.presetPrompt = DEFAULT_PRESET_PROMPT
    }
    controller.autoSendEnabled = Boolean(autoSendEnabled)
    updateQuestionControls(controller)
  }

  function cancelPendingCards(controller) {
    controller.pendingPayloads = null
    if (controller.webview) {
      controller.webview.evaluateJavaScript(
        "window.__mnCardAskGPTRunToken='cancelled';",
        function () {}
      )
    }
  }

  function loadChatGPT(controller) {
    restorePersistentSession(controller)
    controller.isLoadingChat = true
    controller.chatURL = desiredChatURL(controller)
    controller.webview.loadRequest(
      NSURLRequest.requestWithURL(NSURL.URLWithString(controller.chatURL))
    )
  }

  function currentWebURL(controller) {
    try {
      return controller.webview.request.URL().absoluteString()
    } catch (error) {
      return ""
    }
  }

  function showPanel(controller) {
    if (!controller || !controller.view || !controller.webview) return
    controller.view.hidden = false
    controller.webview.hidden = false
    var currentURL = currentWebURL(controller)
    if (
      !/^https:\/\/(www\.)?chatgpt\.com\//i.test(currentURL) ||
      isTemporaryURL(currentURL) !==
        Boolean(controller.temporaryChatEnabled)
    ) {
      loadChatGPT(controller)
    }
  }

  function hidePanel(controller) {
    if (!controller || !controller.view) return
    savePersistentSession(controller)
    cancelPendingCards(controller)
    releaseWebFocus(controller)
    controller.view.hidden = true
  }

  function injectPendingCards(controller) {
    if (
      controller.pendingPayloads === undefined ||
      controller.pendingPayloads === null
    ) {
      return
    }
    var script = CardAskGPTBridge.makeInjection(
      controller.pendingPayloads,
      controller.temporaryChatEnabled,
      {
        mode: controller.questionModeEnabled ? "question" : "image",
        prompt: controller.presetPrompt,
        autoSend: controller.autoSendEnabled
      }
    )
    controller.webview.evaluateJavaScript(script, function () {})
  }

  function installClipboardBridge(controller) {
    if (!controller.webview) return
    controller.webview.evaluateJavaScript(
      CardAskGPTBridge.makeClipboardBridge(),
      function () {}
    )
  }

  function handleClipboardRequest(controller) {
    if (!controller.webview) return
    controller.webview.evaluateJavaScript(
      "(function(){var payload=window.__mnCardAskGPTClipboardPayload||null;" +
        "window.__mnCardAskGPTClipboardPayload=null;" +
        "return payload?JSON.stringify(payload):'';})()",
      function (result) {
        var serialized =
          result === undefined || result === null ? "" : String(result)
        if (!serialized) return
        var payload = null
        try {
          payload = JSON.parse(serialized)
        } catch (error) {
          payload = { plainText: serialized }
        }
        if (!payload) return

        var plainText = String(
          payload.plainText || payload.markdown || ""
        )
        var html = String(payload.html || "")
        var rtf = String(payload.rtf || "")
        var markdown = String(payload.markdown || "")
        if (!plainText && !html && !rtf && !markdown) return

        var pasteboard = UIPasteboard.generalPasteboard()
        var item = {}
        if (plainText) item["public.utf8-plain-text"] = plainText
        var htmlData = dataFromBase64(payload.htmlUtf8Base64)
        var rtfData = dataFromBase64(payload.rtfUtf8Base64)
        var markdownData = dataFromBase64(payload.markdownUtf8Base64)
        if (htmlData) {
          item["public.html"] = htmlData
        } else if (payload.htmlAscii) {
          item["public.html"] = String(payload.htmlAscii)
        }
        if (rtfData) item["public.rtf"] = rtfData
        if (markdownData) {
          item["net.daringfireball.markdown"] = markdownData
        }

        try {
          pasteboard.items = [item]
        } catch (error) {
          pasteboard.string = plainText || html || rtf || markdown
        }
        controller.lastClipboardPayload = payload
      }
    )
  }

  function estimatedHtmlCommentSize(plainText) {
    var text = String(plainText || "")
    var explicitLines = text.split(/\r?\n/).length
    var wrappedLines = Math.ceil(text.length / 32)
    var lines = Math.max(2, explicitLines, wrappedLines)
    return {
      width: 620,
      height: Math.max(100, Math.min(2600, lines * 28 + 56))
    }
  }

  function appendPayloadToSelectedCard(controller) {
    if (!controller || controller.cardSyncEnabled) return false
    var context = selectedMindmapContext(controller)
    var note = context && context.note
    var payload = controller.lastClipboardPayload
    if (!note || !payload) return false

    var plainText = String(payload.plainText || "")
    var html = String(payload.html || "")
    var markdown = String(payload.markdown || "")
    if (!plainText && !html && !markdown) return false

    var append = function () {
      if (html && typeof note.appendHtmlComment === "function") {
        note.appendHtmlComment(
          html,
          plainText,
          estimatedHtmlCommentSize(plainText),
          "cardaskgpt"
        )
      } else if (
        markdown &&
        typeof note.appendMarkdownComment === "function"
      ) {
        note.appendMarkdownComment(markdown)
      } else if (typeof note.appendTextComment === "function") {
        note.appendTextComment(plainText || markdown)
      } else {
        return false
      }
      return true
    }

    var appended = false
    try {
      UndoManager.sharedInstance().undoGrouping(
        "Paste ChatGPT Reply",
        note.notebookId,
        function () {
          appended = append()
        }
      )
    } catch (error) {
      appended = false
    }
    if (!appended) return false

    try {
      controller.app.refreshAfterDBChanged(note.notebookId)
    } catch (error) {}
    try {
      context.studyController.focusNoteInMindMapById(note.noteId)
    } catch (error) {}
    setWebPasteTarget(controller, false)
    return true
  }

  function enqueueCards(controller, payloads, showPanel) {
    controller.pendingPayloads = payloads
    if (showPanel !== false) {
      controller.view.hidden = false
      controller.webview.hidden = false
    }

    var currentURL = currentWebURL(controller)

    var currentIsTemporary = isTemporaryURL(currentURL)
    if (
      !/^https:\/\/(www\.)?chatgpt\.com\//i.test(currentURL) ||
      currentIsTemporary !== Boolean(controller.temporaryChatEnabled)
    ) {
      loadChatGPT(controller)
    } else {
      NSTimer.scheduledTimerWithTimeInterval(0.15, false, function () {
        injectPendingCards(controller)
      })
    }
  }

  function handleBridgeStatus(controller, url) {
    var codeMatch = /[?&]code=([^&]*)/.exec(url)
    var code = codeMatch ? decodeURIComponent(codeMatch[1]) : "failed"

    if (
      code === "uploaded" ||
      code === "prepared" ||
      code === "sent" ||
      code === "auto-send-failed" ||
      code === "selection-cleared"
    ) {
      controller.pendingPayloads = null
    }
  }

  var PanelClass = JSB.defineClass(
    "CardAskGPTPanel : UIViewController <UIWebViewDelegate>",
    {
      viewDidLoad: function () {
        self.app = Application.sharedInstance()
        self.pendingPayloads = null
        self.persistentSessionRestored = false
        self.lastSessionSavedAt = 0
        if (
          self.temporaryChatEnabled === undefined ||
          self.temporaryChatEnabled === null
        ) {
          self.temporaryChatEnabled = true
        }
        if (
          self.cardSyncEnabled === undefined ||
          self.cardSyncEnabled === null
        ) {
          self.cardSyncEnabled = true
        }
        if (
          self.questionModeEnabled === undefined ||
          self.questionModeEnabled === null
        ) {
          self.questionModeEnabled = false
        }
        if (!String(self.presetPrompt || "").replace(/^\s+|\s+$/g, "")) {
          self.presetPrompt = DEFAULT_PRESET_PROMPT
        }
        if (
          self.autoSendEnabled === undefined ||
          self.autoSendEnabled === null
        ) {
          self.autoSendEnabled = false
        }
        self.chatURL = desiredChatURL(self)
        self.isLoadingChat = false
        self._moveStartLocation = null
        self._moveStartFrame = null
        self._resizeStartLocation = null
        self._resizeStartFrame = null

        self.view.backgroundColor = UIColor.colorWithHexString("#eee9dc")
        self.view.autoresizingMask = 0
        self.view.layer.cornerRadius = 14
        self.view.layer.masksToBounds = true
        self.view.layer.shadowOffset = { width: 0, height: 1 }
        self.view.layer.shadowRadius = 12
        self.view.layer.shadowOpacity = 0.25

        self.webview = new UIWebView(self.view.bounds)
        self.webview.backgroundColor = UIColor.whiteColor()
        self.webview.scalesPageToFit = true
        self.webview.delegate = self
        self.webview.customUserAgent =
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
          "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
        self.webview.autoresizingMask = (1 << 1) | (1 << 4)
        self.view.addSubview(self.webview)

        self.titleButton = UIButton.buttonWithType(0)
        self.titleButton.setTitleForState("Card → ChatGPT", 0)
        self.titleButton.setTitleColorForState(
          UIColor.colorWithHexString("#4f4a41"),
          0
        )
        self.titleButton.titleLabel.font = UIFont.boldSystemFontOfSize(13)
        self.titleButton.userInteractionEnabled = false
        self.view.addSubview(self.titleButton)

        self.dragRegion = new UIView({ x: 0, y: 0, width: 200, height: 36 })
        self.dragRegion.backgroundColor = UIColor.clearColor()
        self.dragRegion.userInteractionEnabled = true
        var movePan = new UIPanGestureRecognizer(self, "handleMove:")
        self.dragRegion.addGestureRecognizer(movePan)
        self.view.addSubview(self.dragRegion)

        self.cardSyncButton = UIButton.buttonWithType(0)
        self.cardSyncButton.addTargetActionForControlEvents(
          self,
          "toggleCardSync:",
          1 << 6
        )
        self.cardSyncButton.titleLabel.font = UIFont.boldSystemFontOfSize(14)
        self.cardSyncButton.layer.cornerRadius = 12
        self.cardSyncButton.layer.borderWidth = 1
        self.cardSyncButton.layer.borderColor =
          UIColor.colorWithHexString("#c7bfae")
        self.cardSyncButton.layer.shadowOffset = { width: 0, height: 2 }
        self.cardSyncButton.layer.shadowRadius = 5
        self.cardSyncButton.layer.shadowOpacity = 0.24
        self.view.addSubview(self.cardSyncButton)

        self.questionModeButton = UIButton.buttonWithType(0)
        self.questionModeButton.addTargetActionForControlEvents(
          self,
          "toggleQuestionMode:",
          1 << 6
        )
        self.questionModeButton.titleLabel.font =
          UIFont.boldSystemFontOfSize(13)
        self.questionModeButton.layer.cornerRadius = 11
        self.questionModeButton.layer.borderWidth = 1
        self.questionModeButton.layer.borderColor =
          UIColor.colorWithHexString("#c7bfae")
        self.questionModeButton.layer.shadowOffset = { width: 0, height: 2 }
        self.questionModeButton.layer.shadowRadius = 4
        self.questionModeButton.layer.shadowOpacity = 0.18
        self.view.addSubview(self.questionModeButton)

        self.questionSettingsButton = UIButton.buttonWithType(0)
        self.questionSettingsButton.addTargetActionForControlEvents(
          self,
          "editPresetPrompt:",
          1 << 6
        )
        self.questionSettingsButton.titleLabel.font =
          UIFont.boldSystemFontOfSize(12)
        self.questionSettingsButton.layer.cornerRadius = 10
        self.questionSettingsButton.layer.borderWidth = 1
        self.questionSettingsButton.layer.borderColor =
          UIColor.colorWithHexString("#c7bfae")
        self.questionSettingsButton.layer.shadowOffset = {
          width: 0,
          height: 2
        }
        self.questionSettingsButton.layer.shadowRadius = 4
        self.questionSettingsButton.layer.shadowOpacity = 0.16
        self.view.addSubview(self.questionSettingsButton)

        self.temporaryButton = UIButton.buttonWithType(0)
        self.temporaryButton.addTargetActionForControlEvents(
          self,
          "toggleTemporary:",
          1 << 6
        )
        self.temporaryButton.titleLabel.font = UIFont.systemFontOfSize(12)
        self.temporaryButton.layer.cornerRadius = 7
        self.view.addSubview(self.temporaryButton)

        self.reloadButton = UIButton.buttonWithType(0)
        self.reloadButton.setTitleForState("↻", 0)
        self.reloadButton.setTitleColorForState(
          UIColor.colorWithHexString("#4f4a41"),
          0
        )
        self.reloadButton.titleLabel.font = UIFont.systemFontOfSize(20)
        self.reloadButton.addTargetActionForControlEvents(
          self,
          "reloadChatGPT:",
          1 << 6
        )
        self.view.addSubview(self.reloadButton)

        self.closeButton = UIButton.buttonWithType(0)
        self.closeButton.setTitleForState("×", 0)
        self.closeButton.setTitleColorForState(
          UIColor.colorWithHexString("#4f4a41"),
          0
        )
        self.closeButton.titleLabel.font = UIFont.systemFontOfSize(21)
        self.closeButton.addTargetActionForControlEvents(
          self,
          "closePanel:",
          1 << 6
        )
        self.view.addSubview(self.closeButton)

        self.resizeHandle = new UIView({
          x: 0,
          y: 0,
          width: 44,
          height: 44
        })
        self.resizeHandle.backgroundColor = UIColor.clearColor()
        self.resizeHandle.userInteractionEnabled = true

        self.resizeArcClip = new UIView({
          x: 18,
          y: 18,
          width: 20,
          height: 20
        })
        self.resizeArcClip.backgroundColor = UIColor.clearColor()
        self.resizeArcClip.layer.masksToBounds = true
        self.resizeArcClip.userInteractionEnabled = false

        self.resizeArc = new UIView({
          x: -16,
          y: -16,
          width: 34,
          height: 34
        })
        self.resizeArc.backgroundColor = UIColor.clearColor()
        self.resizeArc.layer.cornerRadius = 17
        self.resizeArc.layer.borderWidth = 3
        self.resizeArc.layer.borderColor =
          UIColor.colorWithHexString("#4f4a41")
        self.resizeArc.userInteractionEnabled = false
        self.resizeArcClip.addSubview(self.resizeArc)
        self.resizeHandle.addSubview(self.resizeArcClip)

        var resizePan = new UIPanGestureRecognizer(self, "handleResize:")
        self.resizeHandle.addGestureRecognizer(resizePan)
        self.view.addSubview(self.resizeHandle)

        self.promptEditorOverlay = new UIView(self.view.bounds)
        self.promptEditorOverlay.backgroundColor =
          UIColor.colorWithHexString("#d6d1c7")
        self.promptEditorOverlay.hidden = true
        self.promptEditorOverlay.userInteractionEnabled = true

        self.promptEditorCard = new UIView({
          x: 0,
          y: 0,
          width: 340,
          height: 260
        })
        self.promptEditorCard.backgroundColor = UIColor.whiteColor()
        self.promptEditorCard.layer.cornerRadius = 14
        self.promptEditorCard.layer.shadowOffset = { width: 0, height: 4 }
        self.promptEditorCard.layer.shadowRadius = 12
        self.promptEditorCard.layer.shadowOpacity = 0.24
        self.promptEditorOverlay.addSubview(self.promptEditorCard)

        self.promptEditorTitle = new UILabel({
          x: 14,
          y: 8,
          width: 312,
          height: 30
        })
        self.promptEditorTitle.text = "预设提示词"
        self.promptEditorTitle.textColor =
          UIColor.colorWithHexString("#3f3a33")
        self.promptEditorTitle.font = UIFont.boldSystemFontOfSize(16)
        self.promptEditorCard.addSubview(self.promptEditorTitle)

        self.promptTextView = UITextView.new()
        self.promptTextView.frame = {
          x: 14,
          y: 42,
          width: 312,
          height: 150
        }
        self.promptTextView.backgroundColor =
          UIColor.colorWithHexString("#f6f4ef")
        self.promptTextView.textColor = UIColor.colorWithHexString("#282520")
        self.promptTextView.font = UIFont.systemFontOfSize(15)
        self.promptTextView.layer.cornerRadius = 9
        self.promptTextView.layer.borderWidth = 1
        self.promptTextView.layer.borderColor =
          UIColor.colorWithHexString("#d4cec1")
        self.promptEditorCard.addSubview(self.promptTextView)

        self.promptAutoSendButton = UIButton.buttonWithType(0)
        self.promptAutoSendButton.addTargetActionForControlEvents(
          self,
          "toggleDraftAutoSend:",
          1 << 6
        )
        self.promptAutoSendButton.titleLabel.font =
          UIFont.boldSystemFontOfSize(13)
        self.promptAutoSendButton.layer.cornerRadius = 9
        self.promptEditorCard.addSubview(self.promptAutoSendButton)

        self.promptCancelButton = UIButton.buttonWithType(0)
        self.promptCancelButton.setTitleForState("取消", 0)
        self.promptCancelButton.setTitleColorForState(
          UIColor.colorWithHexString("#5b564d"),
          0
        )
        self.promptCancelButton.backgroundColor =
          UIColor.colorWithHexString("#e9e5dc")
        self.promptCancelButton.titleLabel.font =
          UIFont.boldSystemFontOfSize(13)
        self.promptCancelButton.layer.cornerRadius = 9
        self.promptCancelButton.addTargetActionForControlEvents(
          self,
          "cancelPromptEditor:",
          1 << 6
        )
        self.promptEditorCard.addSubview(self.promptCancelButton)

        self.promptSaveButton = UIButton.buttonWithType(0)
        self.promptSaveButton.setTitleForState("保存", 0)
        self.promptSaveButton.setTitleColorForState(UIColor.whiteColor(), 0)
        self.promptSaveButton.backgroundColor =
          UIColor.colorWithHexString("#426b97")
        self.promptSaveButton.titleLabel.font =
          UIFont.boldSystemFontOfSize(13)
        self.promptSaveButton.layer.cornerRadius = 9
        self.promptSaveButton.addTargetActionForControlEvents(
          self,
          "savePromptEditor:",
          1 << 6
        )
        self.promptEditorCard.addSubview(self.promptSaveButton)
        self.view.addSubview(self.promptEditorOverlay)

        sharedCookieStorage()
        restorePersistentSession(self)
        self.sessionSaveTimer = NSTimer.scheduledTimerWithTimeInterval(
          SESSION_SAVE_INTERVAL,
          true,
          function () {
            savePersistentSession(self)
          }
        )

        updateTemporaryButton(self)
        updateCardSyncButton(self)
        updateQuestionControls(self)
        layoutSubviews(self)
      },

      viewWillLayoutSubviews: function () {
        layoutSubviews(self)
      },

      handleMove: function (gesture) {
        if (!self.view || !self.view.superview) return
        if (gesture.state === 1) {
          self._moveStartLocation = gesture.locationInView(self.view.superview)
          self._moveStartFrame = self.view.frame
          return
        }
        if (gesture.state === 3 || gesture.state === 4) {
          savePanelFrame(self)
          self._moveStartLocation = null
          self._moveStartFrame = null
          return
        }
        if (
          gesture.state !== 2 ||
          !self._moveStartLocation ||
          !self._moveStartFrame
        ) {
          return
        }
        var location = gesture.locationInView(self.view.superview)
        var dx = location.x - self._moveStartLocation.x
        var dy = location.y - self._moveStartLocation.y
        var frame = normalizePanelFrame(
          {
            x: self._moveStartFrame.x + dx,
            y: self._moveStartFrame.y + dy,
            width: self._moveStartFrame.width,
            height: self._moveStartFrame.height
          },
          self.view.superview.bounds
        )
        self.view.frame = frame
        self._preferredFrame = frame
      },

      handleResize: function (gesture) {
        if (!self.view || !self.view.superview) return
        if (gesture.state === 1) {
          self._resizeStartLocation = gesture.locationInView(
            self.view.superview
          )
          self._resizeStartFrame = self.view.frame
          return
        }
        if (gesture.state === 3 || gesture.state === 4) {
          savePanelFrame(self)
          self._resizeStartLocation = null
          self._resizeStartFrame = null
          return
        }
        if (
          gesture.state !== 2 ||
          !self._resizeStartLocation ||
          !self._resizeStartFrame
        ) {
          return
        }
        var location = gesture.locationInView(self.view.superview)
        var dx = location.x - self._resizeStartLocation.x
        var dy = location.y - self._resizeStartLocation.y
        var bounds = self.view.superview.bounds
        var rightEdge = bounds.x + bounds.width - 8
        var bottomEdge = bounds.y + bounds.height - 8
        var maximumWidth = Math.max(
          1,
          rightEdge - self._resizeStartFrame.x
        )
        var maximumHeight = Math.max(
          1,
          bottomEdge - self._resizeStartFrame.y
        )
        var minimumWidth = Math.min(PANEL_MIN_WIDTH, maximumWidth)
        var minimumHeight = Math.min(PANEL_MIN_HEIGHT, maximumHeight)
        var width = clampNumber(
          self._resizeStartFrame.width + dx,
          minimumWidth,
          maximumWidth
        )
        var height = clampNumber(
          self._resizeStartFrame.height + dy,
          minimumHeight,
          maximumHeight
        )
        var frame = {
          x: self._resizeStartFrame.x,
          y: self._resizeStartFrame.y,
          width: width,
          height: height
        }
        self.view.frame = frame
        self._preferredFrame = frame
        layoutSubviews(self)
      },

      toggleTemporary: function () {
        self.temporaryChatEnabled = !self.temporaryChatEnabled
        NSUserDefaults.standardUserDefaults().setObjectForKey(
          self.temporaryChatEnabled,
          "CardAskGPT_TemporaryChat"
        )
        updateTemporaryButton(self)
        cancelPendingCards(self)
        loadChatGPT(self)
      },

      toggleCardSync: function () {
        var enabled = !self.cardSyncEnabled
        setCardSyncEnabled(self, enabled)
        NSUserDefaults.standardUserDefaults().setObjectForKey(
          enabled,
          "CardAskGPT_CardSyncEnabled"
        )
        if (self.hostExtension) {
          self.hostExtension.cardSyncEnabled = enabled
        }
      },

      toggleQuestionMode: function () {
        self.questionModeEnabled = !self.questionModeEnabled
        NSUserDefaults.standardUserDefaults().setObjectForKey(
          self.questionModeEnabled,
          QUESTION_MODE_DEFAULTS_KEY
        )
        if (self.hostExtension) {
          self.hostExtension.questionModeEnabled = self.questionModeEnabled
        }
        updateQuestionControls(self)
      },

      editPresetPrompt: function () {
        self.draftAutoSendEnabled = Boolean(self.autoSendEnabled)
        self.promptTextView.text =
          self.presetPrompt || DEFAULT_PRESET_PROMPT
        updatePromptEditorAutoSendButton(self)
        self.promptEditorOverlay.hidden = false
        try {
          self.view.bringSubviewToFront(self.promptEditorOverlay)
        } catch (error) {}
        try {
          self.promptTextView.becomeFirstResponder()
        } catch (error) {}
      },

      toggleDraftAutoSend: function () {
        self.draftAutoSendEnabled = !self.draftAutoSendEnabled
        updatePromptEditorAutoSendButton(self)
      },

      cancelPromptEditor: function () {
        try {
          self.promptTextView.resignFirstResponder()
        } catch (error) {}
        self.promptEditorOverlay.hidden = true
      },

      savePromptEditor: function () {
        var prompt = String(self.promptTextView.text || "").replace(
          /^\s+|\s+$/g,
          ""
        )
        if (!prompt) prompt = DEFAULT_PRESET_PROMPT
        self.presetPrompt = prompt
        self.autoSendEnabled = Boolean(self.draftAutoSendEnabled)
        var defaults = NSUserDefaults.standardUserDefaults()
        defaults.setObjectForKey(
          self.presetPrompt,
          PRESET_PROMPT_DEFAULTS_KEY
        )
        defaults.setObjectForKey(
          self.autoSendEnabled,
          AUTO_SEND_DEFAULTS_KEY
        )
        if (defaults.synchronize) defaults.synchronize()
        if (self.hostExtension) {
          self.hostExtension.presetPrompt = self.presetPrompt
          self.hostExtension.autoSendEnabled = self.autoSendEnabled
        }
        try {
          self.promptTextView.resignFirstResponder()
        } catch (error) {}
        self.promptEditorOverlay.hidden = true
        updateQuestionControls(self)
      },

      reloadChatGPT: function () {
        loadChatGPT(self)
      },

      closePanel: function () {
        hidePanel(self)
      },

      webViewDidStartLoad: function () {
        self.isLoadingChat = true
      },

      webViewDidFinishLoad: function (webView) {
        self.isLoadingChat = false
        savePersistentSession(self)
        installClipboardBridge(self)
        var currentURL = ""
        try {
          currentURL = webView.request.URL().absoluteString()
        } catch (error) {
          currentURL = ""
        }
        if (
          self.pendingPayloads !== null &&
          self.pendingPayloads !== undefined &&
          /^https:\/\/(www\.)?chatgpt\.com\//i.test(currentURL)
        ) {
          NSTimer.scheduledTimerWithTimeInterval(0.8, false, function () {
            injectPendingCards(self)
          })
        }
      },

      webViewDidFailLoadWithError: function (webView, error) {
        self.isLoadingChat = false
      },

      webViewShouldStartLoadWithRequestNavigationType: function (
        webView,
        request
      ) {
        var url = request.URL().absoluteString()
        if (/^cardaskgpt:\/\/clipboard/i.test(url)) {
          handleClipboardRequest(self)
          return false
        }
        if (/^cardaskgpt:\/\/paste-card/i.test(url)) {
          appendPayloadToSelectedCard(self)
          return false
        }
        if (/^cardaskgpt:\/\/web-focus/i.test(url)) {
          setWebPasteTarget(self, false)
          return false
        }
        if (/^cardaskgpt:\/\/status/i.test(url)) {
          handleBridgeStatus(self, url)
          return false
        }
        return true
      }
    }
  )

  return {
    create: function () {
      return PanelClass.new()
    },
    layoutDocked: layoutDocked,
    normalizePanelFrame: normalizePanelFrame,
    savePanelFrame: savePanelFrame,
    desiredChatURL: desiredChatURL,
    isTemporaryURL: isTemporaryURL,
    setTemporaryChatEnabled: setTemporaryChatEnabled,
    setCardSyncEnabled: setCardSyncEnabled,
    setQuestionSettings: setQuestionSettings,
    savePersistentSession: savePersistentSession,
    restorePersistentSession: restorePersistentSession,
    releaseWebFocus: releaseWebFocus,
    focusMarginNoteSelection: focusMarginNoteSelection,
    appendPayloadToSelectedCard: appendPayloadToSelectedCard,
    showPanel: showPanel,
    hidePanel: hidePanel,
    installClipboardBridge: installClipboardBridge,
    handleClipboardRequest: handleClipboardRequest,
    enqueueCards: enqueueCards,
    cancelPendingCard: cancelPendingCards,
    cancelPendingCards: cancelPendingCards
  }
})()
