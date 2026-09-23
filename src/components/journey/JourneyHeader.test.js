// Build 15 Phase B — JourneyHeader.jsx regression guard. Source-level
// checks - this repo's Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./JourneyHeader.jsx', import.meta.url)), 'utf-8');

describe('JourneyHeader.jsx — Back/Close, presentation only', () => {
  it('reuses the real shared BackButton for the first-step case, never a bespoke reimplementation', () => {
    expect(source).toMatch(/import \{ BackButton \} from '\.\.\/BackButton';/);
    expect(source).toMatch(/showBackButton \? \(\s*\n\s*<BackButton fallback=\{backFallback\} \/>/);
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
    expect(source).not.toMatch(/useState|useEffect|navigate\(/);
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
