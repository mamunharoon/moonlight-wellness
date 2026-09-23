// Build 15 Phase B remediation (Task 4) — Back navigation from Home's
// "Browse exercises"/"Sleep sounds" quick-action tiles. Library.jsx is a
// primary bottom-nav destination (no back arrow by default); these two
// tiles now carry an explicit, allowlisted `?from=home` marker so
// Library shows a contextual "Back to Home" control only when reached
// that way. Source-level checks - this repo's Vitest has no rendering
// engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const librarySource = read('./Library.jsx');
const homeSource = read('./Home.jsx');
const layoutSource = read('../components/Layout.jsx');

describe('Home.jsx — Browse exercises/Sleep sounds tiles carry the Home-origin marker', () => {
  it('Browse exercises links to /library?from=home', () => {
    expect(homeSource).toMatch(/to="\/library\?from=home"/);
  });

  it('Sleep sounds links to /library?category=sleep-soundscapes&from=home, preserving its existing category filter', () => {
    expect(homeSource).toMatch(/to="\/library\?category=sleep-soundscapes&from=home"/);
  });
});

describe('Layout.jsx — the persistent bottom-nav Library tab is unchanged, never carries the marker', () => {
  it('the nav item still points at a bare /library, no query string at all', () => {
    expect(layoutSource).toMatch(/\{ label: 'Library', path: '\/library', icon: 'video_library' \}/);
  });
});

describe('Library.jsx — the Home-origin marker is captured once, before it is stripped from the URL', () => {
  it('imports the real shared BackButton, not a bespoke control', () => {
    expect(librarySource).toMatch(/import \{ BackButton \} from '\.\.\/components\/BackButton';/);
  });

  it('cameFromHome is a lazy one-time initializer reading the marker, not a live/derived value', () => {
    expect(librarySource).toMatch(/const \[cameFromHome\] = useState\(\(\) => searchParams\.get\('from'\) === 'home'\);/);
  });

  it('a mount-only effect strips only the `from` param, leaving category/openId completely untouched', () => {
    const body = librarySource.match(/useEffect\(\(\) => \{\s*\n\s*if \(searchParams\.get\('from'\)[\s\S]*?\}, \[\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/next\.delete\('from'\);/);
    expect(body).not.toMatch(/next\.delete\('category'\)/);
    expect(body).not.toMatch(/next\.delete\('openId'\)/);
    expect(body).toMatch(/setSearchParams\(next, \{ replace: true \}\);/);
  });
});

describe('Library.jsx — the contextual Back control itself', () => {
  it('only renders when cameFromHome is true - a plain bottom-nav visit (cameFromHome false) never shows it', () => {
    expect(librarySource).toMatch(/\{cameFromHome && \(/);
  });

  it('uses the real shared BackButton, fallback="/" (never relies on raw browser history alone, and never accepts a caller-supplied return URL)', () => {
    const block = librarySource.match(/\{cameFromHome && \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(block).toMatch(/<BackButton fallback="\/" label="Back to Home" \/>/);
  });

  it('the accessible label is exactly "Back to Home"', () => {
    expect(librarySource).toMatch(/label="Back to Home"/);
  });

  it('BackButton itself already guarantees the 44x44px touch target and a real fallback when no in-app history exists (see BackButton.jsx\'s own w-11 h-11 + goBack(fallback) contract) - never re-implemented here as a bespoke button', () => {
    expect(librarySource).not.toMatch(/<button[\s\S]{0,80}aria-label="Back to Home"/);
  });
});

describe('Library.jsx — everything else (search, filters, catalogue, video access) is completely unaffected', () => {
  it('search input and its live query state are unchanged', () => {
    expect(librarySource).toMatch(/placeholder="Search exercises and sounds\.\.\."/);
    expect(librarySource).toMatch(/const \[query, setQuery\] = useState\(''\);/);
  });

  it('category filter chips and handleSelectCategory (which already preserves the category param on every change) are unchanged', () => {
    expect(librarySource).toMatch(/const handleSelectCategory = \(category\) => \{/);
    expect(librarySource).toMatch(/next\.set\('category', slugify\(category\)\);/);
  });

  it('video selection still goes through the real, unmodified useProtectedVideo hook and BetaVideoModal - no second/alternate player, no Fast Start mapping touched', () => {
    expect(librarySource).toMatch(/import \{ useProtectedVideo \} from '\.\.\/hooks\/useProtectedVideo';/);
    expect(librarySource).toMatch(/import \{ BetaVideoModal \} from '\.\.\/components\/BetaVideoModal';/);
    expect(librarySource).toMatch(/onClick=\{\(\) => handleSelect\(entry\.id\)\}/);
  });
});
