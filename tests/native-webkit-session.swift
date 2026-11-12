// Optional macOS integration check. This uses an isolated test data store and
// synthetic .invalid cookies, never MarginNote or ChatGPT account credentials.
import Foundation
import WebKit

let fixtureID = UUID(uuidString: "EB5173E7-43A6-41BD-8C54-297648CF4A20")!
let fixtureDomain = "cardaskgpt-session.invalid"
let mode = CommandLine.arguments.dropFirst().first ?? "read"
var completed = false
var failed = false

func finish(_ message: String, failure: Bool = false) {
    print(message)
    failed = failure
    completed = true
}

if #available(macOS 14.0, *) {
    if mode == "clean" {
        // Initialize WebKit's networking run loop before calling its class-only
        // removal API from this command-line process (no NSApplication exists).
        let bootstrap = WKWebsiteDataStore.nonPersistent()
        bootstrap.httpCookieStore.getAllCookies { _ in
            WKWebsiteDataStore.remove(forIdentifier: fixtureID) { error in
                _ = bootstrap.isPersistent
                finish(error == nil ? "Isolated WebKit fixture removed." : "Fixture cleanup failed.", failure: error != nil)
            }
        }
    } else {
        let store = WKWebsiteDataStore(forIdentifier: fixtureID)
        if mode == "write" {
            let cookie = HTTPCookie(properties: [
                .domain: fixtureDomain,
                .path: "/",
                .name: "fixture-session",
                .value: "synthetic-test-value",
                .secure: "TRUE",
                HTTPCookiePropertyKey("HttpOnly"): "TRUE",
                .expires: Date(timeIntervalSinceNow: 3600)
            ])!
            store.httpCookieStore.setCookie(cookie) {
                store.httpCookieStore.getAllCookies { cookies in
                    let webCookies = cookies.filter { $0.domain == fixtureDomain }
                    let foundationCookies = (HTTPCookieStorage.shared.cookies ?? []).filter { $0.domain == fixtureDomain }
                    let passed = store.isPersistent && webCookies.count == 1 && foundationCookies.isEmpty
                    finish("write: persistent=\(store.isPersistent), WebKit fixture cookies=\(webCookies.count), Foundation fixture cookies=\(foundationCookies.count)", failure: !passed)
                }
            }
        } else {
            store.httpCookieStore.getAllCookies { cookies in
                let survived = cookies.contains { $0.domain == fixtureDomain && $0.name == "fixture-session" }
                finish("read in new process: fixture cookie survived=\(survived)", failure: !survived)
            }
        }
    }
    let deadline = Date(timeIntervalSinceNow: 20)
    while !completed && Date() < deadline {
        RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.05))
    }
    if !completed { finish("WebKit fixture timed out.", failure: true) }
} else {
    finish("This optional integration check requires macOS 14 or later.", failure: true)
}
exit(failed ? 1 : 0)
