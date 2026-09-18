import UIKit
import Capacitor

/// iOS edge-swipe-back gesture (Build 10 remediation).
///
/// Capacitor's default `CAPBridgeViewController` (wired up in Main.storyboard
/// before this file existed) never enables `WKWebView`'s own
/// `allowsBackForwardNavigationGestures` — the standard "swipe from the left
/// edge to go back" gesture users expect. The app's web/React Router side
/// already uses a real `BrowserRouter` (genuine `pushState` history entries),
/// so the gesture is safe to enable in general: WKWebView's native
/// back/forward navigation is just browser history navigation, exactly what
/// every visible in-app back button already triggers via `goBack()`
/// (NavigationHistoryContext).
///
/// THE ONE THING THIS GESTURE CANNOT SAFELY DO: respect the Evening
/// Wind-down flow's "leave routine?" confirmation (BackButton.jsx's
/// `handleClick` -> `ConfirmDialog`). That confirmation is a React
/// **click-handler** interception — it works by never calling `goBack()`
/// until the user confirms. A native edge-swipe gesture bypasses React
/// entirely: WKWebView performs the actual history navigation itself
/// (equivalent to the browser's native Back), and only *afterwards* does
/// React Router's popstate listener see the URL already changed. There is no
/// reliable way for JS to cancel a swipe-triggered navigation after the fact
/// without a jarring/inconsistent "snap back" UX, and Apple's own
/// `UIScreenEdgePanGestureRecognizer` driving this gesture does not expose a
/// safe interactive-cancel hook to JS at all. Per this task's own explicit
/// instruction ("if the native WebView gesture cannot respect the Evening
/// leave-confirmation guard reliably, disable the gesture within that
/// guarded flow rather than allowing data loss"), the gesture is dynamically
/// **disabled** while the current page is one of the five guarded Evening
/// Wind-down steps that can lose unsaved progress, and re-enabled the
/// instant the user navigates anywhere else (including the routine's own
/// completion screen, which has nothing left to lose).
///
/// Implementation: observes `webView.url` via KVO (WKWebView's `url` is a
/// KVO-compliant, `@objc dynamic` property) rather than requiring any
/// JS-to-native bridge/plugin — the guard works purely from the URL path
/// React Router already puts in the address bar on every route change, so it
/// keeps working even if the page's own JS hangs or errors.
class MainViewController: CAPBridgeViewController {

    /// Exactly the Evening Wind-down routes that can discard unsaved
    /// progress if left without the confirmation - see BackButton.jsx's
    /// active-routine guard and EveningSceneShell.jsx's own showBack wiring
    /// for the same five routes. Deliberately excludes "/evening-complete"
    /// (the routine's own completed state - nothing left to lose leaving it)
    /// and every other route in the app (never restricted elsewhere).
    private static let guardedEveningPaths: Set<String> = [
        "/evening-wind-down",
        "/reflection",
        "/gratitude",
        "/evening-breathing",
        "/prepare-for-rest"
    ]

    private var urlObservation: NSKeyValueObservation?

    override func viewDidLoad() {
        super.viewDidLoad()

        guard let webView = self.webView else { return }

        // Enabled by default everywhere; the KVO observer below narrows
        // this to "disabled" only while a guarded Evening route is current.
        webView.allowsBackForwardNavigationGestures = true

        urlObservation = webView.observe(\.url, options: [.new, .initial]) { [weak self] webView, _ in
            self?.updateGestureState(for: webView.url)
        }
    }

    private func updateGestureState(for url: URL?) {
        let path = url?.path ?? ""
        let isGuardedEveningStep = MainViewController.guardedEveningPaths.contains(path)
        webView?.allowsBackForwardNavigationGestures = !isGuardedEveningStep
    }

    deinit {
        urlObservation?.invalidate()
    }
}
