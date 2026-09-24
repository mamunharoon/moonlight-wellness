// Morning Visual Uplift (Build 16) — Affirmation.jsx. Formalises the
// screen's own existing inline gradient/brown-text hardcoded values into
// named morning-affirmation-* tokens (src/index.css), applies the new
// Playfair Display heading token, and fixes a real pre-existing WCAG
// contrast defect found while doing so (the PRIMARY/SUPPORTING role
// label at peach/70% opacity over the near-white card - computed here,
// not merely asserted). Affirmation.jsx is Morning-exclusive, so this is
// a direct restyle with no shared-component risk; this file's other job
// is proving the real dynamic, intention-matched affirmation logic is
// completely untouched.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks plus real computed
// WCAG contrast math, matching this codebase's own established
// precedent (AnswerOptionButton.test.js's relLum/contrast helpers).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./Affirmation.jsx');
const cssSource = read('../index.css');

const relLum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
  const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};
const contrast = (a, b) => {
  const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

describe('Affirmation.jsx — gradient/text tokens formalised, not reinvented', () => {
  it('index.css defines the three real gradient stops (unchanged hex values, byte-identical to what this screen already hardcoded) and the on-morning-affirmation text token', () => {
    expect(cssSource).toMatch(/--color-morning-affirmation-from: #fffdfa;/);
    expect(cssSource).toMatch(/--color-morning-affirmation-via: #fff5f2;/);
    expect(cssSource).toMatch(/--color-morning-affirmation-to: #ffebd2;/);
    expect(cssSource).toMatch(/--color-on-morning-affirmation: #954835;/);
  });

  it('Affirmation.jsx now references the named tokens, not a hand-typed arbitrary-value gradient string', () => {
    expect(source).toMatch(/bg-gradient-to-tr from-morning-affirmation-from via-morning-affirmation-via to-morning-affirmation-to/);
    expect(source).not.toMatch(/from-\[#fffdfa\]/);
  });

  it('the heading now uses text-on-morning-affirmation (the token) instead of the old hardcoded text-\\[#954835\\] arbitrary value - same real colour, now named', () => {
    expect(source).toMatch(/text-on-morning-affirmation/);
    expect(source).not.toMatch(/text-\[#954835\]/);
  });
});

describe('Affirmation.jsx — real, computed WCAG contrast fix for the PRIMARY/SUPPORTING role label', () => {
  const cardViaStop = '#fff5f2'; // the most demanding of the three gradient stops
  const oldPeach = '#ffc5b7';
  const newBrown = '#954835';

  it('the OLD text-primary/70 treatment (peach at 70% opacity, blended over the card) genuinely failed the 4.5:1 AA normal-text floor', () => {
    // Compositing formula for a translucent foreground over an opaque
    // background: result = alpha*fg + (1-alpha)*bg, per channel.
    const blend = (fgHex, alpha, bgHex) => {
      const fg = fgHex.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
      const bg = bgHex.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
      const out = fg.map((c, i) => Math.round(alpha * c + (1 - alpha) * bg[i]));
      return '#' + out.map((c) => c.toString(16).padStart(2, '0')).join('');
    };
    const blended = blend(oldPeach, 0.7, cardViaStop);
    expect(contrast(blended, cardViaStop)).toBeLessThan(2);
  });

  it('the NEW on-morning-affirmation brown, at full opacity, clears the 4.5:1 AA normal-text floor by a wide margin - the same already-verified colour the heading itself already used successfully', () => {
    expect(contrast(newBrown, cardViaStop)).toBeGreaterThanOrEqual(6);
  });

  it('the label\'s own className in source no longer carries the failing /70 opacity modifier', () => {
    expect(source).toMatch(/text-\[9px\] font-bold uppercase tracking-wider text-on-morning-affirmation">\{roleForIndex\(idx\)\}/);
    expect(source).not.toMatch(/text-primary\/70/);
  });
});

describe('Affirmation.jsx — sparkle icon uses morning-accent gold, matching the intro screen\'s own sun-icon treatment', () => {
  it('auto_awesome is text-morning-accent, not the generic peach it used before', () => {
    expect(source).toMatch(/text-morning-accent text-4xl animate-pulse">auto_awesome/);
  });
});

describe('Affirmation.jsx — real dynamic, intention-matched affirmation logic is completely untouched', () => {
  it('affirmations are still derived per-intention via the real getAffirmationForIntention function, in Primary-then-Supporting order - never a hardcoded sample quote', () => {
    expect(source).toMatch(/const affirmations = intentions\.map\(\(intention\) => \(\{\s*\n\s*intention,\s*\n\s*affirmation: getAffirmationForIntention\(intention\)\s*\n\s*\}\)\);/);
  });

  it('the real supporting copy above the card is unchanged', () => {
    expect(source).toMatch(/Begin with a supportive thought to shape how you meet the day\./);
  });

  it('Continue and Skip both still call the same handleNext, which always advances to session-complete - Skip-equals-Continue is this step\'s own established pattern, untouched', () => {
    expect(source).toMatch(/const handleSkip = handleNext;/);
    expect(source).toMatch(/setJourneyStep\('complete'\);\s*\n\s*navigate\('\/session-complete'\);/);
  });

  it('Continue/Skip/Exit/Return-to-step buttons are all still the plain bg-primary or glass-panel treatment - never gold, matching the approved canonical tokens (primary action buttons stay peach app-wide)', () => {
    const controlsBlock = source.match(/<div className="space-y-3 w-full">\s*\n\s*\{isReviewMode[\s\S]*?\n {4}<\/div>/)?.[0] ?? '';
    expect(controlsBlock.length).toBeGreaterThan(0);
    expect(controlsBlock).not.toMatch(/morning-accent|morning-display/);
  });
});
