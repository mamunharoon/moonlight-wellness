// WakeWise Phase 3A (3A.2 / 3A.3) — real computed-value regression guards,
// not source-string presence checks. Reads the actual CSS custom-property
// hex/RGB values straight out of src/index.css (never duplicates them as
// hardcoded literals here, so a future token edit can't silently drift out
// of sync with this test) and runs the same WCAG relative-luminance
// contrast formula confirmDialogSeverity.test.js already established as
// this repo's own precedent for "real computed, not eyeballed" checks.
//
// 3A.2 (journey-coloured BreathingRing): the ring's per-tone text-on-orb
// pairing (RING_TOKENS in BreathingRing.jsx) must clear WCAG AA 4.5:1 for
// every tone the ring actually ships with, including the Hold phase's own
// brightness-110 filter (which lightens the orb further).
//
// 3A.3 (accent-border opacity correctness): journeyTone.js's unselectedRow
// borders (evening-accent-tint/55, morning-accent-tint/55, tertiary-tint/55)
// were previously plain-var opacity modifiers (border-evening-accent/55
// etc.) that Tailwind cannot generate a rule for at all — verified via a
// real `npx tailwindcss` build producing zero output for those exact
// class names before this fix, and the correct rule after switching to the
// RGB-triplet -tint tokens. This test verifies the -tint token's RGB
// triplet is byte-identical to its hex sibling (the fix depends on that
// equivalence holding) and that the composited border colour at its
// shipped opacity still clears the 3:1 non-text/UI-boundary floor against
// the row's own surface-container background.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const indexCss = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf-8');
const journeyToneSource = readFileSync(fileURLToPath(new URL('./journeyTone.js', import.meta.url)), 'utf-8');
const breathingRingSource = readFileSync(fileURLToPath(new URL('../components/BreathingRing.jsx', import.meta.url)), 'utf-8');

const cssVar = (name) => {
  const match = indexCss.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`CSS variable --${name} not found in index.css`);
  return match[1].trim();
};

const relLum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
  const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};
const contrast = (a, b) => {
  const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
const brighten110 = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => Math.min(255, Math.round(parseInt(h, 16) * 1.1)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
};
const rgbTripletToHex = (triplet) =>
  '#' + triplet.trim().split(/\s+/).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
const composite = (fgHex, alpha, bgHex) => {
  const fg = fgHex.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
  const bg = bgHex.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
  const out = fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
};

describe('Phase 3A.2 — BreathingRing per-tone text/orb contrast clears WCAG AA 4.5:1, including Hold brightness-110', () => {
  const tones = {
    morning: { text: cssVar('color-on-gratitude-accent'), orb: cssVar('color-gratitude-accent') },
    anytime: { text: cssVar('color-on-tertiary'), orb: cssVar('color-tertiary') },
    evening: { text: cssVar('color-on-evening-accent'), orb: cssVar('color-evening-accent') }
  };

  for (const [tone, { text, orb }] of Object.entries(tones)) {
    it(`${tone}: label text vs orb clears 4.5:1 at rest`, () => {
      expect(contrast(text, orb)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${tone}: label text vs orb clears 4.5:1 under Hold's brightness-110 filter`, () => {
      expect(contrast(text, brighten110(orb))).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('BreathingRing.jsx actually wires each tone to its own text/orb token pair (not a shared fallback)', () => {
    expect(breathingRingSource).toMatch(/morning:\s*\{[\s\S]*?orb: 'bg-morning-accent[\s\S]*?text: 'text-on-morning-accent'/);
    expect(breathingRingSource).toMatch(/anytime:\s*\{[\s\S]*?orb: 'bg-tertiary[\s\S]*?text: 'text-on-tertiary'/);
    expect(breathingRingSource).toMatch(/evening:\s*\{[\s\S]*?orb: 'bg-evening-accent[\s\S]*?text: 'text-on-evening-accent'/);
  });
});

describe('Phase 3A.3 — accent-border opacity tokens: -tint RGB triplet matches its hex sibling exactly', () => {
  it('morning-accent-tint triplet equals gratitude-accent hex (the colour morning-accent aliases)', () => {
    expect(rgbTripletToHex(cssVar('color-morning-accent-tint'))).toBe(cssVar('color-gratitude-accent').toLowerCase());
  });

  it('evening-accent-tint triplet equals evening-accent hex', () => {
    expect(rgbTripletToHex(cssVar('color-evening-accent-tint'))).toBe(cssVar('color-evening-accent').toLowerCase());
  });

  it('tertiary-tint triplet equals tertiary hex', () => {
    expect(rgbTripletToHex(cssVar('color-tertiary-tint'))).toBe(cssVar('color-tertiary').toLowerCase());
  });
});

describe('Phase 3A.3 — composited border contrast at shipped opacity clears the 3:1 UI-boundary floor', () => {
  const surfaceContainer = cssVar('color-surface-container');
  const borders = {
    evening: { hex: cssVar('color-evening-accent'), alpha: 0.55 },
    morning: { hex: cssVar('color-gratitude-accent'), alpha: 0.55 },
    tertiary: { hex: cssVar('color-tertiary'), alpha: 0.55 }
  };

  for (const [tone, { hex, alpha }] of Object.entries(borders)) {
    it(`${tone} unselectedRow border at /${Math.round(alpha * 100)} clears 3:1 against surface-container`, () => {
      const composited = composite(hex, alpha, surfaceContainer);
      expect(contrast(composited, surfaceContainer)).toBeGreaterThanOrEqual(3);
    });
  }

  it('journeyTone.js unselectedRow now uses the RGB-triplet -tint tokens, not the plain-var tokens Tailwind cannot apply an opacity modifier to', () => {
    expect(journeyToneSource).toMatch(/evening:\s*\{[\s\S]*?unselectedRow: 'bg-surface-container border-evening-accent-tint\/55/);
    expect(journeyToneSource).toMatch(/morning:\s*\{[\s\S]*?unselectedRow: 'bg-surface-container border-morning-accent-tint\/55/);
    expect(journeyToneSource).toMatch(/anytime:\s*\{[\s\S]*?unselectedRow: 'bg-surface-container border-tertiary-tint\/55/);
  });

  it('does not touch the primary tone (pre-existing, separately-scoped, no -tint token exists for it)', () => {
    expect(journeyToneSource).toMatch(/primary:\s*\{[\s\S]*?unselectedRow: 'bg-surface-container border-primary\/50/);
  });
});
