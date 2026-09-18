// Regression guard for the iPhone safe-area/header-overlap fix (Layout.jsx
// header + content wrapper, capacitor.config.json). This repo's Vitest runs
// in a plain Node environment with no DOM/component rendering (see
// vite.config.js and index.css.test.js's own note on this), so these are
// static source-text checks rather than a rendered assertion - they lock in
// that the safe-area handling stays in place and stays applied exactly
// once (never doubled between the CSS and the native shell).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const layoutSource = readFileSync(fileURLToPath(new URL('./Layout.jsx', import.meta.url)), 'utf-8');
const capacitorConfig = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../capacitor.config.json', import.meta.url)), 'utf-8')
);

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

describe('Capacitor iOS content-inset regression guard', () => {
  it('never lets the native WKWebView auto-inset itself, so CSS env() stays the single source of truth (no duplicate padding)', () => {
    expect(capacitorConfig.ios.contentInset).toBe('never');
  });
});
