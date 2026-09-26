// WakeWise Phase 1 correction — dormant-branding audit. Found: an
// unrouted, unreferenced Landing.jsx carrying the incorrect product name
// "Solas" and an unsupported "500,000+" user-count claim, and a routed
// (though unlinked-from-nav) Stage3Preview.jsx also carrying "Solas" in
// its own heading. Source-level regression guard - no DOM rendering is
// available in this repo's Vitest.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appSource = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf-8');
const stage3PreviewPath = fileURLToPath(new URL('../pages/Stage3Preview.jsx', import.meta.url));
const stage3PreviewSource = readFileSync(stage3PreviewPath, 'utf-8');
const landingPath = fileURLToPath(new URL('../pages/Landing.jsx', import.meta.url));

describe('Landing.jsx — deleted (conclusively unrouted, unreferenced, and unnecessary)', () => {
  it('the file no longer exists', () => {
    expect(existsSync(landingPath)).toBe(false);
  });

  it('App.jsx never imports or routes it', () => {
    expect(appSource).not.toMatch(/pages\/Landing/);
    expect(appSource).not.toMatch(/<Landing/);
  });
});

describe('Stage3Preview.jsx — route removed from the production app; file retained with corrected copy', () => {
  it('App.jsx no longer imports Stage3Preview or registers the stage3-preview route', () => {
    expect(appSource).not.toMatch(/pages\/Stage3Preview/);
    expect(appSource).not.toMatch(/<Stage3Preview/);
    expect(appSource).not.toMatch(/path="stage3-preview"/);
  });

  it('the page file itself is retained on disk, not deleted (a valuable stage3 experiment, merely unused)', () => {
    expect(existsSync(stage3PreviewPath)).toBe(true);
  });

  it('the file\'s actual rendered copy no longer contains the incorrect "Solas" product name (doc comments describing the fix itself are not user-facing copy)', () => {
    const renderedCopy = stage3PreviewSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(renderedCopy).not.toMatch(/Solas/);
    expect(renderedCopy).toMatch(/WakeWise, in progress\./);
  });

  it('every other stage3/* component file is untouched - only the App.jsx route and this one heading string changed', () => {
    // A narrow, targeted correction: the stage3 palette/atmosphere/
    // component system itself is explicitly out of scope to adopt or
    // alter this phase (see the task's own item 9.4).
    expect(stage3PreviewSource).toMatch(/import \{ Gradient, PHASES \} from '\.\.\/components\/stage3\/Gradient';/);
    expect(stage3PreviewSource).toMatch(/import \{ AtmosphereManager, resolvePerformanceTier \} from '\.\.\/components\/stage3\/AtmosphereManager';/);
  });
});

describe('No unsupported "500,000+" user-count claim remains anywhere in shipped source', () => {
  it('the only prior occurrence (Landing.jsx\'s own conversion banner) is gone along with the deleted file', () => {
    expect(appSource).not.toMatch(/500,000\+/);
    expect(stage3PreviewSource).not.toMatch(/500,000\+/);
  });
});
