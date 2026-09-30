// Android system Back button/gesture repair — regression guard.
//
// Two kinds of checks, matching this codebase's own established
// convention (e.g. eveningFlow.navigation.test.js,
// backNavigationCanonicalMap.test.js):
//   1. Real behavioural tests of backHandlerRegistry.js — it's pure JS,
//      no React/DOM needed, so it's exercised directly rather than only
//      checked by source-matching. Includes the post-review 'overlay'
//      vs 'screen' priority tag (dialog always wins, regardless of
//      registration order).
//   2. Source-string checks confirming every "in-app back arrow"
//      component found during this fix's own audit (BackButton,
//      ConfirmDialog, SignInPromptDialog, BetaVideoModal,
//      BedtimeMediaChooser, JourneyHeader, and the three hand-rolled
//      pages) actually calls useBackHandler with the right handler/
//      active condition/kind, and that useAndroidBackButton.js is wired
//      correctly (Android-only, single listener for the app's whole
//      lifetime, prefer-Home-then-exit root policy).
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerBackHandler, runBackHandler, __clearBackHandlersForTest } from '../lib/backHandlerRegistry';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('backHandlerRegistry — stack behaviour', () => {
  beforeEach(() => {
    __clearBackHandlersForTest();
  });

  it('runBackHandler returns false and calls nothing when the stack is empty', () => {
    expect(runBackHandler()).toBe(false);
  });

  it('runs the most-recently-registered handler first when kinds match (LIFO)', () => {
    const calls = [];
    registerBackHandler(() => calls.push('a'));
    registerBackHandler(() => calls.push('b'));

    expect(runBackHandler()).toBe(true);
    expect(calls).toEqual(['b']);
  });

  it('falls back to the next handler down once the top one unregisters', () => {
    const calls = [];
    registerBackHandler(() => calls.push('screen'));
    const unregisterTop = registerBackHandler(() => calls.push('later-screen'));

    unregisterTop();
    runBackHandler();

    expect(calls).toEqual(['screen']);
  });

  it('unregister is safe to call more than once and never removes the wrong entry', () => {
    const calls = [];
    const unregisterA = registerBackHandler(() => calls.push('a'));
    registerBackHandler(() => calls.push('b'));

    unregisterA();
    unregisterA(); // second call must be a no-op, not throw or double-remove
    runBackHandler();

    expect(calls).toEqual(['b']);
  });

  // Post-review correction — an 'overlay' entry (ConfirmDialog etc.) must
  // win over a 'screen' entry regardless of which registered first, not
  // merely because it happens to register later. Registered here in
  // 'screen' THEN 'overlay' order (the common case) and also in the
  // reverse order (the OnboardingGate SignInPromptDialog counter-example
  // — `open` literally `true` on first render, so the dialog can
  // register before any screen-level handler exists at all).
  it('an overlay entry always wins over a screen entry, screen-then-overlay order', () => {
    const calls = [];
    registerBackHandler(() => calls.push('screen'), 'screen');
    registerBackHandler(() => calls.push('overlay'), 'overlay');

    runBackHandler();
    expect(calls).toEqual(['overlay']);
  });

  it('an overlay entry always wins over a screen entry, overlay-then-screen order (mount-order-independent)', () => {
    const calls = [];
    registerBackHandler(() => calls.push('overlay'), 'overlay');
    registerBackHandler(() => calls.push('screen'), 'screen');

    runBackHandler();
    expect(calls).toEqual(['overlay']);
  });

  it('falls back to the topmost screen entry once the only overlay entry unregisters', () => {
    const calls = [];
    registerBackHandler(() => calls.push('screen'), 'screen');
    const unregisterOverlay = registerBackHandler(() => calls.push('overlay'), 'overlay');

    unregisterOverlay();
    runBackHandler();

    expect(calls).toEqual(['screen']);
  });

  it('among multiple simultaneous overlay entries, the most recently registered wins', () => {
    const calls = [];
    registerBackHandler(() => calls.push('overlay-1'), 'overlay');
    registerBackHandler(() => calls.push('overlay-2'), 'overlay');

    runBackHandler();
    expect(calls).toEqual(['overlay-2']);
  });
});

