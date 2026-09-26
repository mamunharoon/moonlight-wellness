// Build 15 Phase B — JourneyHeader.jsx regression guard. Source-level
// checks - this repo's Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./JourneyHeader.jsx', import.meta.url)), 'utf-8');

describe('JourneyHeader.jsx — Back/Close, presentation only', () => {
  it('reuses the real shared BackButton for the first-step case, never a bespoke reimplementation', () => {
    expect(source).toMatch(/import \{ BackButton \} from '\.\.\/BackButton';/);
    expect(source).toMatch(/showBackButton \? \(\s*\n\s*<BackButton fallback=\{backFallback\} onBeforeLeave=\{onBackBeforeLeave\} alwaysFallback=\{alwaysFallback\} \/>/);
  });

  // Context-aware Meditation/Breathing theming — additive pass-through,
  // default undefined so every existing caller keeps BackButton's own
  // default (undefined -> always proceeds), completely unaffected.
  it('onBackBeforeLeave is forwarded straight through to BackButton, optional', () => {
    expect(source).toMatch(/onBackBeforeLeave,\s*\n\s*alwaysFallback = false\s*\n\}\) => \(/);
  });

  // WakeWise DEV — Anytime Back-navigation correction, additive - every
  // existing caller omits it (defaults false) and is completely
  // unaffected.
  it('alwaysFallback is forwarded straight through to BackButton\'s own alwaysFallback, defaulting to false', () => {
    expect(source).toMatch(/alwaysFallback = false\s*\n\}\) => \(/);
    expect(source).toMatch(/<BackButton fallback=\{backFallback\} onBeforeLeave=\{onBackBeforeLeave\} alwaysFallback=\{alwaysFallback\} \/>/);
  });

  it('the step-back and Close controls are explicit 44x44 (w-11 h-11), matching the app\'s established circular icon-button convention', () => {
    const backBtn = source.match(/onClick=\{onStepBack\}[\s\S]{0,300}/)?.[0] ?? '';
    expect(backBtn).toMatch(/w-11 h-11/);
    expect(backBtn).toMatch(/aria-label="Go back"/);
    const closeBtn = source.match(/onClick=\{onClose\}[\s\S]{0,300}/)?.[0] ?? '';
    expect(closeBtn).toMatch(/w-11 h-11/);
    expect(closeBtn).toMatch(/aria-label="Close"/);
  });

  it('both controls carry a visible focus-visible ring, never relying only on the browser default', () => {
    expect(source).toMatch(/onClick=\{onStepBack\}[\s\S]{0,300}focus-visible:ring-2 focus-visible:ring-primary/);
    expect(source).toMatch(/onClick=\{onClose\}[\s\S]{0,300}focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('holds no state and makes no navigation decisions of its own - every action is a prop the caller supplies', () => {
    // WakeWise DEV Anytime Back-navigation correction: the new
    // alwaysFallback doc comment above legitimately names "navigate(-1)"
    // in prose explaining what BackButton's own goBack() does - strip
    // comments first so only real code is checked, matching this
    // codebase's own established "strip comments before checking real
    // code" pattern (see selfGuidedMeditationComplete.test.js).
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/useState|useEffect|navigate\(/);
  });
});

describe('JourneyHeader.jsx — showCloseButton (Journey Embedding fix, additive; default true)', () => {
  it('defaults to true - every existing caller that omits the prop keeps rendering the Close button exactly as before', () => {
    expect(source).toMatch(/showCloseButton = true/);
  });

  it('the Close button only renders when showCloseButton is true - the Back arrow is unaffected either way (rendered by the sibling showBackButton branch, not gated on this prop)', () => {
    const closeBlock = source.match(/\{showCloseButton && \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(closeBlock).toMatch(/onClick=\{onClose\}/);
    expect(closeBlock).toMatch(/aria-label="Close"/);
    // The back-arrow branch (showBackButton false) is a sibling, outside
    // the showCloseButton-gated block entirely.
    const backBranch = source.match(/\{showBackButton \? \([\s\S]*?\) : \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(backBranch).not.toMatch(/showCloseButton/);
  });
});

describe('JourneyHeader.jsx — step progress dots (additive, VoiceOver-friendly)', () => {
  it('only renders the progress row when stepCount > 1, so a single-step caller sees no unexpected UI', () => {
    expect(source).toMatch(/\{stepCount > 1 && \(/);
  });

  it('the active dot is distinguished by width AND colour together, never colour alone', () => {
    expect(source).toMatch(/i === stepIndex\s*\n\s*\? 'w-6 bg-primary'/);
  });

  it('the dot row itself is aria-hidden, with a visually-hidden "Step X of Y" string carrying the real value for VoiceOver', () => {
    expect(source).toMatch(/aria-hidden="true"/);
    expect(source).toMatch(/<span className="sr-only">\{`Step \$\{stepIndex \+ 1\} of \$\{stepCount\}`\}<\/span>/);
  });
});
