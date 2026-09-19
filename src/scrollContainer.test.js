// Regression guard for the real scroll-container defect diagnosed live
// (deployed DEV, active Breathe countdown, real trusted wheel input via
// CDP mouse-wheel dispatch): getComputedStyle(document.body).overflow
// reported "hidden auto", not "hidden hidden" - `overflow-x-hidden` alone
// (no overflow-y) left body's used overflow-y at the CSS-initial
// `visible`, which the Overflow spec then converts to `auto` per the
// "one axis restricted, the other still visible" rule, turning <body>
// into a second, independent scrollable element that competes with
// Layout.jsx's own single intended scroll container. No DOM/computed-style
// evaluation is available in this repo's Node-environment Vitest (see
// index.css.test.js's own note) - this locks in the actual source fix.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const indexHtml = read('../index.html');
const layoutSource = read('./components/Layout.jsx');

describe('index.html - body has no ambiguous overflow-y left to the CSS-spec default', () => {
  it('body sets overflow-hidden (both axes explicit), never overflow-x-hidden alone', () => {
    expect(indexHtml).toMatch(/<body class="m-0 p-0 overflow-hidden">/);
    expect(indexHtml).not.toMatch(/<body class="[^"]*overflow-x-hidden(?!\S)/);
  });
});

describe('Layout.jsx - the one intended scroll container', () => {
  it('is the sole element with overflow-y-auto as an actual className in this file - no competing second scroll owner introduced here', () => {
    const classNameMatches = layoutSource.match(/className="[^"]*overflow-y-auto[^"]*"/g) ?? [];
    expect(classNameMatches.length).toBe(1);
  });

  it('scopes overscroll behavior to itself so a wheel gesture at its own scroll boundary never chains to an ancestor', () => {
    expect(layoutSource).toMatch(/overscrollBehaviorY: 'contain'/);
  });

  it('root container uses h-dvh (a real, dynamic-viewport-aware bound) with min-h-0 so the inner overflow-y-auto div can actually engage its own scrolling', () => {
    expect(layoutSource).toMatch(/className="h-dvh bg-background text-on-surface flex flex-col transition-colors duration-300"/);
    expect(layoutSource).toMatch(/className="relative flex-1 min-h-0 flex flex-col max-w-md w-full mx-auto z-10"/);
  });
});
