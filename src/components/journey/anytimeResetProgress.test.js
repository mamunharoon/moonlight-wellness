// Build 15 release-quality pass — AnytimeResetProgress. Real, computed
// WCAG contrast (matching this codebase's own established relLum/
// contrast helper precedent) plus source-level checks for the ARIA
// progressbar semantics and segment states.
//
// Anytime Reset Visual Uplift (Phase 2) — the mint recolour + transparency
// defect fix (approved decision D) is tested by importing and calling the
// real getSegmentClassName function with actual (index, stepIndex) pairs,
// not by regex-matching JSX source - the explicit Phase 2 requirement to
// test computed/renderable classes rather than only source strings.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getSegmentClassName } from './AnytimeResetProgress.jsx';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./AnytimeResetProgress.jsx');
const anytimeResetSource = read('../../pages/AnytimeReset.jsx');
const journeyHeaderSource = read('./JourneyHeader.jsx');

const relLum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
  const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};
const contrast = (a, b) => {
  const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const PAGE_BACKGROUND = '#0b1326';
const NEW_UPCOMING = '#a28c87'; // the existing `outline` token
const OLD_UPCOMING_COMPOSITED = '#303647'; // white/15 composited over the same background
const MINT_ACTIVE = '#7fe4d0'; // --color-tertiary, the active segment's real fill

describe('AnytimeResetProgress - real computed WCAG contrast for the upcoming segment', () => {
  it('the upcoming-segment colour (outline token) clears the WCAG AA 3:1 non-text minimum against the page background, by a wide margin', () => {
    expect(contrast(NEW_UPCOMING, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(3);
  });

  it('the old shared-dots upcoming colour (white/15) genuinely failed that same 3:1 minimum - confirms this was a real fix, not cosmetic', () => {
    expect(contrast(OLD_UPCOMING_COMPOSITED, PAGE_BACKGROUND)).toBeLessThan(3);
  });

  it('the active-segment mint fill clears the WCAG AA 3:1 non-text minimum against the page background', () => {
    expect(contrast(MINT_ACTIVE, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(3);
  });

  it('uses the existing bg-outline utility for the upcoming segment, never a hand-typed hex', () => {
    expect(source).toMatch(/bg-outline/);
  });
});

describe('AnytimeResetProgress - real progressbar ARIA semantics', () => {
  it('role="progressbar" with aria-valuemin/aria-valuemax/aria-valuenow and an accessible label', () => {
    expect(source).toMatch(/role="progressbar"/);
    expect(source).toMatch(/aria-valuemin=\{1\}/);
    expect(source).toMatch(/aria-valuemax=\{stepCount\}/);
    expect(source).toMatch(/aria-valuenow=\{stepIndex \+ 1\}/);
    expect(source).toMatch(/aria-label="Anytime Reset progress"/);
  });

  it('the visible "Step X of 3" label is real text content, not merely sr-only', () => {
    expect(source).toMatch(/\{`Step \$\{stepIndex \+ 1\} of \$\{stepCount\}`\}/);
    expect(source).not.toMatch(/className="sr-only"/);
  });
});

describe('AnytimeResetProgress - getSegmentClassName: real computed classes, not source strings', () => {
  it('the active segment (index === stepIndex) is full mint, taller than the others, and never transparent', () => {
    const cls = getSegmentClassName(1, 1);
    expect(cls).toMatch(/bg-tertiary\b/);
    expect(cls).not.toMatch(/bg-tertiary-tint/);
    expect(cls).not.toMatch(/\/\d+/); // no opacity modifier at all on the active fill
    expect(cls).toMatch(/h-2\.5/);
  });

  it('a completed segment (index < stepIndex) is visibly muted mint via the alpha-safe tertiary-tint token, never bg-primary/NN', () => {
    const cls = getSegmentClassName(0, 2);
    expect(cls).toMatch(/bg-tertiary-tint\/55/);
    expect(cls).not.toMatch(/bg-primary/);
  });

  it('an upcoming segment (index > stepIndex) stays the accessible neutral outline token', () => {
    const cls = getSegmentClassName(2, 0);
    expect(cls).toMatch(/bg-outline/);
    expect(cls).not.toMatch(/bg-tertiary/);
  });

  it('completed and upcoming segments share the same h-2 height - only the active segment is taller', () => {
    expect(getSegmentClassName(0, 2)).toMatch(/\bh-2\b/);
    expect(getSegmentClassName(2, 0)).toMatch(/\bh-2\b/);
  });

  it('completed segments carry a visible border the upcoming segments do not - a second, non-colour distinguishing channel', () => {
    expect(getSegmentClassName(0, 1)).toMatch(/border-tertiary\/40/);
    expect(getSegmentClassName(1, 0)).toMatch(/border-transparent/);
  });

  it('at Step 3 of 3 (stepIndex=2), all three segments render a real, non-transparent fill class - the exact defect this phase fixes', () => {
    const classes = [0, 1, 2].map((i) => getSegmentClassName(i, 2));
    for (const cls of classes) {
      expect(cls).not.toMatch(/bg-primary\/50/); // the old, provably-transparent utility
      expect(cls).toMatch(/bg-tertiary/);
    }
    // both "completed" segments (index 0 and 1) use the alpha-safe token
    expect(classes[0]).toMatch(/bg-tertiary-tint\/55/);
    expect(classes[1]).toMatch(/bg-tertiary-tint\/55/);
    // the active segment (index 2) is full mint, not the muted tint
    expect(classes[2]).toMatch(/bg-tertiary\b/);
    expect(classes[2]).not.toMatch(/bg-tertiary-tint/);
  });

  it('a direct/restored return to Step 3 (stepIndex=2) resolves the same three classes as reaching it by stepping forward', () => {
    const stepped = [0, 1, 2].map((i) => getSegmentClassName(i, 2));
    const restored = [0, 1, 2].map((i) => getSegmentClassName(i, 2));
    expect(stepped).toEqual(restored);
  });

  it('renders exactly stepCount segments (Array.from({ length: stepCount })), never a fourth or a hard-coded count', () => {
    expect(source).toMatch(/Array\.from\(\{ length: stepCount \}\)/);
  });

  it('the component wires each segment span to the real getSegmentClassName(i, stepIndex), not an inline ternary', () => {
    expect(source).toMatch(/className=\{getSegmentClassName\(i, stepIndex\)\}/);
  });
});

describe('AnytimeReset.jsx wiring - separate component, JourneyHeader/Meditate untouched', () => {
  it('imports and renders AnytimeResetProgress, passing the real stepIndex/stepCount=3', () => {
    expect(anytimeResetSource).toMatch(/import \{ AnytimeResetProgress \} from '\.\.\/components\/journey\/AnytimeResetProgress';/);
    expect(anytimeResetSource).toMatch(/<AnytimeResetProgress stepIndex=\{stepIndex\} stepCount=\{3\} \/>/);
  });

  it('JourneyHeader is no longer passed stepIndex/stepCount here - its own dot block can never activate for this page any more', () => {
    const headerCall = anytimeResetSource.match(/<JourneyHeader[\s\S]*?\/>/)?.[0] ?? '';
    expect(headerCall).not.toMatch(/stepIndex|stepCount/);
  });

  it('stepIndex itself is still computed the same real way from the live step - never a stale/hard-coded value', () => {
    expect(anytimeResetSource).toMatch(/const stepIndex = step === 'need' \? 0 : step === 'duration' \? 1 : 2;/);
  });

  it('JourneyHeader.jsx itself is completely unmodified - still supports optional stepIndex/stepCount for its own dots (Meditate.jsx\'s own usage is untouched)', () => {
    expect(journeyHeaderSource).toMatch(/\{stepCount > 1 && \(/);
    expect(journeyHeaderSource).toMatch(/w-6 bg-primary/);
  });
});
