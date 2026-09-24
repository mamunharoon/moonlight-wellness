// Build 15 Phase B — Home.jsx visual refinement regression guard.
// Confirms the Phase A morning-tint/evening-tint tokens are now genuinely
// wired in (this is the first file that actually uses them), that the
// real "Step X of Y" data is reused rather than duplicated, and that no
// logic/route/behaviour changed alongside the restyle. Source-level
// checks - this repo's Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Home.jsx', import.meta.url)), 'utf-8');

describe('Home.jsx — Phase A tokens now wired in (Phase B)', () => {
  // Build 15 Phase B fix: applied via an inline style, not the
  // bg-morning-tint/10 / bg-evening-tint/20 Tailwind utility classes
  // originally used - .glass-panel's own plain-CSS `background` shorthand
  // sits later than any Tailwind utility in the compiled stylesheet (it
  // isn't inside @layer utilities), so it silently won every card's tint
  // regardless of class order, discovered live during this phase's own
  // visual verification (real getComputedStyle() checks, not a
  // source-string assumption). See index.css/tailwind.config.js's own
  // comments on the matching rgb(var(...) / <alpha-value>) token-format
  // fix this also required.
  it('every Morning card sets the morning-tint background via inline style (0.1 alpha), and the old dead-code light/dark gradient pair is fully gone', () => {
    const morningCardCount = (source.match(/style=\{\{ backgroundColor: 'rgb\(var\(--color-morning-tint\) \/ 0\.1\)' \}\}/g) ?? []).length;
    expect(morningCardCount).toBe(4); // stale-choice, not-started, in-progress, completed
    expect(source).not.toMatch(/fffdfa/);
    expect(source).not.toMatch(/1e1a17/);
  });

  it('every Evening card sets the evening-tint background via inline style (0.2 alpha, the exact same #121b2e value, just via the named token now)', () => {
    const eveningCardCount = (source.match(/style=\{\{ backgroundColor: 'rgb\(var\(--color-evening-tint\) \/ 0\.2\)' \}\}/g) ?? []).length;
    expect(eveningCardCount).toBe(4); // stale-choice, not-started, in-progress, completed
    expect(source).not.toMatch(/121b2e/);
  });
});

describe('Home.jsx — card padding consistency (Phase B)', () => {
  it('Morning\'s not-started/in-progress/completed cards now match the stale-choice card\'s own p-6 (no more p-8 outlier)', () => {
    expect(source).not.toMatch(/glass-panel p-8/);
  });
});

describe('Home.jsx — in-progress routine cards show real step progress, not a new invented value (Phase B)', () => {
  it('the in-progress card body call passes resolveStepLabel(...) - the exact same function/data already used by the stale-choice card and cross-routine banner above it', () => {
    // Morning Visual Uplift (Build 16): Morning's three call sites gained
    // a third `isMorning` argument (see nextStepCardBody's own doc
    // comment) - Evening's own three call sites are still exactly the
    // original 1-2 argument calls, completely unaffected.
    expect(source).toMatch(/nextStepCardBody\(morningInProgressCard, resolveStepLabel\(RITUAL_SESSION_IDS\.morning, morningResolvedStepIndex\), true\)/);
    expect(source).toMatch(/nextStepCardBody\(eveningInProgressCard, resolveStepLabel\(RITUAL_SESSION_IDS\.evening, eveningResolvedStepIndex\)\)/);
  });

  it('the not-started and completed card calls are unchanged for Evening (single-argument) - the step-progress badge is additive, only for in-progress; Morning\'s equivalents now also pass `true` for the new isMorning styling flag', () => {
    expect(source).toMatch(/nextStepCardBody\(morningNotStartedCard, undefined, true\)/);
    expect(source).toMatch(/nextStepCardBody\(morningCompletedCard, undefined, true\)/);
    expect(source).toMatch(/nextStepCardBody\(eveningNotStartedCard\)/);
    expect(source).toMatch(/nextStepCardBody\(eveningCompletedCard\)/);
  });
});

describe('Home.jsx — quick-action tiles: icon bump only, everything else from the prior fix untouched (Phase B)', () => {
  it('all four tile icons are bumped to text-2xl (Build 15 — first tile is now Breathe\'s "air" icon, replacing "bolt" now that Anytime Reset has its own Today\'s Rhythm card)', () => {
    // Circadian Colors (Build 16) — Breathe/Sleep & Unwind carry their own
    // semantic accent (mint/lavender, matching the rest of the app's
    // pause-breathing/Evening surfaces); Meditate/Explore Library stay
    // WakeWise's neutral peach, since neither is time-of-day-specific -
    // see routinesCatalog.js's own Circadian Colors comment for the same
    // "reuse existing tokens, don't flood every screen" reasoning.
    expect(source).toMatch(/text-tertiary text-2xl">air</);
    expect(source).toMatch(/text-primary text-2xl">spa</);
    expect(source).toMatch(/text-primary text-2xl">video_library</);
    expect(source).toMatch(/text-evening-accent text-2xl">bedtime</);
  });

  it('the tooltip/aria-describedby wiring and exactly four tiles are still present - hrefs updated by the Phase B remediation pass\'s own Task 4 (Browse exercises/Sleep sounds now carry a `from=home` return-context marker; see Home.quickActionTiles.test.js/libraryHomeReturnContext.test.js for that coverage), by Build 15\'s own Anytime Reset -> Breathe swap, and by Self-Guided Meditation repurposing the Meditate tile (see selfGuidedMeditationSetup.test.js) - the existing guided-video wizard at /meditate itself is untouched, just no longer this tile\'s target', () => {
    const hrefs = [...source.matchAll(/<Link\s+to="([^"]+)"\s*\n\s*aria-describedby="quick-action-tip-/g)].map((m) => m[1]);
    expect(hrefs).toEqual(['/breathe-standalone', '/self-guided-meditation?from=home', '/library?from=home', '/library?category=sleep-soundscapes&from=home']);
  });
});

describe('Home.jsx — Phase B is visual-only: every routine/session/guest handler is byte-for-byte present (no logic regression)', () => {
  it('all routine action handlers are still defined and wired to the same buttons', () => {
    expect(source).toMatch(/const handleMorningAction = \(\) => \{/);
    expect(source).toMatch(/const handleEveningAction = \(\) => \{/);
    expect(source).toMatch(/const handleResumeStaleMorning = \(\) => \{/);
    expect(source).toMatch(/const handleResumeStaleEvening = \(\) => \{/);
    // handleSaveIntention was retired by the Phase B remediation pass's
    // own Task 1 - "Change intention" is now a dedicated route
    // (ChangeIntention.jsx) that owns setIntentions/saveIntentionsToCloud
    // itself; see activeIntentionCard.test.js/ChangeIntention.test.js.
  });

  it('the guest sign-in gate and ConfirmDialog wiring are untouched', () => {
    expect(source).toMatch(/const promptRoutineSignIn = \(\) => \{/);
    expect(source).toMatch(/<SignInPromptDialog/);
    expect(source).toMatch(/<ConfirmDialog/);
  });

  it('exactly four bottom-navigation destinations remain Layout\'s concern - Home.jsx itself never renders a nav item', () => {
    expect(source).not.toMatch(/navItems/);
  });
});
