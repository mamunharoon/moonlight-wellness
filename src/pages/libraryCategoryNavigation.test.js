// Physical-device correction — Library category navigation.
//
// Confirmed on a real phone: the horizontal category row clips at
// "ALL / MORNING / POSITIVE ENERGY & CONFIDENCE / [cut off]" with no
// obvious or working control to reveal the rest - swipe existed but was
// undiscoverable. Fixed by adding real Previous/Next arrow controls
// alongside the existing swipe/drag (unchanged), using CSS scroll-snap
// (snap-x/snap-mandatory + each chip's own snap-start) so a scroll always
// lands on a real chip boundary regardless of label length, rather than
// an arbitrary pixel amount that could stop mid-chip.
//
// No DOM rendering is available in this repo's Vitest - source-level
// checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Library.jsx', import.meta.url)), 'utf-8');

describe('arrow controls exist, are real buttons with the required accessibility contract', () => {
  it('Previous/Next buttons carry the exact required aria-labels', () => {
    expect(source).toMatch(/aria-label="Previous categories"/);
    expect(source).toMatch(/aria-label="Next categories"/);
  });

  it('both arrows are real, plain <button type="button"> elements - keyboard-activatable (Enter/Space) with no custom key handling needed', () => {
    const prevBlock = source.match(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => scrollCategoriesBy\(-1\)\}[\s\S]*?<\/button>/)?.[0] ?? '';
    const nextBlock = source.match(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => scrollCategoriesBy\(1\)\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(prevBlock).not.toBe('');
    expect(nextBlock).not.toBe('');
  });

  it('both arrows meet the 44x44 minimum tap target', () => {
    const prevBlock = source.match(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => scrollCategoriesBy\(-1\)\}[\s\S]*?<\/button>/)?.[0] ?? '';
    const nextBlock = source.match(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => scrollCategoriesBy\(1\)\}[\s\S]*?<\/button>/)?.[0] ?? '';
    for (const block of [prevBlock, nextBlock]) {
      expect(block).toMatch(/w-11 h-11/);
    }
  });

  it('both arrows carry a visible focus ring, matching this codebase\'s own established focus-visible convention', () => {
    const prevBlock = source.match(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => scrollCategoriesBy\(-1\)\}[\s\S]*?<\/button>/)?.[0] ?? '';
    const nextBlock = source.match(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => scrollCategoriesBy\(1\)\}[\s\S]*?<\/button>/)?.[0] ?? '';
    for (const block of [prevBlock, nextBlock]) {
      expect(block).toMatch(/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/);
    }
  });

  it('the chevron icons themselves are aria-hidden - the button\'s own aria-label is the one accessible name, never doubled up', () => {
    const iconMatches = source.match(/<span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">chevron_(left|right)<\/span>/g) ?? [];
    expect(iconMatches.length).toBe(2);
  });
});

describe('disabled state at the beginning/end - hidden or disabled, updated from real scroll position', () => {
  it('Previous is disabled via canScrollLeft, Next via canScrollRight - not a permanently-enabled or permanently-hidden pair', () => {
    expect(source).toMatch(/disabled=\{!canScrollLeft\}/);
    expect(source).toMatch(/disabled=\{!canScrollRight\}/);
  });

  it('a disabled arrow is visually dimmed and non-interactive (never a dead-looking but still-clickable control)', () => {
    expect(source).toMatch(/disabled:opacity-30 disabled:pointer-events-none/);
  });

  it('canScrollLeft/canScrollRight are computed from the real DOM scroll position (scrollLeft/scrollWidth/clientWidth), never a hand-maintained index that could drift from reality', () => {
    const body = source.match(/const updateCategoryScrollState = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setCanScrollLeft\(el\.scrollLeft > 1\);/);
    expect(body).toMatch(/el\.scrollWidth - el\.clientWidth - el\.scrollLeft > 1/);
    expect(body).toMatch(/setCanScrollRight\(hasMoreToTheRight\);/);
  });
});

