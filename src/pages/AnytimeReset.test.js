// Anytime Reset — component regression guard (Build 15). Source-level
// checks, matching this codebase's established pattern for pages with no
// DOM/component rendering available in this repo's Vitest (see
// Meditate.jsx's own sibling and Auth.mobileSafeArea.test.js's note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./AnytimeReset.jsx');

describe('AnytimeReset.jsx — single-select, no typing, no custom field', () => {
  it('imports ANYTIME_RESET_NEEDS/ANYTIME_RESET_DURATIONS, never INTENTION_PRESETS or ACTIVITY_PRESETS', () => {
    expect(source).toMatch(/ANYTIME_RESET_DURATIONS, ANYTIME_RESET_NEEDS/);
    expect(source).not.toMatch(/INTENTION_PRESETS|ACTIVITY_PRESETS/);
  });

  it('need selection sets exactly one needId (handleSelectNeed), never toggles/appends to an array', () => {
    const body = source.match(/const handleSelectNeed = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setNeedId\(id\)/);
    expect(body).not.toMatch(/toggleIntention|push|concat|\.\.\.need/);
  });

  it('no <input> element anywhere in the file - a genuinely tap-only flow', () => {
    expect(source).not.toMatch(/<input\b/);
  });

  it('no "Something else" chip and no custom-text state', () => {
    expect(source).not.toMatch(/Something else/i);
    expect(source).not.toMatch(/customIntention|customActivity|customValue/);
  });

  it('never imports saveIntentionsToCloud, and never calls setIntentions - no code path can write user_intentions', () => {
    expect(source).not.toMatch(/import \{[^}]*saveIntentionsToCloud/);
    expect(source).not.toMatch(/setIntentions\(/);
  });

  it('imports supabase only for a read-only auth revalidation check - never a table write, storage call, or localStorage use', () => {
    expect(source).toMatch(/import \{ supabase \} from '\.\.\/lib\/supabaseClient';/);
    expect(source).not.toMatch(/supabase\.from\(/);
    expect(source).not.toMatch(/supabase\.storage/);
    expect(source).not.toMatch(/localStorage\.(setItem|getItem|removeItem)/);
  });
});

describe('AnytimeReset.jsx — step order and copy', () => {
  it('need selection is step 1 (initial state), duration is step 2', () => {
    expect(source).toMatch(/useState\(\(\) => \(restoredIsValid \? 'recommend' : 'need'\)\)/);
  });

  it('the approved intro heading and supporting copy are present verbatim', () => {
    expect(source).toMatch(/Take an Anytime Reset/);
    expect(source).toMatch(/Choose what you need and how much time you have\./);
  });

  it('the approved step headings are present verbatim', () => {
    expect(source).toMatch(/What do you need right now\?/);
    expect(source).toMatch(/How much time do you have\?/);
  });
});

describe('AnytimeReset.jsx — required navigation controls and Back semantics', () => {
  it('handleStepBack: recommend -> duration -> need (never need -> anywhere, that is BackButton\'s job)', () => {
    const body = source.match(/const handleStepBack = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(step === 'duration'\) setStep\('need'\);/);
    expect(body).toMatch(/else if \(step === 'recommend'\) setStep\('duration'\);/);
  });

  it('step 1 (need) tells the shared JourneyHeader to use the real BackButton with fallback="/" - Home is the real exit from step 1 (JourneyHeader.jsx\'s own test file covers what it does with this prop)', () => {
    expect(source).toMatch(/<JourneyHeader\s*\n\s*showBackButton=\{step === 'need'\}\s*\n\s*backFallback="\/"/);
  });

  it('a dedicated Close control navigates to Home directly (Phase B: wired via JourneyHeader\'s onClose prop - its own test file asserts the real aria-label="Close" markup)', () => {
    const body = source.match(/const handleClose = \(\) => [\s\S]*?;/)?.[0] ?? '';
    expect(body).toMatch(/navigate\('\/'\)/);
    expect(source).toMatch(/onClose=\{handleClose\}/);
  });

  it('Change need and Change time controls exist and route to the correct steps', () => {
    expect(source).toMatch(/const handleChangeNeed = \(\) => setStep\('need'\);/);
    expect(source).toMatch(/const handleChangeTime = \(\) => setStep\('duration'\);/);
  });

  it('Choose another only renders when more than one item is available (Phase B: passed as RecommendationCard\'s showChooseAnother prop), and advances without ever resetting need/duration', () => {
    expect(source).toMatch(/showChooseAnother=\{items\.length > 1\}/);
    const body = source.match(/const handleChooseAnother = \(\) => [\s\S]*?;/)?.[0] ?? '';
    expect(body).toMatch(/setOptionIndex\(\(i\) => i \+ 1\)/);
    expect(body).not.toMatch(/setNeedId|setDurationId/);
  });

  it('closing the video (handleVideoClose) only clears openVideoId - it stays on the recommendation step, never exits the journey', () => {
    const body = source.match(/const handleVideoClose = \(\) => [\s\S]*?;/)?.[0] ?? '';
    expect(body).toMatch(/setOpenVideoId\(null\)/);
    expect(body).not.toMatch(/navigate\(/);
  });
});

describe('AnytimeReset.jsx — 44x44 touch targets', () => {
  // Build 15 Phase B: need chips and duration rows are now the shared
  // SelectionChip/SelectionRow components (their own test files assert
  // the actual min-h-[44px]/selected-state markup) - this file's job is
  // only to confirm AnytimeReset.jsx actually renders them, wired to the
  // real need/duration data and handlers.
  it('the need grid renders one SelectionChip per real ANYTIME_RESET_NEEDS entry, wired to handleSelectNeed', () => {
    expect(source).toMatch(/\{ANYTIME_RESET_NEEDS\.map\(\(need\) => \(\s*\n\s*<SelectionChip/);
    expect(source).toMatch(/onClick=\{\(\) => handleSelectNeed\(need\.id\)\}/);
  });

  it('the duration list renders one SelectionRow per real ANYTIME_RESET_DURATIONS entry, wired to handleSelectDuration', () => {
    expect(source).toMatch(/\{ANYTIME_RESET_DURATIONS\.map\(\(duration\) => \(\s*\n\s*<SelectionRow/);
    expect(source).toMatch(/onClick=\{\(\) => handleSelectDuration\(duration\.id\)\}/);
  });

  it('Change need / Change time controls carry min-h-[44px]', () => {
    const body = source.match(/Change need[\s\S]*?Change time[\s\S]{0,80}/)?.[0] ?? '';
    expect(body).toMatch(/min-h-\[44px\]/);
  });

  it('the step-back and Close handlers are wired through to the shared JourneyHeader (its own test file asserts the real w-11 h-11 markup)', () => {
    expect(source).toMatch(/onStepBack=\{handleStepBack\}/);
    expect(source).toMatch(/onClose=\{handleClose\}/);
  });
});

describe('AnytimeReset.jsx — selected state visible beyond colour alone', () => {
  // SelectionChip/SelectionRow's own test files assert aria-pressed +
  // border/check-icon/font-weight markup; this file confirms the real
  // needId/durationId comparison is what's actually passed as `selected`.
  it('need chips receive the real needId === need.id comparison as `selected`, not a hardcoded value', () => {
    expect(source).toMatch(/selected=\{needId === need\.id\}/);
  });

  it('duration rows receive the real durationId === duration.id comparison as `selected`', () => {
    expect(source).toMatch(/selected=\{durationId === duration\.id\}/);
  });
});

describe('AnytimeReset.jsx — guest / post-sign-in restore, allowlisted and stripped', () => {
  it('restoredIsValid checks the tapped need/duration ids against the real approved lists, never trusts the URL blindly', () => {
    const body = source.match(/const restoredIsValid =[\s\S]*?ANYTIME_RESET_DURATIONS\.some\(\(d\) => d\.id === restoredDuration\);/)?.[0] ?? '';
    expect(body).toMatch(/ANYTIME_RESET_NEEDS\.some\(\(n\) => n\.id === restoredNeed\)/);
    expect(body).toMatch(/ANYTIME_RESET_DURATIONS\.some\(\(d\) => d\.id === restoredDuration\)/);
  });

  it('openId is only ever trusted for a real, currently-active catalogue entry, and never for a guest', () => {
    expect(source).toMatch(/openId && !isGuest && getCatalogEntryById\(openId\)/);
  });

  it('restore params (need/duration/openId) are stripped immediately after being read, so they can never re-trigger on reload/back-forward', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*const hasOpenId[\s\S]*?\n {2}\}, \[\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/next\.delete\('openId'\);/);
    expect(body).toMatch(/next\.delete\('need'\);/);
    expect(body).toMatch(/next\.delete\('duration'\);/);
    expect(body).toMatch(/replace: true/);
  });

  it('signed-in-only Begin - a guest tapping Start sees the sign-in prompt, never an immediate video open', () => {
    const body = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(isGuest\) \{\s*\n\s*setSignInPromptOpen\(true\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('reuses the exact same setPendingContent + SignInPromptDialog mechanism as Meditate.jsx (no second guest-auth path invented)', () => {
    expect(source).toMatch(/import \{ setPendingContent \} from '\.\.\/lib\/pendingContent';/);
    expect(source).toMatch(/import \{ SignInPromptDialog \} from '\.\.\/components\/SignInPromptDialog';/);
  });
});

describe('AnytimeReset.jsx — BetaVideoModal integration, unchanged component', () => {
  it('reuses BetaVideoModal directly - never a second/alternate player', () => {
    expect(source).toMatch(/import \{ BetaVideoModal \} from '\.\.\/components\/BetaVideoModal';/);
    expect(source).toMatch(/<BetaVideoModal entry=\{openVideo\} onClose=\{handleVideoClose\} \/>/);
  });
});

describe('AnytimeReset.jsx — desktop layout: bounded/centred container, never full-bleed', () => {
  it('the root element is bounded to max-w-md and centred, matching the app\'s existing mobile-simulating shell width', () => {
    const rootOpenTag = source.match(/return \(\s*\n\s*<div\s*\n?([\s\S]*?)>/)?.[0] ?? '';
    expect(rootOpenTag).toMatch(/max-w-md/);
    expect(rootOpenTag).toMatch(/mx-auto/);
  });

  it('horizontal padding is safe-area-aware AND responsive (Phase B: 20px default, clamped down to 16px on very small screens) - never a bare fixed px value that could double up with a safe-area inset elsewhere', () => {
    const rootOpenTag = source.match(/return \(\s*\n\s*<div\s*\n?([\s\S]*?)>/)?.[0] ?? '';
    expect(rootOpenTag).toMatch(/paddingLeft:\s*'calc\(clamp\(1rem, 4vw, 1\.25rem\) \+ env\(safe-area-inset-left\)\)'/);
    expect(rootOpenTag).toMatch(/paddingRight:\s*'calc\(clamp\(1rem, 4vw, 1\.25rem\) \+ env\(safe-area-inset-right\)\)'/);
  });

  it('width stays fluid (max-w-md + w-full), never a fixed pixel width that could overflow a narrow mobile viewport', () => {
    const rootOpenTag = source.match(/return \(\s*\n\s*<div\s*\n?([\s\S]*?)>/)?.[0] ?? '';
    expect(rootOpenTag).toMatch(/w-full/);
    expect(rootOpenTag).not.toMatch(/w-\[\d+px\]/);
  });
});

describe('AnytimeReset.jsx — auth-loading guard and server-revalidated Start (guest/auth wrong-modal fix)', () => {
  it('handleBegin never proceeds while AuthContext is still resolving (authLoading) - "not yet resolved" is never treated as signed in', () => {
    const body = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!current \|\| authLoading \|\| verifyingAuthRef\.current\) return;/);
  });

  it('re-entrancy guard is a ref, not just the verifyingAuth state - two click events dispatched before a re-render must still see the updated flag synchronously, so a fast real or scripted double-tap can never start two getUser() calls', () => {
    expect(source).toMatch(/const verifyingAuthRef = useRef\(false\);/);
    const body = source.match(/const verifyAndOpenVideo = async \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/async \(id\) => \{\s*\n\s*verifyingAuthRef\.current = true;/);
    expect(body).toMatch(/finally \{\s*\n\s*verifyingAuthRef\.current = false;/);
  });

  it('a signed-in-looking tap runs a real server-revalidating supabase.auth.getUser() check before ever opening the video, never trusts the local cached session alone', () => {
    const body = source.match(/const verifyAndOpenVideo = async \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/await supabase\.auth\.getUser\(\)/);
  });

  it('getUser() success (a real, non-anonymous user) opens BetaVideoModal via setOpenVideoId', () => {
    const body = source.match(/const verifyAndOpenVideo = async \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setOpenVideoId\(id\)/);
  });

  it('getUser() failure, no user, or an anonymous user all route to the SignInPromptDialog - a stale/expired/deleted session is treated as a guest, never opens BetaVideoModal', () => {
    const body = source.match(/const verifyAndOpenVideo = async \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(error \|\| !data\?\.user \|\| data\.user\.is_anonymous\) \{\s*\n\s*setSignInPromptOpen\(true\);/);
    expect(body).toMatch(/\} catch \{\s*\n\s*setSignInPromptOpen\(true\);/);
  });

  it('the Start button is disabled while auth is loading or being revalidated, so a tap cannot race either check (Phase B: passed as RecommendationCard\'s startDisabled/startBusy props, same booleans as before)', () => {
    expect(source).toMatch(/onStart=\{handleBegin\}/);
    expect(source).toMatch(/startDisabled=\{authLoading \|\| verifyingAuth\}/);
    expect(source).toMatch(/startBusy=\{verifyingAuth\}/);
  });

  it('this stays a read-only client-side pre-check only - get-beta-video-url remains the real server-side gate, never bypassed or weakened here', () => {
    expect(source).not.toMatch(/beta_access\s*=|\.update\(|\.insert\(|\.upsert\(/);
  });
});

describe('AnytimeReset.jsx — cancelling sign-in preserves the recommendation and selections', () => {
  it('onDismiss only closes the dialog - it never resets step/needId/durationId/optionIndex', () => {
    const dialogBlock = source.match(/<SignInPromptDialog[\s\S]*?\/>/)?.[0] ?? '';
    expect(dialogBlock).toMatch(/onDismiss=\{\(\) => setSignInPromptOpen\(false\)\}/);
    expect(dialogBlock).not.toMatch(/setStep|setNeedId|setDurationId|setOptionIndex/);
  });
});

describe('AnytimeReset.jsx — actual duration always shown, closest-match always labelled (Phase B: passed as RecommendationCard props)', () => {
  it('passes the item\'s own real duration via formatDuration as durationLabel, never a hardcoded label', () => {
    expect(source).toMatch(/durationLabel=\{formatDuration\(current\.anytimeReset\.durationSeconds\)\}/);
  });

  it('passes isClosestMatch from the real matchQuality check, not a hardcoded value - RecommendationCard.jsx\'s own test asserts it renders "Closest match" when true', () => {
    expect(source).toMatch(/isClosestMatch=\{recommendation\.matchQuality === 'closest'\}/);
  });

  it('passes the item\'s own real matchReason as matchReason, never a hardcoded string', () => {
    expect(source).toMatch(/matchReason=\{current\.matchReason\}/);
  });
});

describe('AnytimeReset.jsx — Visual Uplift Phase 2: mint identity, approved decisions A/D/E + typography', () => {
  it('the step-1 header icon is mint (text-tertiary), not the generic peach primary token', () => {
    expect(source).toMatch(/<span className="material-symbols-outlined text-tertiary text-3xl" aria-hidden="true">bolt<\/span>/);
  });

  it('every step heading is bumped to text-3xl (approved typography decision), never left at text-2xl', () => {
    const headings = [...source.matchAll(/<h1 className="font-headline-lg (text-\dxl) text-on-surface font-bold tracking-tight[^"]*">/g)].map((m) => m[1]);
    expect(headings.length).toBeGreaterThanOrEqual(3);
    for (const size of headings) {
      expect(size).toBe('text-3xl');
    }
  });

  it('need chips receive accent="anytime" - the shared SelectionChip renders its mint selected state here, never the default peach', () => {
    const block = source.match(/\{ANYTIME_RESET_NEEDS\.map\(\(need\) => \(\s*\n\s*<SelectionChip[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/accent="anytime"/);
  });

  it('duration rows receive accent="anytime"', () => {
    const block = source.match(/\{ANYTIME_RESET_DURATIONS\.map\(\(duration\) => \(\s*\n\s*<SelectionRow[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/accent="anytime"/);
  });

  it('the recommendation card receives accent="anytime" - its Start button stays peach regardless (RecommendationCard.jsx\'s own test proves the button ignores accent)', () => {
    const block = source.match(/<RecommendationCard[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/accent="anytime"/);
  });
});
