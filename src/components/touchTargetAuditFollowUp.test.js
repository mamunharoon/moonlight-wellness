// Build 15 viewport audit follow-up — the six sub-44px touch targets the
// audit measured live (Playwright + genuine CDP viewport sizing) at
// 320-430px width: Sign In/Sign Up tab toggle (~32px), "Continue
// Browsing" (~32px, shared SignInPromptDialog), Profile's Quick/Standard/
// Extended segmented control (~32px), Profile's mini Sign In/Create
// Account (~34px), Quiet Breathing's "Continue Without Music"/"Start with
// Music" (~42px, shared MusicEntryChoice), and vertical hit-slop for
// Auth's three bare text links (~16px, no padding). No DOM rendering is
// available in this repo's Vitest - source-level checks, matching this
// codebase's established convention; the real pixel measurements were
// confirmed live against the local dev server before and after each fix
// (see this session's verification evidence).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const authSource = read('../pages/Auth.jsx');
const signInPromptSource = read('./SignInPromptDialog.jsx');
const profileSource = read('../pages/Profile.jsx');
const musicEntryChoiceSource = read('./MusicEntryChoice.jsx');

describe('Auth.jsx — Sign In/Sign Up tab toggle reaches 44px', () => {
  it('both tab buttons carry min-h-[44px] with flex centering, not just py-2', () => {
    const matches = authSource.match(/flex-1 min-h-\[44px\] flex items-center justify-center rounded-full text-xs font-bold uppercase tracking-wider transition-all \$\{/g) ?? [];
    expect(matches.length).toBe(2);
  });
});

describe('Auth.jsx — text links gain vertical hit-slop without changing visible size', () => {
  it('"Forgot password?" gets py-2.5, stays text-xs (no visual size change)', () => {
    expect(authSource).toMatch(/className="inline-block py-2\.5 text-xs text-primary font-semibold"/);
  });

  it('"Back to Sign In" gets py-2.5, stays text-xs', () => {
    expect(authSource).toMatch(/className="w-full py-2\.5 text-center text-xs text-on-surface-variant font-semibold"/);
  });

  it('"Continue as guest" gets py-2.5, stays text-xs', () => {
    expect(authSource).toMatch(/className="block py-2\.5 text-center text-xs text-on-surface-variant"/);
  });
});

describe('SignInPromptDialog.jsx — "Continue Browsing" reaches 44px (shared: Library, Support, Anytime gate, every locked-content row)', () => {
  it('carries min-h-[44px] with flex centering, not just py-2', () => {
    expect(signInPromptSource).toMatch(/className="w-full min-h-\[44px\] flex items-center justify-center text-center text-xs text-on-surface-variant font-semibold hover:text-on-surface transition-colors"/);
  });

  it('the other two dialog actions (Sign In / Create Free Account, already py-3.5) are untouched', () => {
    expect(signInPromptSource).toMatch(/className="w-full py-3\.5 bg-primary text-on-primary rounded-full font-bold/);
    expect(signInPromptSource).toMatch(/className="w-full py-3\.5 glass-panel text-on-surface rounded-full font-bold/);
  });
});

describe('Profile.jsx — Quick/Standard/Extended segmented control reaches 44px', () => {
  it('min-h-[32px] was replaced with min-h-[44px]', () => {
    expect(profileSource).toMatch(/min-h-\[44px\]/);
    expect(profileSource).not.toMatch(/min-h-\[32px\]/);
  });
});

describe('Profile.jsx — guest mini Sign In/Create Account reach 44px', () => {
  it('both links carry min-h-[44px] with flex centering, not just px-4 py-2', () => {
    expect(profileSource).toMatch(/className="px-4 min-h-\[44px\] flex items-center justify-center rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider/);
    expect(profileSource).toMatch(/className="px-4 min-h-\[44px\] flex items-center justify-center rounded-full glass-panel border border-white\/10 text-on-surface text-xs font-bold uppercase tracking-wider/);
  });
});

describe('MusicEntryChoice.jsx — both buttons reach 44px (shared: Breathe, MorningFlow, EveningBreathing, QuietBreathing)', () => {
  it('"Continue Without Music" carries min-h-[44px] with flex centering, py-3 unchanged', () => {
    expect(musicEntryChoiceSource).toMatch(/className="flex-1 min-h-\[44px\] flex items-center justify-center glass-panel text-on-surface py-3 rounded-full font-bold text-xs/);
  });

  it('"Start with Music" (both accent variants) carries min-h-[44px] with flex centering', () => {
    expect(musicEntryChoiceSource).toMatch(/className=\{`min-h-\[44px\] flex items-center justify-center \$\{START_BUTTON_CLASS\[accent\] \?\? START_BUTTON_CLASS\.primary\}`\}/);
    expect(musicEntryChoiceSource).toMatch(/primary: 'flex-1 bg-primary text-on-primary py-3 rounded-full font-bold text-xs/);
    expect(musicEntryChoiceSource).toMatch(/anytime: 'flex-1 bg-tertiary text-on-tertiary py-3 rounded-full font-bold text-xs/);
  });
});

describe('Regression — no unrelated content changed', () => {
  it('Auth.jsx: no product-logic identifiers were touched (visual-only pass)', () => {
    expect(authSource).toMatch(/const handleSignIn = async/);
    expect(authSource).toMatch(/const handleSignUp = async/);
    expect(authSource).toMatch(/markPostAuthRedirectHandled\(\);/);
  });

  it('Profile.jsx: DURATION_OPTIONS values and setRoutineDuration wiring are untouched', () => {
    expect(profileSource).toMatch(/const DURATION_OPTIONS = \[/);
    expect(profileSource).toMatch(/onClick=\{\(\) => setRoutineDuration\(opt\.id\)\}/);
  });

  it('MusicEntryChoice.jsx: onStartWithMusic/onContinueWithoutMusic callback wiring is untouched', () => {
    expect(musicEntryChoiceSource).toMatch(/onClick=\{onContinueWithoutMusic\}/);
    expect(musicEntryChoiceSource).toMatch(/onClick=\{onStartWithMusic\}/);
  });
});
