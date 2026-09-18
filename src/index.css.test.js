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
