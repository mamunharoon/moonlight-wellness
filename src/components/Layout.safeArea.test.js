// Regression guard for the iPhone safe-area/header-overlap fix (Layout.jsx
// header + content wrapper, capacitor.config.ts). This repo's Vitest runs
// in a plain Node environment with no DOM/component rendering (see
// vite.config.js and index.css.test.js's own note on this), so these are
// static source-text checks rather than a rendered assertion - they lock in
// that the safe-area handling stays in place and stays applied exactly
// once (never doubled between the CSS and the native shell).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import capacitorConfig from '../../capacitor.config.ts';

const layoutSource = readFileSync(fileURLToPath(new URL('./Layout.jsx', import.meta.url)), 'utf-8');

describe('Layout safe-area handling', () => {
  it('pads the header for the top safe area (notch/Dynamic Island/status bar)', () => {
    expect(layoutSource).toMatch(/paddingTop:\s*'calc\(1rem \+ env\(safe-area-inset-top\)\)'/);
  });

  it('pads the content wrapper for the top safe area only when the header is hidden, never both at once', () => {
    expect(layoutSource).toMatch(/paddingTop:\s*hideNavigation\s*\?\s*'calc\(1rem \+ env\(safe-area-inset-top\)\)'\s*:\s*'1rem'/);
  });

  it('pads the root container for the left/right safe area (landscape notch/Dynamic Island)', () => {
    expect(layoutSource).toMatch(/paddingLeft:\s*'env\(safe-area-inset-left\)'/);
    expect(layoutSource).toMatch(/paddingRight:\s*'env\(safe-area-inset-right\)'/);
  });

  it('keeps the bottom nav/audio-player safe-area-inset-bottom handling this fix must not regress', () => {
    expect(layoutSource).toMatch(/env\(safe-area-inset-bottom\)/);
  });
});

describe('Layout bottom-nav overlap fix (found live on tall/desktop viewports)', () => {
  it('the scrollable content div reserves the nav\'s exact footprint via marginBottom, not just paddingBottom - a margin genuinely shrinks the flex item\'s own box so content can never render behind the absolutely-positioned nav, whether or not the page needs to scroll', () => {
    expect(layoutSource).toMatch(/marginBottom:\s*hideNavigation\s*\?\s*'0px'\s*:\s*'calc\(1rem \+ 72px \+ env\(safe-area-inset-bottom\)\)'/);
  });

  it('marginBottom is only reserved when the nav actually renders - routes that hide it (hideNavigation) get no unexplained blank space at the bottom', () => {
    const navRenderGuard = layoutSource.match(/\{!hideNavigation && \(\s*\n\s*<nav/);
    expect(navRenderGuard).not.toBeNull();
  });

  it('paddingBottom no longer double-counts the safe-area-bottom inset already reserved by marginBottom', () => {
    expect(layoutSource).toMatch(/paddingBottom:\s*hideNavigation\s*\?\s*'calc\(7\.5rem \+ env\(safe-area-inset-bottom\)\)'\s*:\s*'1rem'/);
  });

  it('the reserved footprint (72px) matches the nav\'s own real rendered height (h-[72px])', () => {
    expect(layoutSource).toMatch(/h-\[72px\]/);
    expect(layoutSource).toMatch(/marginBottom:[\s\S]{0,80}72px/);
  });
});

describe('Capacitor iOS content-inset regression guard', () => {
  it('never lets the native WKWebView auto-inset itself, so CSS env() stays the single source of truth (no duplicate padding)', () => {
    expect(capacitorConfig.ios.contentInset).toBe('never');
  });
});
