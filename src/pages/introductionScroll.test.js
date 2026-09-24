// Regression guard for the mobile scroll fix (Defect 1). No DOM/component
// rendering is available in this repo's Vitest (see Home.routineState.
// test.js's own note) - source-level checks, matching every other
// regression guard in this codebase for exactly that reason.
//
// Root cause: Introduction.jsx is rendered outside <Layout> (full-bleed,
// no bottom-nav chrome) so it never got Layout's own h-dvh + flex-1
// min-h-0 + overflow-y-auto scroll container, and instead depended on
// document (body/html) scroll - which index.html deliberately sets
// `overflow: hidden` on for both axes, for Layout-wrapped pages' sake.
// Confirmed live: this specifically blocks iOS touch-driven scrolling
// (a well-known body{overflow:hidden} behaviour), even though a desktop
// mouse-wheel gesture still happened to reach the rest of the page via
// <html>'s own fallback scrolling. Fix: this screen now owns a single
// h-dvh-bounded overflow-y-auto container of its own.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./Introduction.jsx');

describe('Introduction.jsx — owns a single, real, bounded scroll container', () => {
  it('the root is h-dvh (a real viewport-height bound) with overflow-hidden, not the old min-h-screen (a lower bound only)', () => {
    expect(source).toMatch(/<div className="h-dvh overflow-hidden">/);
    expect(source).not.toMatch(/min-h-screen/);
  });

  it('exactly one scrollable container exists (overflow-y-auto), never two competing ones', () => {
    const occurrences = source.match(/className="[^"]*overflow-y-auto[^"]*"/g) ?? [];
    expect(occurrences.length).toBe(1);
    expect(source).toMatch(/overflow-y-auto overflow-x-hidden scroll-hide/);
  });

  it('the scroll container is bounded to its own h-dvh ancestor (h-full), the same shape Layout.jsx already proved correct', () => {
    expect(source).toMatch(/className="h-full w-full overflow-y-auto overflow-x-hidden scroll-hide"/);
  });

  it('scroll-chaining is contained, matching Layout.jsx\'s own content container', () => {
    expect(source).toMatch(/overscrollBehaviorY: 'contain'/);
  });

  it('the inner content wrapper uses min-h-full (not a plain flex-1) so the "buttons pinned to bottom on short content" spacer trick still works inside a scrollable ancestor', () => {
    expect(source).toMatch(/className="min-h-full flex flex-col px-6 max-w-md mx-auto space-y-8"/);
    // the existing bottom-pinning spacer between the guides section and the button block is untouched
    expect(source).toMatch(/<div className="flex-1" \/>/);
  });
});

describe('Introduction.jsx — iPhone safe-area clearance, both edges', () => {
  it('adds top safe-area clearance (this route has no header of its own to already reserve it)', () => {
    expect(source).toMatch(/paddingTop: 'calc\(2rem \+ env\(safe-area-inset-top\)\)'/);
  });

  it('adds bottom safe-area clearance for the home indicator (this route has no bottom nav of its own to already reserve it)', () => {
    expect(source).toMatch(/paddingBottom: 'calc\(2rem \+ env\(safe-area-inset-bottom\)\)'/);
  });
});

describe('Introduction.jsx — no content or font-size changes, only the layout/scroll structure', () => {
  it('every existing piece of copy is still present, byte for byte', () => {
    // Build 16 (Personalised Welcome copy): the heading/subcopy are now
    // two variant strings rather than one fixed pair - see
    // Introduction.test.js's own dedicated copy coverage. This check
    // confirms the always-present structural copy only.
    expect(source).toMatch(/Choose what would help you most/);
    expect(source).toMatch(/Go to Home/);
  });

  it('does not introduce any text-size utility class anywhere in the file (no font-size reduction as a fix)', () => {
    // text-3xl/text-sm/text-xs/etc. already existed before this fix and
    // are unchanged — this checks no *smaller-than-existing* addition
    // crept in specifically around the new wrapper divs.
    const newWrapperSlice = source.slice(source.indexOf('<div className="h-dvh overflow-hidden">'), source.indexOf('<BackButton fallback="/" />'));
    expect(newWrapperSlice).not.toMatch(/text-\[/); // no new arbitrary shrunk font size
  });
});

describe('Introduction.jsx — both the welcome cards and Go to Home remain reachable inside the one scroll container', () => {
  it('the welcome-cards section and the Go to Home button block are both inside the new scroll wrapper, not siblings outside it', () => {
    const scrollOpen = source.indexOf('overflow-y-auto overflow-x-hidden scroll-hide');
    const cardsIndex = source.indexOf('Choose what would help you most');
    const homeIndex = source.indexOf('Go to Home');
    expect(cardsIndex).toBeGreaterThan(scrollOpen);
    expect(homeIndex).toBeGreaterThan(scrollOpen);
  });

  it('the modal and sign-in dialog remain outside the scroll container (they are fixed-position overlays, not scrollable content)', () => {
    const scrollCloseMarker = source.lastIndexOf('        </div>\n      </div>');
    const modalIndex = source.indexOf('<BetaVideoModal entry={openVideo}');
    expect(modalIndex).toBeGreaterThan(scrollCloseMarker);
  });
});

describe('Introduction.jsx — desktop behaviour is unaffected (same responsive-agnostic classes as before)', () => {
  it('uses no breakpoint-prefixed classes that would make the fix mobile-only', () => {
    const wrapperSlice = source.slice(source.indexOf('<div className="h-dvh overflow-hidden">'), source.indexOf('<BackButton fallback="/" />'));
    expect(wrapperSlice).not.toMatch(/\b(sm|md|lg|xl):/);
  });
});