describe('useAndroidBackButton.js — native listener wiring', () => {
  const source = read('./useAndroidBackButton.js');

  it('is gated to Android only', () => {
    expect(source).toMatch(/if \(!isAndroid\(\)\) return undefined;/);
  });

  it('registers exactly one backButton listener for the app\'s whole lifetime — the registration effect depends only on the stable useNavigate() return value, never on location/pathname, so a navigation can never remove-and-re-add the native listener', () => {
    expect(source).toMatch(/CapacitorApp\.addListener\('backButton',/);
    expect(source).toMatch(/}, \[navigate\]\);/);
    // The negative check matters as much as the positive one here: this
    // guards against a regression that would reintroduce the exact
    // "handled twice" risk this fix exists to prevent (see this file's
    // own doc comment) — the effect must never depend on `location`.
    expect(source).not.toMatch(/\[navigate, location/);
    expect(source).not.toMatch(/\blocation\.pathname\], *\(\)/);
  });

  it('reads the current pathname through a ref updated by a separate, dependency-less effect, never by depending on location.pathname directly', () => {
    expect(source).toMatch(/const pathnameRef = useRef\(location\.pathname\);/);
    expect(source).toMatch(/useEffect\(\(\) => \{\s*\n\s*pathnameRef\.current = location\.pathname;\s*\n\s*\}\);/);
  });

  it('removes its listener on unmount, so remounting never produces a second live handler', () => {
    expect(source).toMatch(/listenerPromise\.then\(\(listener\) => listener\.remove\(\)\);/);
  });

  it('runs the topmost registered handler first, and only when nothing is registered applies the root policy', () => {
    const body = source.match(/CapacitorApp\.addListener\('backButton', \(\) => \{[\s\S]*?\}\);/)?.[0] ?? '';
    expect(body).toMatch(/const handled = runBackHandler\(\);/);
    expect(body).toMatch(/if \(handled\) return;/);
  });

  // Post-review correction — was unconditional App.exitApp(); now prefers
  // returning Home from anywhere else, exiting only once already there.
  it('root policy: exits only when already at Home (pathname "/"), otherwise navigates to Home (replace, not push)', () => {
    const body = source.match(/CapacitorApp\.addListener\('backButton', \(\) => \{[\s\S]*?\}\);/)?.[0] ?? '';
    expect(body).toMatch(/if \(pathnameRef\.current === '\/'\) \{\s*\n\s*CapacitorApp\.exitApp\(\);\s*\n\s*\} else \{\s*\n\s*navigate\('\/', \{ replace: true \}\);/);
  });
});

