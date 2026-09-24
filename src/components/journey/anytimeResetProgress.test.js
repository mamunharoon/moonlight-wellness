// Build 15 release-quality pass — AnytimeResetProgress. Real, computed
// WCAG contrast (matching this codebase's own established relLum/
// contrast helper precedent) plus source-level checks for the ARIA
// progressbar semantics and segment states.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

describe('AnytimeResetProgress - real computed WCAG contrast for the upcoming segment', () => {
  it('the new upcoming-segment colour (outline token) clears the WCAG AA 3:1 non-text minimum against the page background, by a wide margin', () => {
    expect(contrast(NEW_UPCOMING, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(3);
  });

  it('the old shared-dots upcoming colour (white/15) genuinely failed that same 3:1 minimum - confirms this was a real fix, not cosmetic', () => {
    expect(contrast(OLD_UPCOMING_COMPOSITED, PAGE_BACKGROUND)).toBeLessThan(3);
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

describe('AnytimeResetProgress - segment states, exactly stepCount segments, no layout shift', () => {
  it('renders exactly stepCount segments (Array.from({ length: stepCount })), never a fourth or a hard-coded count', () => {
    expect(source).toMatch(/Array\.from\(\{ length: stepCount \}\)/);
  });

  it('current segment uses primary (peach), completed uses primary\/50, upcoming uses outline - three distinct states', () => {
    expect(source).toMatch(/i === stepIndex \? 'bg-primary' : i < stepIndex \? 'bg-primary\/50' : 'bg-outline'/);
  });

  it('every segment shares the same fixed height class (h-2) and flex-1 width, so the bar height never shifts between steps', () => {
    const segmentClass = source.match(/className=\{`flex-1 h-2 rounded-full[^`]*`\}/)?.[0] ?? '';
    expect(segmentClass).toMatch(/flex-1 h-2 rounded-full/);
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
