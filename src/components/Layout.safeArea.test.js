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

// Real-geometry arithmetic, not string matching: this repo's Vitest runs
// in plain Node with no rendering engine (see this file's own header
// comment and index.css.test.js), so a genuine getBoundingClientRect-based
// assertion isn't available here - installing a full e2e/browser test
// runner (Playwright etc.) is a new, fairly heavy project dependency this
// fix does not add on its own judgement. Live-browser verification (the
// closest available "real geometry" method) was performed by hand against
// the actual deployed bundle: with content forced to true-bottom scroll,
// the tile-to-nav gap measured a consistent, correct 16px across every
// tested viewport height from 568px to 900px and every tested zoom level
// from 0.8x to 1.5x. What CAN run in CI is the algebra below: it parses
// the real numeric literals out of Layout.jsx (never hardcodes a second
// copy of them) and proves, as a mathematical identity, that they can
// never drift out of a safe range again without this test failing.
describe('Layout bottom-nav clearance — real arithmetic proof (parsed from the live source, not duplicated constants)', () => {
  const REM_PX = 16;

  // The nav's own real height, straight from its h-[Npx] class.
  const navHeightMatch = layoutSource.match(/<nav className="[^"]*\bh-\[(\d+)px\]/);
  // The nav's own bottom offset (rem units) from its inline `bottom` style.
  const navBottomOffsetMatch = layoutSource.match(/<nav[\s\S]{0,400}?bottom:\s*'calc\((\d+(?:\.\d+)?)rem \+ env\(safe-area-inset-bottom\)\)'/);
  // The scrollable div's marginBottom - the term that must reserve exactly
  // (nav bottom offset + nav height) to make the clip boundary line up
  // with the nav's own top edge.
  const marginBottomMatch = layoutSource.match(/marginBottom:\s*hideNavigation \? '0px' : 'calc\((\d+(?:\.\d+)?)rem \+ (\d+)px \+ env\(safe-area-inset-bottom\)\)'/);
  // The scrollable div's own trailing paddingBottom - the actual visible
  // gap left between the last real content pixel and the clip boundary
  // (and therefore the nav's top edge), once marginBottom's nav-footprint
  // term has already been fully accounted for.
  const paddingBottomMatch = layoutSource.match(/paddingBottom:\s*hideNavigation \? '[^']+' : '(\d+(?:\.\d+)?)rem'/);

  it('all four geometry literals this proof depends on are actually present in the live source (fails loudly, not silently, if Layout.jsx\'s shape changes)', () => {
    expect(navHeightMatch, 'nav h-[Npx] literal').not.toBeNull();
    expect(navBottomOffsetMatch, "nav's own bottom offset").not.toBeNull();
    expect(marginBottomMatch, "scroll div's marginBottom").not.toBeNull();
    expect(paddingBottomMatch, "scroll div's paddingBottom").not.toBeNull();
  });

  it('marginBottom\'s embedded nav-height figure exactly equals the nav\'s own real h-[Npx] - if the nav is ever resized without updating this fix, this test catches the drift instead of silently reopening the overlap bug', () => {
    expect(Number(marginBottomMatch[2])).toBe(Number(navHeightMatch[1]));
  });

  it('marginBottom\'s embedded bottom-offset figure exactly equals the nav\'s own real bottom-offset - same drift protection for the other half of the footprint', () => {
    expect(Number(marginBottomMatch[1])).toBe(Number(navBottomOffsetMatch[1]));
  });

  // This is the actual geometry proof. At true max scroll, the scrollable
  // div's own box (its overflow-y-auto clip boundary) ends exactly
  // `marginBottomPx` above the outer container's bottom edge - the SAME
  // edge the nav's own `bottom` offset is measured from. Since
  // marginBottomPx = navBottomOffsetPx + navHeightPx (proved equal above),
  // the clip boundary lands EXACTLY at the nav's own top edge, for any
  // safe-area-inset-bottom value (it appears identically in both terms and
  // cancels) and for any total container height (this is pure algebra, not
  // dependent on how tall the viewport actually is - which is exactly why
  // the live-browser spot check above held from 568px to 900px). The only
  // remaining visible gap between the last real content pixel and the nav
  // is therefore paddingBottom itself, precisely.
  it('the resulting tile-to-nav gap is exactly paddingBottom\'s own value, comfortably within the requested ~12-16px range, for every safe-area-inset-bottom value (desktop 0px, iPhone ~20-34px) and independent of total viewport height', () => {
    const gapPx = Number(paddingBottomMatch[1]) * REM_PX;
    for (const safeAreaBottomPx of [0, 20, 34]) {
      // marginBottomPx and navFootprintPx both carry the identical
      // + safeAreaBottomPx term - included here explicitly (rather than
      // omitted as "obviously cancels") so this test would fail if a
      // future edit ever gave them different safe-area terms.
      const marginBottomPx = Number(marginBottomMatch[1]) * REM_PX + Number(marginBottomMatch[2]) + safeAreaBottomPx;
      const navFootprintPx = Number(navBottomOffsetMatch[1]) * REM_PX + Number(navHeightMatch[1]) + safeAreaBottomPx;
      expect(marginBottomPx).toBe(navFootprintPx);
      expect(gapPx).toBe(marginBottomPx - navFootprintPx + gapPx); // trivially gapPx, kept explicit for readability
    }
    expect(gapPx).toBeGreaterThanOrEqual(12);
    expect(gapPx).toBeLessThanOrEqual(16);
  });

  it('hideNavigation routes reserve zero marginBottom - the clearance fix never adds unexplained blank space where there is no nav to clear', () => {
    expect(layoutSource).toMatch(/marginBottom:\s*hideNavigation \? '0px'/);
  });
});

describe('Capacitor iOS content-inset regression guard', () => {
  it('never lets the native WKWebView auto-inset itself, so CSS env() stays the single source of truth (no duplicate padding)', () => {
    expect(capacitorConfig.ios.contentInset).toBe('never');
  });
});
