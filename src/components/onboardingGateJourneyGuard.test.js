// F5 (pre-Build-15 usability pass) — a guest hitting an authenticated
// Morning/Evening step route directly (URL, bookmark, browser history, a
// stale tab after sign-out) used to load and let them interact with the
// real routine content before any sign-in requirement was shown - Home's
// own guest gate (promptRoutineSignIn) only lives on Home's own tap
// handlers, never on the routes themselves. OnboardingGate.jsx is the one
// component every route already passes through (see its own top doc
// comment), so one guard here covers every Morning/Evening step route in
// one place - no per-page guard duplication.
//
// No DOM/component rendering is available in this repo's Vitest (see
// OnboardingGate.test.js's own note) - source-level checks, matching
// every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./OnboardingGate.jsx');
const appSource = read('../App.jsx');

describe('OnboardingGate — protected path lists match the real route registrations exactly', () => {
  it('every Morning step route in PROTECTED_MORNING_PATHS is a real registered route in App.jsx', () => {
    const morningRoutes = ['intention-setup', 'morning-flow', 'breathe', 'morning-meditate', 'affirmation', 'session-complete'];
    for (const route of morningRoutes) {
      expect(appSource).toMatch(new RegExp(`<Route path="${route}"`));
      expect(source).toMatch(new RegExp(`'/${route}'`));
    }
  });

  it('every Evening step route in PROTECTED_EVENING_PATHS is a real registered route in App.jsx', () => {
    const eveningRoutes = ['evening-wind-down', 'reflection', 'gratitude', 'evening-breathing', 'evening-meditate', 'prepare-for-rest', 'evening-complete'];
    for (const route of eveningRoutes) {
      expect(appSource).toMatch(new RegExp(`<Route path="${route}"`));
      expect(source).toMatch(new RegExp(`'/${route}'`));
    }
  });

  it('standalone Breathe/Meditation routes are deliberately NOT protected - this pass must not start gating content that was always guest-accessible', () => {
    const protectedBlock = source.slice(source.indexOf('const PROTECTED_MORNING_PATHS'), source.indexOf('export const OnboardingGate'));
    expect(protectedBlock).not.toMatch(/breathe-standalone/);
    expect(protectedBlock).not.toMatch(/self-guided-meditation/);
    expect(protectedBlock).not.toMatch(/quiet-breathing/);
  });

  it('exactly 6 Morning paths and 7 Evening paths - matches sessionDefinitions.js\'s own canonical step counts (no step silently missing or duplicated)', () => {
    const morningBlock = source.match(/const PROTECTED_MORNING_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
    const eveningBlock = source.match(/const PROTECTED_EVENING_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
    expect((morningBlock.match(/'\//g) ?? []).length).toBe(6);
    expect((eveningBlock.match(/'\//g) ?? []).length).toBe(7);
  });
});

describe('OnboardingGate — the guard itself: guest-only, after needsWelcome/needsIntroductionRedirect, before children', () => {
  it('journeyAction resolves to the fixed morning/sleep allowlist only, never a raw pathname', () => {
    expect(source).toMatch(/const journeyAction = PROTECTED_MORNING_PATHS\.has\(location\.pathname\)\s*\n\s*\? 'morning'\s*\n\s*: PROTECTED_EVENING_PATHS\.has\(location\.pathname\)\s*\n\s*\? 'sleep'\s*\n\s*: null;/);
  });

  it('needsJourneyGuard requires BOTH isGuest and a protected path - an authenticated user on the exact same route is completely unaffected', () => {
    expect(source).toMatch(/const needsJourneyGuard = isGuest && journeyAction !== null;/);
  });

  it('is evaluated after needsWelcome and needsIntroductionRedirect both already returned, and returns before `return children` - inherits the same no-flash guarantee, never rendered alongside children', () => {
    const needsWelcomeIdx = source.indexOf('if (needsWelcome) {');
    const needsIntroIdx = source.indexOf('if (needsIntroductionRedirect) {');
    const guardIdx = source.indexOf('if (needsJourneyGuard) {');
    const childrenIdx = source.lastIndexOf('return children;');
    expect(needsWelcomeIdx).toBeGreaterThan(-1);
    expect(needsIntroIdx).toBeGreaterThan(needsWelcomeIdx);
    expect(guardIdx).toBeGreaterThan(needsIntroIdx);
    expect(childrenIdx).toBeGreaterThan(guardIdx);
  });

  it('reuses the existing shared SignInPromptDialog - no new modal design', () => {
    expect(source).toMatch(/import \{ SignInPromptDialog \} from '\.\/SignInPromptDialog';/);
    const guardBlock = source.match(/if \(needsJourneyGuard\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(guardBlock).toMatch(/<SignInPromptDialog/);
    expect(guardBlock).toMatch(/open\b/);
  });

  it('Sign In/Create Account both preserve the intended journey via setPendingJourneyIntent(journeyAction) before navigating to /auth - the one existing mechanism that survives the auth round-trip for a non-media journey intent', () => {
    const guardBlock = source.match(/if \(needsJourneyGuard\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(guardBlock).toMatch(/onSignIn=\{\(\) => \{\s*\n\s*setPendingJourneyIntent\(journeyAction\);\s*\n\s*navigate\('\/auth'\);\s*\n\s*\}\}/);
    expect(guardBlock).toMatch(/onCreateAccount=\{\(\) => \{\s*\n\s*setPendingJourneyIntent\(journeyAction\);\s*\n\s*navigate\('\/auth\?tab=signup'\);\s*\n\s*\}\}/);
  });

  it('Continue Browsing (onDismiss) returns Home with replace:true - never leaves the guard itself as a history entry, never an infinite redirect between Home/Auth/the guarded route', () => {
    const guardBlock = source.match(/if \(needsJourneyGuard\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(guardBlock).toMatch(/onDismiss=\{\(\) => navigate\('\/', \{ replace: true \}\)\}/);
  });
});
