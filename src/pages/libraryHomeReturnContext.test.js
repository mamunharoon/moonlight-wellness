// Build 15 Phase B remediation (Task 4) / Build 15 DEV correction —
// contextual Back navigation into Library.jsx. Library.jsx is a main
// bottom-nav destination (no back arrow by default); specific callers
// link here with an explicit, ALLOWLISTED `?from=` marker so Library
// shows a contextual Back control only when reached that way, landing on
// a fixed, pre-approved destination - never a free-form `returnTo` URL.
// Two contexts exist: `from=home` (Home's "Browse exercises"/"Sleep
// sounds" quick-action tiles → Back to Home) and `from=evening-summary`
// (EveningComplete.jsx's "Choose a Sleep Experience" → Back to Evening
// Summary, fixing the DEV defect where that screen had no way back).
// Source-level checks - this repo's Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const librarySource = read('./Library.jsx');
const homeSource = read('./Home.jsx');
const eveningCompleteSource = read('./EveningComplete.jsx');
const layoutSource = read('../components/Layout.jsx');

describe('Home.jsx — Browse exercises/Sleep sounds tiles carry the Home-origin marker', () => {
  it('Browse exercises links to /library?from=home', () => {
    expect(homeSource).toMatch(/to="\/library\?from=home"/);
  });

  it('Sleep sounds links to /library?category=sleep-soundscapes&from=home, preserving its existing category filter', () => {
    expect(homeSource).toMatch(/to="\/library\?category=sleep-soundscapes&from=home"/);
  });
});

