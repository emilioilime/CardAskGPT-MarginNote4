const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "..")
const panelSource = fs.readFileSync(
  path.join(root, "src", "panel.js"),
  "utf8"
)
const mainSource = fs.readFileSync(path.join(root, "src", "main.js"), "utf8")

assert.match(panelSource, /NSHTTPCookieStorage\.sharedHTTPCookieStorage/)
assert.match(panelSource, /storage\.cookieAcceptPolicy = 0/)
assert.match(panelSource, /function savePersistentSession/)
assert.match(panelSource, /function restorePersistentSession/)
assert.match(panelSource, /SSKeychain\.setPasswordForServiceAccount/)
assert.match(panelSource, /SSKeychain\.passwordForServiceAccount/)
assert.match(panelSource, /SSKeychain\.deletePasswordForServiceAccount/)
assert.match(panelSource, /NSKeyedArchiver\.archivedDataWithRootObject/)
assert.match(panelSource, /NSKeyedUnarchiver\.unarchiveObjectWithData/)
assert.match(panelSource, /SESSION_SAVE_INTERVAL = 45/)
assert.match(
  panelSource,
  /webViewDidFinishLoad:[\s\S]*?savePersistentSession\(self\)/
)
assert.match(
  mainSource,
  /sceneDidDisconnect:[\s\S]*?savePersistentSession\(self\.panel\)/
)

const chatCookie = {
  domain: ".chatgpt.com",
  name: "__Secure-session",
  value: "session-value"
}
const authCookie = {
  domain: "auth.openai.com",
  name: "auth-cookie",
  value: "auth-value"
}
const unrelatedCookie = {
  domain: ".example.com",
  name: "unrelated",
  value: "ignore"
}

let storageCookies = [chatCookie, authCookie, unrelatedCookie]
let restoredCookies = []
let archivedCookies = []
let keychainLocked = false
let failCookieWrite = false
let members
const keychain = new Map()

function nativeArray(items) {
  return {
    items,
    count() {
      return this.items.length
    },
    objectAtIndex(index) {
      return this.items[index]
    },
    addObject(item) {
      this.items.push(item)
    }
  }
}

const context = {
  UIColor: {
    colorWithHexString(value) {
      return value
    }
  },
  JSB: {
    defineClass(name, methods) {
      members = methods
      return {
        new() {
          return {}
        }
      }
    }
  },
  NSHTTPCookieStorage: {
    sharedHTTPCookieStorage() {
      return {
        get cookies() {
          return nativeArray(storageCookies)
        },
        set cookieAcceptPolicy(value) {
          this.acceptPolicy = value
        },
        setCookie(cookie) {
          if (failCookieWrite) throw new Error("temporarily unavailable")
          restoredCookies.push(cookie)
        }
      }
    }
  },
  NSMutableArray: {
    array() {
      return nativeArray([])
    }
  },
  NSKeyedArchiver: {
    archivedDataWithRootObject(value) {
      archivedCookies = value.items.slice()
      return {
        base64Encoding() {
          return "ARCHIVED-COOKIE-DATA"
        }
      }
    }
  },
  NSKeyedUnarchiver: {
    unarchiveObjectWithData() {
      return nativeArray(archivedCookies.slice())
    }
  },
  NSData: {
    alloc() {
      return {
        initWithBase64EncodedStringOptions(value) {
          return value ? { encoded: value } : null
        }
      }
    }
  },
  SSKeychain: {
    setPasswordForServiceAccount(value, service, account) {
      keychain.set(`${service}:${account}`, value)
      return true
    },
    passwordForServiceAccount(service, account) {
      if (keychainLocked) return ""
      return keychain.get(`${service}:${account}`) || ""
    },
    deletePasswordForServiceAccount(service, account) {
      keychain.delete(`${service}:${account}`)
      return true
    }
  }
}

vm.createContext(context)
vm.runInContext(panelSource, context)

const saved = context.CardAskGPTPanelAPI.savePersistentSession({})
assert.equal(saved, true)
assert.deepEqual(
  archivedCookies.map((cookie) => cookie.domain),
  [".chatgpt.com", "auth.openai.com"]
)
assert.equal(keychain.size, 1)

storageCookies = []
const restored = context.CardAskGPTPanelAPI.restorePersistentSession({
  persistentSessionRestored: false
})
assert.equal(restored, true)
assert.deepEqual(
  restoredCookies.map((cookie) => cookie.domain),
  [".chatgpt.com", "auth.openai.com"]
)

storageCookies = []
context.CardAskGPTPanelAPI.savePersistentSession({})
assert.equal(keychain.size, 1, "an empty Foundation store must not erase WebKit's backup")

const retryController = { persistentSessionRestored: false }
keychainLocked = true
assert.equal(context.CardAskGPTPanelAPI.restorePersistentSession(retryController), false)
assert.equal(retryController.persistentSessionRestored, false)
keychainLocked = false
failCookieWrite = true
assert.equal(context.CardAskGPTPanelAPI.restorePersistentSession(retryController), false)
assert.equal(retryController.persistentSessionRestored, false)
failCookieWrite = false
assert.equal(context.CardAskGPTPanelAPI.restorePersistentSession(retryController), true)
assert.equal(retryController.persistentSessionRestored, true)

restoredCookies = []
storageCookies = [{ ...chatCookie, value: "newer-rotated-session" }]
assert.equal(context.CardAskGPTPanelAPI.restorePersistentSession({}), true)
assert.equal(restoredCookies.length, 0, "do not overwrite an existing, newer browser session")

storageCookies = [
  chatCookie,
  { ...authCookie, expiresDate: { timeIntervalSince1970: () => 1 } },
  { ...authCookie, domain: "chatgpt.com.attacker.invalid" },
  unrelatedCookie
]
assert.equal(context.CardAskGPTPanelAPI.savePersistentSession({}), true)
assert.deepEqual(archivedCookies.map((cookie) => cookie.domain), [".chatgpt.com"])

// An explicit sign-out must not be undone by restoring a previous backup.
const signedOut = {}
context.self = signedOut
const navigation = (url) => members.webViewShouldStartLoadWithRequestNavigationType(
  null, { URL: () => ({ absoluteString: () => url }) }
)
navigation("https://example.invalid/logout")
assert.equal(keychain.size, 1)
navigation("https://chatgpt.com/auth/logout")
assert.equal(keychain.size, 0)
assert.equal(context.CardAskGPTPanelAPI.savePersistentSession(signedOut), false)
assert.equal(context.CardAskGPTPanelAPI.restorePersistentSession(signedOut), false)

// MarginNote's plugin API may omit these native classes entirely. Previous
// tests supplied mocks unconditionally, masking that unsupported path.
delete context.NSHTTPCookieStorage
delete context.SSKeychain
assert.equal(context.CardAskGPTPanelAPI.savePersistentSession({}), false)
assert.equal(context.CardAskGPTPanelAPI.restorePersistentSession({}), false)

console.log("Persistent ChatGPT session test passed.")
