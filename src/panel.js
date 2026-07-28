var CardAskGPTPanelAPI = (function () {
  var PANEL_MIN_WIDTH = 350
  var PANEL_MIN_HEIGHT = 280
  var PANEL_FRAME_X_KEY = "CardAskGPT_PanelX"
  var PANEL_FRAME_Y_KEY = "CardAskGPT_PanelY"
  var PANEL_FRAME_WIDTH_KEY = "CardAskGPT_PanelWidth"
  var PANEL_FRAME_HEIGHT_KEY = "CardAskGPT_PanelHeight"

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
    controller.isLoadingChat = true
    controller.chatURL = desiredChatURL(controller)
    controller.webview.loadRequest(
      NSURLRequest.requestWithURL(NSURL.URLWithString(controller.chatURL))
    )
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
      controller.temporaryChatEnabled
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
        if (html) item["public.html"] = html
        if (rtf) item["public.rtf"] = rtf
        if (markdown) item["net.daringfireball.markdown"] = markdown

        try {
          pasteboard.items = [item]
        } catch (error) {
          pasteboard.string = plainText || html || rtf || markdown
        }
      }
    )
  }

  function enqueueCards(controller, payloads, showPanel) {
    controller.pendingPayloads = payloads
    if (showPanel !== false) {
      controller.view.hidden = false
      controller.webview.hidden = false
    }

    var currentURL = ""
    try {
      currentURL = controller.webview.request.URL().absoluteString()
    } catch (error) {
      currentURL = ""
    }

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

    if (code === "uploaded" || code === "selection-cleared") {
      controller.pendingPayloads = null
    }
  }

  var PanelClass = JSB.defineClass(
    "CardAskGPTPanel : UIViewController <UIWebViewDelegate>",
    {
      viewDidLoad: function () {
        self.app = Application.sharedInstance()
        self.pendingPayloads = null
        if (
          self.temporaryChatEnabled === undefined ||
          self.temporaryChatEnabled === null
        ) {
          self.temporaryChatEnabled = true
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

        updateTemporaryButton(self)
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

      reloadChatGPT: function () {
        loadChatGPT(self)
      },

      closePanel: function () {
        cancelPendingCards(self)
        self.view.hidden = true
      },

      webViewDidStartLoad: function () {
        self.isLoadingChat = true
      },

      webViewDidFinishLoad: function (webView) {
        self.isLoadingChat = false
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
    installClipboardBridge: installClipboardBridge,
    handleClipboardRequest: handleClipboardRequest,
    enqueueCards: enqueueCards,
    cancelPendingCard: cancelPendingCards,
    cancelPendingCards: cancelPendingCards
  }
})()