// Item 1 - Choose a Sleep Experience includes the allowlisted Evening
// Summary entry context, and item 2 - the existing sleep filter survives
// intact alongside it.
describe('EveningComplete.jsx — Choose a Sleep Experience carries the evening-summary marker, filter intact', () => {
  it('navigates to /library?category=sleep-soundscapes&from=evening-summary - the exact same category filter as before, plus the new marker', () => {
    expect(eveningCompleteSource).toMatch(/onClick=\{\(\) => navigate\('\/library\?category=sleep-soundscapes&from=evening-summary'\)\}/);
  });

  it('is not gated behind isGuest - the marker/filter combination is identical for guests and authenticated users (only Review/Edit/Redo above it are guest-excluded)', () => {
    const sleepIdx = eveningCompleteSource.indexOf("category=sleep-soundscapes&from=evening-summary");
    const precedingBlock = eveningCompleteSource.slice(Math.max(0, sleepIdx - 300), sleepIdx);
    expect(precedingBlock).not.toMatch(/\{!isGuest && \($/);
  });
});

describe('Layout.jsx — the persistent bottom-nav Library tab is unchanged, never carries any marker', () => {
  it('the nav item still points at a bare /library, no query string at all', () => {
    expect(layoutSource).toMatch(/\{ label: 'Library', path: '\/library', icon: 'video_library' \}/);
  });
});

describe('Library.jsx — FROM_CONTEXTS is the one allowlist; the marker only ever SELECTS a pre-approved destination', () => {
  it('defines exactly the two approved contexts, each a fixed, hardcoded {fallback, label} pair - never a value read from the URL itself', () => {
    expect(librarySource).toMatch(
      /const FROM_CONTEXTS = \{\s*\n\s*home: \{ fallback: '\/', label: 'Back to Home' \},\s*\n\s*'evening-summary': \{ fallback: '\/evening-complete', label: 'Back to Evening Summary' \}\s*\n\s*\};/
    );
  });

  it('imports the real shared BackButton, not a bespoke control', () => {
    expect(librarySource).toMatch(/import \{ BackButton \} from '\.\.\/components\/BackButton';/);
  });

  it('entryContext is a lazy one-time initializer that looks the raw `from` value up in FROM_CONTEXTS - never a live/derived value, never used as a destination directly', () => {
    expect(librarySource).toMatch(/const \[entryContext\] = useState\(\(\) => FROM_CONTEXTS\[searchParams\.get\('from'\)\]\);/);
  });

  // Item 6/7 - an unknown or missing `from` value, or any raw/arbitrary
  // string (a URL, a path, anything not a literal key of FROM_CONTEXTS),
  // resolves to `undefined` via the plain object lookup - there is no
  // code path anywhere in this file that ever reads `from` as a
  // navigable destination itself.
  it('an unrecognised or missing `from` value can never redirect anywhere - the raw value is only ever used as an object lookup key, never as a destination itself', () => {
    expect(librarySource).not.toMatch(/navigate\(searchParams\.get\('from'\)/);
    expect(librarySource).not.toMatch(/fallback=\{searchParams\.get\('from'\)\}/);
    // (the doc comment above FROM_CONTEXTS mentions "returnTo" in prose,
    // explaining what this mechanism deliberately is NOT - strip comments
    // before checking the actual code contains no such thing.)
    const code = librarySource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/returnTo/i);
    // searchParams.get('from') appears exactly twice in the actual code -
    // both are the same allowlist-lookup shape, never anything else (a
    // third mention lives only in a doc comment, explaining the pattern).
    const rawFromUsages = code.match(/searchParams\.get\('from'\)/g) ?? [];
    expect(rawFromUsages.length).toBe(2);
    expect(code).toMatch(/FROM_CONTEXTS\[searchParams\.get\('from'\)\]/g);
  });

  it('a mount-only effect strips the `from` marker only when it was a genuine allowlisted value, leaving category/openId completely untouched', () => {
    const body = librarySource.match(/useEffect\(\(\) => \{\s*\n\s*if \(!FROM_CONTEXTS\[searchParams\.get\('from'\)\]\)[\s\S]*?\}, \[\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/next\.delete\('from'\);/);
    expect(body).not.toMatch(/next\.delete\('category'\)/);
    expect(body).not.toMatch(/next\.delete\('openId'\)/);
    expect(body).toMatch(/setSearchParams\(next, \{ replace: true \}\);/);
  });
});

describe('Library.jsx — the contextual Back control itself', () => {
  // Item 8/9 - direct/bottom-nav access (no `from`, or an unrecognised
  // one) never shows any Back control; Library stays a genuine top-level
  // destination in that case.
  it('only renders when entryContext resolved to a genuine allowlisted context - a plain bottom-nav/direct visit (entryContext undefined) never shows it', () => {
    expect(librarySource).toMatch(/\{entryContext && \(/);
  });

  // Item 3/4/5 - contextual Back appears for the evening-summary entry,
  // with the correct accessible label, and its fallback is the fixed
  // /evening-complete route.
  it('renders BackButton with the resolved context\'s own fallback/label - for evening-summary specifically, this is fallback="/evening-complete" label="Back to Evening Summary" (accessible name is exactly this label - see BackButton.jsx\'s own aria-label={label})', () => {
    const block = librarySource.match(/\{entryContext && \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(block).toMatch(/<BackButton fallback=\{entryContext\.fallback\} label=\{entryContext\.label\} \/>/);
    expect(librarySource).toMatch(/'evening-summary': \{ fallback: '\/evening-complete', label: 'Back to Evening Summary' \}/);
  });

  it('for the home context specifically, fallback/label are unchanged from before ("/" / "Back to Home")', () => {
    expect(librarySource).toMatch(/home: \{ fallback: '\/', label: 'Back to Home' \}/);
  });

  it('BackButton itself already guarantees the 44x44px touch target and a real fallback when no in-app history exists (see BackButton.jsx\'s own w-11 h-11 + goBack(fallback) contract) - never re-implemented here as a bespoke button', () => {
    expect(librarySource).not.toMatch(/<button[\s\S]{0,80}aria-label="Back to/);
  });

  // Item 15 (320px) - the Back control sits in its own row, above the
  // Library heading, never absolutely positioned over it - so it can
  // never clip or overlap the heading/filters at any width; the row
  // itself uses plain flex layout with no fixed/absolute positioning.
  it('the Back row is a normal flow element (not absolute/fixed), sitting above the Library heading and filters - can never overlap them at any width', () => {
    const backRowIdx = librarySource.indexOf('{entryContext && (');
    const headingIdx = librarySource.indexOf('Library</h2>');
    expect(backRowIdx).toBeGreaterThan(-1);
    expect(headingIdx).toBeGreaterThan(backRowIdx);
    const backRowBlock = librarySource.match(/\{entryContext && \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(backRowBlock).not.toMatch(/absolute|fixed/);
  });
});

// Item 10 - opening/closing the media modal preserves both the entry
// context and the active category filter (neither is reset or consumed
// by video interaction).
describe('Library.jsx — media modal open/close never touches entryContext or the active category filter', () => {
  it('handleSelect/closeVideo (from useProtectedVideo) are never wired to setActiveCategory or any entryContext state', () => {
    // handleSelect( / closeVideo( with the opening paren - distinct from
    // handleSelectCategory, which legitimately calls setActiveCategory
    // right after its own declaration and must not false-positive here.
    expect(librarySource).not.toMatch(/handleSelect\([\s\S]{0,120}setActiveCategory/);
    expect(librarySource).not.toMatch(/closeVideo[\s\S]{0,120}setActiveCategory/);
    expect(librarySource).not.toMatch(/handleSelect\([\s\S]{0,120}entryContext/);
    expect(librarySource).not.toMatch(/closeVideo[\s\S]{0,120}entryContext/);
  });

  it('entryContext itself is only ever set once, on mount - nothing in the video-modal lifecycle can reset or clear it', () => {
    const setEntryContextCalls = librarySource.match(/setEntryContext/g) ?? [];
    expect(setEntryContextCalls.length).toBe(0);
  });
});

// Item 11 - Back never creates a browser-history loop: it delegates
// entirely to BackButton's own goBack(fallback) (NavigationHistoryContext),
// the same proven mechanism the pre-existing Home context already used
// safely.
describe('Library.jsx — no history trap: Back delegates entirely to the shared, already-proven goBack(fallback) mechanism', () => {
  it('Library.jsx itself performs no manual history manipulation (no window.history, no replaceState/pushState) - BackButton owns all of that', () => {
    expect(librarySource).not.toMatch(/window\.history|replaceState|pushState/);
  });
});

// Item 12/13 - the completed Evening state is unchanged and no
// session/response write occurs anywhere in this flow: Library.jsx
// never imports the Session Engine or any routine-response/completion
// writer, and BackButton's fallback-only navigation performs no writes
// of its own.
describe('Library.jsx — no Evening/session mutation anywhere in the contextual-Back flow', () => {
  it('never imports useSession, routineResponses.js, or dailyCompletion.js - this page cannot write a completion flag, a response row, or touch Session Engine state', () => {
    expect(librarySource).not.toMatch(/from '\.\.\/context\/SessionContext'/);
    expect(librarySource).not.toMatch(/from '\.\.\/lib\/routineResponses'/);
    expect(librarySource).not.toMatch(/from '\.\.\/lib\/dailyCompletion'/);
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