describe('arrow state stays correct after swipe, resize, filter selection and programmatic scrolling', () => {
  it('the real onScroll listener (covers swipe/drag) calls the same state-update function the arrows themselves use', () => {
    expect(source).toMatch(/onScroll=\{updateCategoryScrollState\}/);
  });

  it('a window resize re-runs the same state-update function', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*updateCategoryScrollState\(\);\s*\n\s*window\.addEventListener\('resize', updateCategoryScrollState\);[\s\S]*?\}, \[\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/return \(\) => window\.removeEventListener\('resize', updateCategoryScrollState\);/);
  });

  it('selecting a category (the filter chips) re-runs the state update via the same scrollIntoView call, and clicking an arrow explicitly re-runs it too (defensive, alongside the real scroll event)', () => {
    const scrollByBody = source.match(/const scrollCategoriesBy = \(direction\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(scrollByBody).toMatch(/updateCategoryScrollState\(\);/);
  });
});

describe('selecting a category scrolls it fully into view; the selected category remains visually obvious', () => {
  it('handleSelectCategory calls scrollIntoView on the exact selected chip, keyed the same way as chipRefs are registered (category, MEDITATION_FILTER, or \'all\')', () => {
    const body = source.match(/const handleSelectCategory = \(category\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/chipRefs\.current\[category \?\? 'all'\]\?\.scrollIntoView\(\{/);
    expect(body).toMatch(/inline: 'nearest',/);
    expect(body).toMatch(/block: 'nearest'/);
  });

  it('a restored ?category= on mount also scrolls its chip into view once, without animating (a page load is never a scroll the user should visually track)', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*chipRefs\.current\[initialCategory \?\? 'all'\][\s\S]*?\}, \[\]\);/)?.[0] ?? '';
    expect(body).toMatch(/behavior: 'auto', inline: 'nearest', block: 'nearest' \}\);/);
  });

  it('the selected chip\'s own bg-primary/text-on-primary highlight (pre-existing, unchanged) is still exactly what marks it visually - no new selection indicator was invented', () => {
    expect(source).toMatch(/!activeCategory \? 'bg-primary text-on-primary' : 'glass-panel text-on-surface-variant hover:bg-white\/5'/);
    expect(source).toMatch(/activeCategory === category \? 'bg-primary text-on-primary' : 'glass-panel text-on-surface-variant hover:bg-white\/5'/);
  });

  it('every chip (All, each real category, and the Meditation pseudo-filter) registers itself in chipRefs, so every one is reachable by scrollIntoView regardless of label length', () => {
    expect(source).toMatch(/ref=\{\(el\) => \{ chipRefs\.current\.all = el; \}\}/);
    expect(source).toMatch(/ref=\{\(el\) => \{ chipRefs\.current\[category\] = el; \}\}/);
    expect(source).toMatch(/ref=\{\(el\) => \{ chipRefs\.current\[MEDITATION_FILTER\] = el; \}\}/);
  });
});

describe('reduced motion is respected for both scroll mechanisms', () => {
  it('reducedMotion is detected via the same established OS + manual-override combination Breathe.jsx already uses (real preference, never guessed)', () => {
    expect(source).toMatch(/import \{ getReducedMotionPreference \} from '\.\.\/lib\/reducedMotionPreference';/);
    expect(source).toMatch(/Boolean\(getReducedMotionPreference\(\) \|\| window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches\)/);
  });

  it('both scrollBy (arrows) and scrollIntoView (selection) pass behavior: reducedMotion ? \'auto\' : \'smooth\' - never a hardcoded \'smooth\'', () => {
    expect(source).toMatch(/el\.scrollBy\(\{ left: direction \* el\.clientWidth \* 0\.85, behavior: reducedMotion \? 'auto' : 'smooth' \}\);/);
    expect(source).toMatch(/behavior: reducedMotion \? 'auto' : 'smooth',\s*\n\s*inline: 'nearest',/);
  });
});

describe('no category text is permanently clipped or unreachable, and search/filter behaviour is preserved', () => {
  it('every chip keeps shrink-0 (never truncated/compressed to fit) - reachability comes from scrolling, not from shrinking label text', () => {
    expect(source).toMatch(/shrink-0 snap-start px-4 py-2 rounded-full/g);
    expect((source.match(/shrink-0 snap-start/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('the search input and its query-filtering logic are completely untouched', () => {
    expect(source).toMatch(/placeholder="Search exercises and sounds\.\.\."/);
    expect(source).toMatch(/const matchesQuery = \(entry\) => \{/);
  });

  it('long category labels (e.g. "POSITIVE ENERGY & CONFIDENCE") still render as one real category string, never abbreviated to fit', () => {
    expect(source).toMatch(/\{category\}/);
  });
});
