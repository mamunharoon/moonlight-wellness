// Regression guard for the "What would help right now?" back-button fix
// (Defect 3). No DOM/component rendering is available in this repo's
// Vitest (see Home.routineState.test.js's own note) - source-level checks,
// matching every other regression guard in this codebase for exactly that
// reason.
//
// Root cause, confirmed via live interactive testing (both the direct
// duration -> need click-through path, and the post-auth ?need=&duration=
// restore path -> "Change need"): the on-screen back arrow's own
// handleStepBack was never broken - it correctly steps `need` -> `duration`
// in both cases. What actually fails: `need`/`duration` are read once by
// the lazy useState initializers on mount but were never stripped from the
// URL afterward (unlike `openId`, which already got this exact treatment).
// Reloading the page at ANY later point - including after using the
// on-screen back arrow or "Change need"/"Change time" to move to a
// different step - re-evaluates `restoredIsValid` against those same stale
// params and silently snaps back to the `recommend` step, discarding
// whatever step the user actually navigated to. A WKWebView reload (a
// normal iOS event after backgrounding, or after a video's native
// fullscreen) is exactly the kind of event that can trigger this.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./Meditate.jsx');

describe('Meditate.jsx — the on-screen back control itself is already correct (unchanged by this fix)', () => {
  it('is a real accessible button with type="button" and the required "Go back" name', () => {
    const body = source.match(/<button\s+type="button"\s+onClick=\{handleStepBack\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/aria-label="Go back"/);
  });

  it('meets the 44x44px minimum touch target (w-11 h-11 in this app\'s Tailwind scale)', () => {
    const body = source.match(/<button\s+type="button"\s+onClick=\{handleStepBack\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(body).toMatch(/w-11 h-11/);
  });

  it('steps back exactly one wizard level: need -> duration, recommend -> need, pure local state, no navigate() call', () => {
    const body = source.match(/const handleStepBack = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(step === 'need'\) setStep\('duration'\);/);
    expect(body).toMatch(/else if \(step === 'recommend'\) setStep\('need'\);/);
    expect(body).not.toMatch(/navigate\(/);
  });

  it('the duration step (the wizard\'s first step) uses the real, shared BackButton instead, falling back to Home', () => {
    expect(source).toMatch(/step === 'duration' \? \(\s*\n\s*<BackButton fallback="\/" \/>/);
  });
});

describe('Meditate.jsx — the actual fix: one-time restore params are cleared after being consumed', () => {
  it('the mount effect strips need/duration alongside openId, not just openId alone', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*const hasOpenId[\s\S]*?\n {2}\}, \[\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/next\.delete\('openId'\);/);
    expect(body).toMatch(/next\.delete\('need'\);/);
    expect(body).toMatch(/next\.delete\('duration'\);/);
    expect(body).toMatch(/setSearchParams\(next, \{ replace: true \}\);/);
  });

  it('the strip runs whenever EITHER openId OR a restore param is present, not only when openId is', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*const hasOpenId[\s\S]*?\n {2}\}, \[\]\);/)?.[0] ?? '';
    expect(body).toMatch(/const hasOpenId = searchParams\.get\('openId'\);/);
    expect(body).toMatch(/const hasRestoreParams = searchParams\.get\('need'\) \|\| searchParams\.get\('duration'\);/);
    expect(body).toMatch(/if \(!hasOpenId && !hasRestoreParams\) return;/);
  });

  it('runs once on mount only (empty dependency array) - never re-strips on every render', () => {
    expect(source).toMatch(/\}, \[\]\);\s*\n\s*\n\s*const recommendation/);
  });
});

describe('Meditate.jsx — the lazy step initializer this fix protects', () => {
  it('only ever restores directly to the recommend step, and only when both need and duration are valid', () => {
    expect(source).toMatch(/const restoredIsValid =\s*\n\s*restoredNeed &&\s*\n\s*restoredDuration &&/);
    expect(source).toMatch(/const \[step, setStep\] = useState\(\(\) => \(restoredIsValid \? 'recommend' : 'duration'\)\);/);
  });

  it('after this fix, a reload with no restore params in the URL always falls through to the safe default (duration), never an unrelated stale step', () => {
    // the initializer's own fallback branch - unchanged, but only reachable
    // as intended once the params are actually gone from the URL.
    expect(source).toMatch(/restoredIsValid \? 'recommend' : 'duration'/);
  });
});

describe('Meditate.jsx — repeated taps cannot cause duplicate navigation', () => {
  it('handleStepBack only ever calls setStep, a pure/idempotent state setter — no navigate() or window.location anywhere in the wizard step logic', () => {
    const body = source.match(/const handleStepBack = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/navigate\(|window\.location/);
  });
});