describe('App.jsx — AndroidBackButtonHandler mounted exactly once, alongside the other native-only handlers', () => {
  const source = read('../App.jsx');

  it('imports and calls useAndroidBackButton', () => {
    expect(source).toMatch(/import \{ useAndroidBackButton \} from '\.\/hooks\/useAndroidBackButton';/);
    expect(source).toMatch(/function AndroidBackButtonHandler\(\) \{\s*\n\s*useAndroidBackButton\(\);/);
  });

  // Integration-branch correction — RevenueCatIdentityHandler (Phase 2B)
  // now sits between MorningReminderTapHandler and AndroidBackButtonHandler
  // in this same "native only, renders nothing" run of components; exact
  // adjacency to the other two isn't the real contract here (mount order
  // among these siblings is inert - none of them depend on each other),
  // only that AndroidBackButtonHandler is rendered once, inside the same
  // NavigationHistoryProvider-wrapped block as NativeDeepLinkHandler and
  // MorningReminderTapHandler.
  it('is rendered once, inside NavigationHistoryProvider (so BackButton\'s own goBack is available) alongside NativeDeepLinkHandler/MorningReminderTapHandler', () => {
    expect(source).toMatch(/<NativeDeepLinkHandler \/>\s*\n\s*<MorningReminderTapHandler \/>/);
    expect((source.match(/<AndroidBackButtonHandler \/>/g) ?? []).length).toBe(1);
    const providerIdx = source.indexOf('<NavigationHistoryProvider>');
    const nativeDeepLinkIdx = source.indexOf('<NativeDeepLinkHandler />');
    const androidBackIdx = source.indexOf('<AndroidBackButtonHandler />');
    const routineRestoreGuardIdx = source.indexOf('<RoutineRestoreGuard />');
    expect(providerIdx).toBeGreaterThan(-1);
    expect(providerIdx).toBeLessThan(nativeDeepLinkIdx);
    expect(nativeDeepLinkIdx).toBeLessThan(androidBackIdx);
    // Still before RoutineRestoreGuard/OnboardingGate, same as the other
    // native-only handlers - not accidentally nested inside a later,
    // conditionally-rendered part of the tree.
    expect(androidBackIdx).toBeLessThan(routineRestoreGuardIdx);
  });
});

describe('Screen components register kind: "screen" (the default — no explicit third argument)', () => {
  it('BackButton.jsx registers handleClick unconditionally for as long as it is mounted', () => {
    const source = read('../components/BackButton.jsx');
    expect(source).toMatch(/import \{ useBackHandler \} from '\.\.\/hooks\/useBackHandler';/);
    expect(source).toMatch(/useBackHandler\(handleClick\);/);
  });

  it('JourneyHeader.jsx registers onStepBack only on the local-arrow branch, never doubling up with the internal BackButton', () => {
    const source = read('../components/journey/JourneyHeader.jsx');
    expect(source).toMatch(/useBackHandler\(onStepBack, !showBackButton\);/);
  });

  it('Support.jsx registers its hand-rolled handleBack only while a mood/mapping is active, matching the !mapping BackButton branch otherwise', () => {
    const source = read('../pages/Support.jsx');
    expect(source).toMatch(/useBackHandler\(handleBack, Boolean\(mapping\)\);/);
  });

  it('IntentionSetup.jsx registers handleBackToPrimary only on the Supporting stage, layering above the page-level BackButton', () => {
    const source = read('../pages/IntentionSetup.jsx');
    expect(source).toMatch(/useBackHandler\(handleBackToPrimary, stage === 'supporting'\);/);
  });

  it('DeleteAccount.jsx registers each step\'s own BackArrow onClick generically (one BackArrow mounted per phase)', () => {
    const source = read('../pages/DeleteAccount.jsx');
    expect(source).toMatch(/const BackArrow = \(\{ onClick \}\) => \{\s*\n(?:.*\n)*?\s*useBackHandler\(onClick\);/);
  });

  it('AlarmActive.jsx registers an explicit no-op — Back must never let the app be exited/navigated away from a ringing alarm', () => {
    const source = read('../pages/AlarmActive.jsx');
    expect(source).toMatch(/useBackHandler\(\(\) => \{\}, true\);/);
  });

  // Post-review correction — Welcome (OnboardingGate.jsx) previously had
  // no registered handler at all, so a deep link that lands Welcome on a
  // non-'/' pathname made useAndroidBackButton.js's pathname-only root
  // policy silently no-op (navigate('/', ...) doesn't escape a gate that
  // doesn't look at pathname). Fixed by registering directly off
  // OnboardingGate's own existing needsWelcome value - never a second,
  // duplicated copy of that gate.
  it('OnboardingGate.jsx registers App.exitApp() while (and only while) Welcome is genuinely showing, reusing its own needsWelcome gate directly', () => {
    const source = read('../components/OnboardingGate.jsx');
    expect(source).toMatch(/import \{ useBackHandler \} from '\.\.\/hooks\/useBackHandler';/);
    expect(source).toMatch(/import \{ App as CapacitorApp \} from '@capacitor\/app';/);
    expect(source).toMatch(/useBackHandler\(\(\) => CapacitorApp\.exitApp\(\), needsWelcome && !loading\);/);
    // Must be registered before the `if (loading) return` early return
    // (rules of hooks - every hook call must be unconditional), so
    // needsWelcome/isAllowedPreEntryPath are necessarily computed above
    // that return too, not only inside the old needsWelcome-if block.
    const registerIdx = source.indexOf('useBackHandler(() => CapacitorApp.exitApp()');
    const loadingReturnIdx = source.indexOf('if (loading) {');
    expect(registerIdx).toBeGreaterThan(-1);
    expect(loadingReturnIdx).toBeGreaterThan(-1);
    expect(registerIdx).toBeLessThan(loadingReturnIdx);
  });
});

describe('Overlay components explicitly pass kind: "overlay" — always wins over a screen entry, regardless of registration order', () => {
  it('ConfirmDialog.jsx registers onDismiss, kind "overlay", only while open', () => {
    const source = read('../components/ConfirmDialog.jsx');
    expect(source).toMatch(/useBackHandler\(onDismiss, open, 'overlay'\);/);
  });

  it('SignInPromptDialog.jsx registers onDismiss, kind "overlay", only while open', () => {
    const source = read('../components/SignInPromptDialog.jsx');
    expect(source).toMatch(/useBackHandler\(onDismiss, open, 'overlay'\);/);
  });

  it('BetaVideoModal.jsx registers handleClose (pauses playback, then onClose), kind "overlay" — not the raw onClose prop', () => {
    const source = read('../components/BetaVideoModal.jsx');
    expect(source).toMatch(/useBackHandler\(handleClose, true, 'overlay'\);/);
  });

  it('BedtimeMediaChooser.jsx registers onClose, kind "overlay"', () => {
    const source = read('../components/evening/BedtimeMediaChooser.jsx');
    expect(source).toMatch(/useBackHandler\(onClose, true, 'overlay'\);/);
  });
});
