/*
 * Android system Back button/gesture repair — shared back-handler stack.
 *
 * Native Android has no concept of "the in-app back arrow" — the
 * hardware Back button and edge-swipe gesture fire one generic
 * Capacitor `backButton` event (see useAndroidBackButton.js), no matter
 * which screen, dialog, or overlay is currently showing. Before this
 * fix, nothing on the JS side consumed that event, so Capacitor's own
 * native default ran instead: raw WebView history traversal
 * (`webView.goBack()`), which revisits whatever the browser's own
 * session history contains rather than the curated destination this
 * app's own BackButton/goBack logic (NavigationHistoryContext) computes
 * - exactly the reported defect ("returns to the last displayed screen
 * in navigation history, rather than... the in-app back arrow").
 *
 * The fix: every component that already renders a real, tappable "go
 * back"/"dismiss" control (BackButton, ConfirmDialog, SignInPromptDialog,
 * BetaVideoModal, BedtimeMediaChooser, and the hand-rolled step-back
 * arrows in JourneyHeader/Support.jsx/IntentionSetup.jsx/
 * DeleteAccount.jsx) registers that control's own exact click handler
 * here (via useBackHandler.js) for as long as it is the active control
 * on screen. useAndroidBackButton.js then simply invokes whichever
 * handler is topmost - guaranteeing the hardware button and gesture run
 * the IDENTICAL code path as tapping the visible control, including its
 * confirmation dialogs, session-interrupt/cleanup, and stale-history
 * guards (alwaysFallback, onBeforeLeave), by construction rather than by
 * a separate reimplementation that could drift out of sync.
 *
 * Stack (not single-slot), with an explicit priority tag rather than
 * relying on registration order alone:
 *
 *   kind: 'overlay' - ConfirmDialog, SignInPromptDialog, BetaVideoModal,
 *     BedtimeMediaChooser. ALWAYS wins over every 'screen' entry, full
 *     stop, regardless of when either registered.
 *   kind: 'screen' (default) - BackButton, JourneyHeader's step-back
 *     branch, the hand-rolled arrows in Support.jsx/IntentionSetup.jsx/
 *     DeleteAccount.jsx, AlarmActive's no-op.
 *
 * Post-review correction: this was originally plain LIFO (last
 * registered wins), which happens to put a dialog on top in the common
 * case - it opens later, from a user action, after the underlying
 * screen's handler already registered at mount. But that is registration
 * TIMING, not a real guarantee "regardless of component mount order" (as
 * requested in review). OnboardingGate.jsx's guest-journey guard is a
 * real counterexample already in this codebase: it renders
 * `<SignInPromptDialog open onDismiss={...} />` - `open` literally
 * `true` - on its very first render, no later toggle. It happens to have
 * no competing screen handler in that branch today, but nothing enforced
 * that; a future screen could add one and silently invert priority under
 * the old design. Explicit `kind` removes the dependency on timing
 * entirely: among entries of the same kind, the most recently registered
 * (innermost) wins - among different kinds, 'overlay' always wins.
 */
const stack = [];

/**
 * Registers `handler` as an active back action. `kind` - 'overlay' for
 * anything that visually sits on top and must dismiss before the screen
 * underneath ever sees Back, 'screen' (default) for an in-page back
 * arrow. Returns an unregister function - always call it on cleanup
 * (component unmount, or whenever `active` flips false) so a stale/
 * invisible control can never shadow the real one underneath it.
 */
export const registerBackHandler = (handler, kind = 'screen') => {
  const entry = { handler, kind };
  stack.push(entry);
  return () => {
    const index = stack.indexOf(entry);
    if (index !== -1) stack.splice(index, 1);
  };
};

/**
 * Invokes the highest-priority registered handler, if any: the most
 * recently registered 'overlay' entry if one exists, else the most
 * recently registered 'screen' entry. Returns true when a handler ran
 * (the event is "consumed" - useAndroidBackButton.js must not also apply
 * its own no-handler policy), false when the stack is empty (no in-app
 * back arrow/dialog is present on the current screen).
 */
export const runBackHandler = () => {
  let top = null;
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (stack[i].kind === 'overlay') {
      top = stack[i];
      break;
    }
    if (top === null) top = stack[i]; // most-recent 'screen' entry, kept only if no overlay is ever found
  }
  if (!top) return false;
  top.handler();
  return true;
};

// Test-only: lets androidBackButton.test.js verify stack behaviour never
// leaks between test cases without reaching into module internals.
export const __clearBackHandlersForTest = () => {
  stack.length = 0;
};
