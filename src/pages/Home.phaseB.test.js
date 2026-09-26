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
    // Morning Visual Uplift (Build 16) / Home Visual Uplift: Morning's
    // three call sites pass a third 'morning' period argument, and
    // (Home Visual Uplift correction) Evening's own three call sites now
    // explicitly pass 'evening' too - see nextStepCardBody's own doc
    // comment. Neither routine's step-progress DATA (resolveStepLabel)
    // changed at all.
    expect(source).toMatch(/nextStepCardBody\(morningInProgressCard, resolveStepLabel\(RITUAL_SESSION_IDS\.morning, morningResolvedStepIndex\), 'morning'\)/);
    expect(source).toMatch(/nextStepCardBody\(eveningInProgressCard, resolveStepLabel\(RITUAL_SESSION_IDS\.evening, eveningResolvedStepIndex\), 'evening'\)/);
  });

  it('the not-started and completed card calls carry no step-progress label for either routine (undefined) - the step-progress badge is additive, only for in-progress; both routines now also pass their own explicit period for styling', () => {
    expect(source).toMatch(/nextStepCardBody\(morningNotStartedCard, undefined, 'morning'\)/);
    expect(source).toMatch(/nextStepCardBody\(morningCompletedCard, undefined, 'morning'\)/);
    expect(source).toMatch(/nextStepCardBody\(eveningNotStartedCard, undefined, 'evening'\)/);
    expect(source).toMatch(/nextStepCardBody\(eveningCompletedCard, undefined, 'evening'\)/);
  });
});

describe('Home.jsx — quick-action tiles: icon bump only, everything else from the prior fix untouched (Phase B)', () => {
  it('all three remaining tile icons are bumped to text-2xl (Build 15 — first tile is now Breathe\'s "air" icon, replacing "bolt" now that Anytime Reset has its own Today\'s Rhythm card; the former fourth tile, Explore Library, was later removed entirely - see Home.quickActionTiles.test.js)', () => {
    // Context-aware Breathing/Meditation theming — supersedes this test's
    // earlier "Breathe/Sleep & Unwind carry their own fixed accent,
    // Meditate stays peach" comment: Breathe and Meditate now BOTH
    // preview Home's own currently active rhythm colour dynamically (see
    // circadianIconColourContract.test.js sections 1 and 3 for the full
    // contract); only Sleep & Unwind stays a fixed literal, since it
    // always opens a real Evening/sleep experience regardless of Home's
    // own active tab.
    expect(source).toMatch(/\{`material-symbols-outlined \$\{quickActionIconClass\} text-2xl`\}>air</);
    expect(source).toMatch(/\{`material-symbols-outlined \$\{quickActionIconClass\} text-2xl`\}>spa</);
    expect(source).toMatch(/text-evening-accent text-2xl">bedtime</);
  });

  it('the tooltip/aria-describedby wiring and exactly three tiles are still present - hrefs updated by the Phase B remediation pass\'s own Task 4 (Sleep sounds carries a `from=home` return-context marker; see Home.quickActionTiles.test.js/libraryHomeReturnContext.test.js for that coverage), by Build 15\'s own Anytime Reset -> Breathe swap, by Self-Guided Meditation repurposing the Meditate tile (see selfGuidedMeditationSetup.test.js - the existing guided-video wizard at /meditate itself is untouched, just no longer this tile\'s target), and by the later removal of the fourth tile, Explore Library (navigation simplification follow-up - Library stays permanently reachable via the bottom nav instead)', () => {
    // Context-aware Breathing/Meditation theming — Breathe/Meditate now
    // also carry a `state={{ journeyTone: ... }}` prop (plus an
    // explanatory comment) between `to="..."` and `aria-describedby=...`;
    // matched with a bounded span rather than exact adjacency.
    const hrefs = [...source.matchAll(/<Link\s+to="([^"]+)"[\s\S]{0,900}?aria-describedby="quick-action-tip-/g)].map((m) => m[1]);
    expect(hrefs).toEqual(['/breathe-standalone', '/self-guided-meditation?from=home', '/library?category=sleep-soundscapes&from=home']);
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
