// "Explore More" discovery, Phase 5 — source-level regression guard for
// ExploreCard.jsx, matching this repo's established convention for
// components with no DOM rendering available.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./ExploreCard.jsx', import.meta.url)), 'utf-8');
// Strips /* ... */ comments - this file's own doc comments legitimately
// discuss exploreFiltering.js/Library.jsx conceptually (explaining what
// resolves the props this component only ever renders), which must not
// itself trip a check for the real, executable code never importing them.
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('ExploreCard — one shared, reusable implementation', () => {
  it('is a single exported component - never three separate journey-specific implementations', () => {
    const matches = source.match(/export const \w+ = /g) ?? [];
    expect(matches.length).toBe(1);
    expect(source).toMatch(/export const ExploreCard = /);
  });

  it('accepts journey/icon/title/supportingText/ctaLabel/to/itemCount as props - a plain navigation card, no destination-resolution logic of its own', () => {
    expect(source).toMatch(/export const ExploreCard = \(\{ journey, icon, title, supportingText, ctaLabel, to, itemCount \}\) => \(/);
  });
});

describe('ExploreCard — journey tone: Morning gold, Anytime mint, Evening periwinkle', () => {
  it('the accent border colour reuses this app\'s own existing -accent-tint CSS custom properties (morning 253/186/116, evening 159/180/240, anytime 127/228/208 - the exact same value RecommendationCard.jsx already uses for its own anytime accent) - never invents a new colour', () => {
    expect(source).toMatch(/morning: \{ borderColor: 'rgba\(253, 186, 116, 0\.35\)' \}/);
    expect(source).toMatch(/evening: \{ borderColor: 'rgba\(159, 180, 240, 0\.35\)' \}/);
    expect(source).toMatch(/anytime: \{ borderColor: 'rgba\(127, 228, 208, 0\.35\)' \}/);
  });

  it('reuses the exact same shadow-*-glow tokens CompletionReveal.jsx already established - never a new glow colour', () => {
    expect(source).toMatch(/morning: 'shadow-morning-glow'/);
    expect(source).toMatch(/evening: 'shadow-evening-glow'/);
    expect(source).toMatch(/anytime: 'shadow-mint-glow'/);
  });

  it('the border colour is applied via inline style, never a Tailwind border-* class - matching RecommendationCard.jsx\'s own documented reason (glass-panel\'s own border shorthand wins over a same-specificity utility class)', () => {
    expect(source).toMatch(/style=\{JOURNEY_ACCENT_STYLE\[journey\]\}/);
    expect(source).not.toMatch(/className="[^"]*\bborder-morning-accent\b/);
  });
});

describe('ExploreCard — accessibility and touch target', () => {
  it('carries min-h-[44px] - the minimum 44x44 tap target', () => {
    expect(source).toMatch(/min-h-\[44px\]/);
  });

  it('is keyboard-reachable and carries an explicit aria-label combining the CTA and the title, not relying on visually-implied context alone', () => {
    expect(source).toMatch(/aria-label=\{`\$\{ctaLabel\}: \$\{title\}`\}/);
  });

  it('is rendered as a real <Link>, not a div with an onClick - keyboard/screen-reader navigable by default, never a click-only pseudo-button', () => {
    expect(source).toMatch(/<Link\s*\n\s*to=\{to\}/);
  });

  it('the icon is aria-hidden (decorative only) - the accessible name comes entirely from the explicit aria-label, not the icon glyph', () => {
    expect(source).toMatch(/<span className="material-symbols-outlined text-xl" aria-hidden="true">\{icon\}<\/span>/);
  });
});

describe('ExploreCard — 320-430px structural layout safety', () => {
  it('the fixed-size icon badge is shrink-0 (never compressed) and the variable-length text content is flex-1 min-w-0 (allowed to shrink/wrap instead of pushing the card wider than the viewport) - the same established overflow-safety pattern RecommendationCard.jsx/Library.jsx\'s own item rows already use', () => {
    expect(source).toMatch(/w-11 h-11 rounded-full flex items-center justify-center shrink-0/);
    expect(source).toMatch(/className="flex-1 min-w-0 space-y-1"/);
  });

  it('title and supportingText are both block-level (never nowrap/truncate) - a long title/sentence wraps onto multiple lines rather than being clipped or overflowing at 320px', () => {
    expect(source).toMatch(/className="block text-sm font-bold text-on-surface">\{title\}/);
    expect(source).toMatch(/className="block text-xs text-on-surface-variant leading-relaxed">\{supportingText\}/);
    expect(source).not.toMatch(/whitespace-nowrap|truncate/);
  });
});

describe('ExploreCard — content contract', () => {
  it('renders title and one supportingText sentence - never a hardcoded copy string baked into this shared shell', () => {
    expect(source).toMatch(/\{title\}/);
    expect(source).toMatch(/\{supportingText\}/);
  });

  it('itemCount is optional and only rendered when it is a genuine positive number - never a fabricated/placeholder count', () => {
    expect(source).toMatch(/typeof itemCount === 'number' && itemCount > 0/);
  });

  it('this component never imports or references mediaCatalog.js/exploreFiltering.js directly - it only ever renders props a caller already resolved, matching RecommendationCard.jsx\'s own "shell owns only markup" precedent', () => {
    expect(codeOnly).not.toMatch(/mediaCatalog|exploreFiltering/);
  });
});
