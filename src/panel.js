var CardAskGPTPanelAPI = (function () {
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

  function layoutSubviews(controller) {
    var bounds = controller.view.bounds
    var toolbarHeight = 36
    controller.titleButton.frame = {
      x: 10,
      y: 2,
      width: Math.max(120, bounds.width - 230),
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
  }

  function layoutDocked(controller) {
    if (!controller.hostExtension || !controller.hostExtension.window) return
    var studyController = controller.app.studyController(
      controller.hostExtension.window
    )
    var bounds = studyController.view.bounds
    var preferredWidth = controller.app.osType === 2 ? 460 : 420
    var width = Math.min(
      preferredWidth,
      Math.max(350, bounds.width * 0.44)
    )
    controller.view.frame = {
      x: bounds.width - width - 10,
      y: 8,
      width: width,
      height: bounds.height - 16
    }
    layoutSubviews(controller)
  }

  function setTemporaryChatEnabled(controller, enabled) {
    controller.temporaryChatEnabled = Boolean(enabled)
    updateTemporaryButton(controller)
  }

  function cancelPendingCard(controller) {
    controller.pendingPayload = null
    if (controller.webview) {
      controller.webview.evaluateJavaScript(
        "window.__mnCardAskGPTRunToken='cancelled';",
        function () {}
      )
    }
  }

  function loadChatGPT(controller) {
    controller.isLoadingChat = true
    controller.webview.loadRequest(
      NSURLRequest.requestWithURL(NSURL.URLWithString(controller.chatURL))
    )
  }

  function injectPendingCard(controller) {
    if (!controller.pendingPayload) return
    var script = CardAskGPTBridge.makeInjection(
      controller.pendingPayload,
      controller.temporaryChatEnabled
    )
    controller.webview.evaluateJavaScript(script, function (result) {
      if (result !== "started" && result !== undefined && result !== null) {
        controller.app.showHUD(
          "ChatGPT 页面注入未启动：" + String(result),
          controller.view.window,
          2
        )
      }
    })
  }

  function enqueueCard(controller, payload) {
    controller.pendingPayload = payload
    controller.view.hidden = false
    controller.webview.hidden = false

    var currentURL = ""
    try {
      currentURL = controller.webview.request.URL().absoluteString()
    } catch (error) {
      currentURL = ""
    }

    if (!/^https:\/\/(www\.)?chatgpt\.com\//i.test(currentURL)) {
      loadChatGPT(controller)
    } else {
      NSTimer.scheduledTimerWithTimeInterval(0.15, false, function () {
        injectPendingCard(controller)
      })
    }
  }

  function handleBridgeStatus(controller, url) {
    var codeMatch = /[?&]code=([^&]*)/.exec(url)
    var detailMatch = /[?&]detail=([^&]*)/.exec(url)
    var code = codeMatch ? decodeURIComponent(codeMatch[1]) : "failed"
    var detail = detailMatch ? decodeURIComponent(detailMatch[1]) : ""

    if (code === "uploaded") {
      controller.pendingPayload = null
      var temporaryStatus = detail.split("|")[1] || ""
      var suffix =
        controller.temporaryChatEnabled && temporaryStatus === "not-found"
          ? "；未找到“临时聊天”按钮，请在网页中手动开启"
          : ""
      controller.app.showHUD(
        "卡片图片已放入 ChatGPT 输入框" + suffix,
        controller.view.window,
        suffix ? 3 : 1.6
      )
    } else if (code === "login-required") {
      controller.app.showHUD(
        "请先在右侧网页登录 ChatGPT，登录后再次点击卡片",
        controller.view.window,
        4
      )
    } else if (code === "render-failed") {
      controller.app.showHUD(
        "卡片图片生成失败：" + detail,
        controller.view.window,
        3
      )
    } else if (code === "upload-failed") {
      controller.app.showHUD(
        "ChatGPT 页面拒绝自动附图：" + detail,
        controller.view.window,
        4
      )
    } else {
      controller.app.showHUD(
        "发送卡片时发生错误：" + detail,
        controller.view.window,
        4
      )
    }
  }

  var PanelClass = JSB.defineClass(
    "CardAskGPTPanel : UIViewController <UIWebViewDelegate>",
    {
      viewDidLoad: function () {
        self.app = Application.sharedInstance()
        self.pendingPayload = null
        if (
          self.temporaryChatEnabled === undefined ||
          self.temporaryChatEnabled === null
        ) {
          self.temporaryChatEnabled = true
        }
        self.chatURL = "https://chatgpt.com/"
        self.isLoadingChat = false

        self.view.backgroundColor = UIColor.colorWithHexString("#eee9dc")
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
        self.view.addSubview(self.titleButton)

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

        updateTemporaryButton(self)
        layoutSubviews(self)
      },

      viewWillLayoutSubviews: function () {
        layoutSubviews(self)
      },

      toggleTemporary: function () {
        self.temporaryChatEnabled = !self.temporaryChatEnabled
        NSUserDefaults.standardUserDefaults().setObjectForKey(
          self.temporaryChatEnabled,
          "CardAskGPT_TemporaryChat"
        )
        updateTemporaryButton(self)
        self.app.showHUD(
          self.temporaryChatEnabled
            ? "临时聊天默认开启"
            : "临时聊天默认关闭",
          self.view.window,
          1.5
        )
      },

      reloadChatGPT: function () {
        self.webview.reload()
      },

      closePanel: function () {
        cancelPendingCard(self)
        self.view.hidden = true
      },

      webViewDidStartLoad: function () {
        self.isLoadingChat = true
      },

      webViewDidFinishLoad: function (webView) {
        self.isLoadingChat = false
        var currentURL = ""
        try {
          currentURL = webView.request.URL().absoluteString()
        } catch (error) {
          currentURL = ""
        }
        if (
          self.pendingPayload &&
          /^https:\/\/(www\.)?chatgpt\.com\//i.test(currentURL)
        ) {
          NSTimer.scheduledTimerWithTimeInterval(0.8, false, function () {
            injectPendingCard(self)
          })
        }
      },

      webViewDidFailLoadWithError: function (webView, error) {
        self.isLoadingChat = false
        var message = error && error.localizedDescription
        if (message) {
          self.app.showHUD(
            "ChatGPT 网页加载失败：" + String(message),
            self.view.window,
            3
          )
        }
      },

      webViewShouldStartLoadWithRequestNavigationType: function (
        webView,
        request
      ) {
        var url = request.URL().absoluteString()
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
    setTemporaryChatEnabled: setTemporaryChatEnabled,
    enqueueCard: enqueueCard,
    cancelPendingCard: cancelPendingCard
  }
})()
