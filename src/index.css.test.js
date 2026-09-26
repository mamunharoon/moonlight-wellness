// Regression guard for the iOS input auto-zoom fix (see index.css). This
// repo's Vitest runs in a plain Node environment with no DOM/component
// rendering available (see vite.config.js), so the actual zoom behaviour
// can't be exercised here - this instead locks in the two things that
// matter: the safe-font-size rule stays in place, and nobody "fixes" a
// future zoom regression by disabling pinch-zoom in the viewport meta tag.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('./index.css', import.meta.url)), 'utf-8');
const indexHtml = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf-8');

describe('iOS input auto-zoom regression guard', () => {
  it('keeps every input/textarea/select at the 16px iOS-safe floor, scoped to WebKit touch devices', () => {
    expect(css).toMatch(/@supports\s*\(-webkit-touch-callout:\s*none\)/);
    expect(css).toMatch(/font-size:\s*16px\s*!important/);
  });

  it('never disables accessibility pinch-zoom as a workaround', () => {
    expect(indexHtml).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(indexHtml).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/i);
  });
});

// WakeWise Phase 1 correction — .glass-panel's border previously composited
// to ~1.35-1.46:1 against every real adjacent surface tone (Home, Anytime
// Reset, Panic, Grounding, etc. all share this one class), badly failing
// WCAG 1.4.11's 3:1 non-text-contrast floor. This is a real measured-ratio
// regression guard (not a string match on the alpha value) so a future
// tweak to either the border alpha or any surface token automatically
// re-verifies the actual composited result, not just that some number
// changed.
describe('.glass-panel border non-text contrast (WCAG 1.4.11, >=3:1)', () => {
  const srgbToLinear = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const relativeLuminance = ([r, g, b]) =>
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
  const contrastRatio = (a, b) => {
    const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const composite = (fg, alpha, bg) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));
  const hexToRgb = (hex) => {
    const clean = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
  };

  const borderMatch = css.match(/\.glass-panel\s*\{[\s\S]*?border:\s*1px solid rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  const readToken = (name) => {
    const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
    return m ? hexToRgb(m[1]) : null;
  };

  // Every real dark-surface tone a .glass-panel card is actually rendered
  // against today (see index.css's own --color-* declarations) - not an
  // exhaustive design-token audit, just the adjacent-background set this
  // shared class must keep clearing 3:1 against.
  const adjacentBackgrounds = {
    background: readToken('background'),
    'home-background': readToken('home-background'),
    'surface-lowest': readToken('surface-lowest'),
    'surface-low': readToken('surface-low'),
    'surface-container': readToken('surface-container'),
    'surface-high': readToken('surface-high'),
    'surface-highest': readToken('surface-highest'),
  };

  it('defines the border as an rgba(255,255,255,<alpha>) so contrast is computable from source', () => {
    expect(borderMatch).not.toBeNull();
    expect(borderMatch[1]).toBe('255');
    expect(borderMatch[2]).toBe('255');
    expect(borderMatch[3]).toBe('255');
  });

  it('composites to at least 3:1 against every real adjacent surface tone', () => {
    const alpha = Number(borderMatch[4]);
    for (const [name, bg] of Object.entries(adjacentBackgrounds)) {
      expect(bg, `missing --color-${name} token`).not.toBeNull();
      const compositedBorder = composite([255, 255, 255], alpha, bg);
      const ratio = contrastRatio(compositedBorder, bg);
      expect(ratio, `${name} (${ratio.toFixed(3)}:1)`).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the fill translucency and blur unchanged - only the border was corrected', () => {
    expect(css).toMatch(/\.glass-panel\s*\{\s*background:\s*rgba\(255,\s*255,\s*255,\s*0\.05\)/);
    expect(css).toMatch(/backdrop-filter:\s*blur\(20px\)/);
  });
});
