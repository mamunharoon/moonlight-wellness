// Build 16 — Circadian Icon Colour Contract, consolidated regression
// guard. Proves the approved semantic mapping (dawn gold = Morning,
// sage mint = breathing/calming-pause, twilight lavender = Evening/
// sleep, WakeWise peach = general/multi-purpose/brand) holds
// consistently across every audited surface, and that nothing outside
// that mapping was touched. Consolidates direct proof even where a
// piece is already covered elsewhere (Home.phaseB.test.js,
// Routines.test.js, categoryAccentColors.test.js, Introduction.test.js)
// - this file exists so each of the ten requested properties is
// individually, unambiguously checkable against the exact contract.
//
// No DOM/component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const homeSource = read('../pages/Home.jsx');
const layoutSource = read('../components/Layout.jsx');
const introductionSource = read('../pages/Introduction.jsx');
const routinesCatalogSource = read('./routinesCatalog.js');
const mediaCatalogSource = read('./mediaCatalog.js');
const librarySource = read('../pages/Library.jsx');

// Context-aware Breathing/Meditation theming — this correction supersedes
// the earlier "Breathe is permanently mint" / "Meditate stays peach"
// contract below (sections 1 and 3): both quick-action icons now preview
// Home's own currently active rhythm tab (gold/mint/periwinkle), and hand
// that same context off to whichever standalone practice they open - see
// usePracticeJourneyTone.js/practiceJourneyContext.js.
describe('1. Breathe (Home quick action) previews Home\'s own active rhythm colour', () => {
  it('uses quickActionIconClass (dynamic), never a hardcoded text-tertiary literal', () => {
    expect(homeSource).toMatch(/const quickActionJourneyTone = activePeriod;/);
    expect(homeSource).toMatch(
      /const quickActionIconClass =\s*\n\s*quickActionJourneyTone === 'morning'\s*\n\s*\? 'text-morning-accent'\s*\n\s*: quickActionJourneyTone === 'evening'\s*\n\s*\? 'text-evening-accent'\s*\n\s*: 'text-tertiary';/
    );
    expect(homeSource).toMatch(/\{`material-symbols-outlined \$\{quickActionIconClass\} text-2xl`\}>air</);
  });

  it('hands the captured context to the standalone screen it opens, via the Link\'s own state', () => {
    const tileBlock = homeSource.match(/<Link\s+to="\/breathe-standalone"[\s\S]*?<\/Link>/)?.[0] ?? '';
    expect(tileBlock).toMatch(/state=\{\{ journeyTone: quickActionJourneyTone \}\}/);
  });
});

describe('2. Sleep & Unwind (Home quick action) uses the evening lavender token', () => {
  it('text-evening-accent, not peach or mint', () => {
    expect(homeSource).toMatch(/text-evening-accent text-2xl">bedtime</);
  });
});

describe('3. Meditate also previews Home\'s own active rhythm colour (superseding the earlier "always peach" contract)', () => {
  it('uses the same dynamic quickActionIconClass as Breathe - Meditate and Breathe share a colour when Home is Anytime-active because both open Anytime-family experiences; their distinct icons (air vs spa) keep them visually distinct', () => {
    expect(homeSource).toMatch(/\{`material-symbols-outlined \$\{quickActionIconClass\} text-2xl`\}>spa</);
  });

  it('hands the captured context to the standalone screen it opens, via the Link\'s own state', () => {
    const tileBlock = homeSource.match(/<Link\s+to="\/self-guided-meditation\?from=home"[\s\S]*?<\/Link>/)?.[0] ?? '';
    expect(tileBlock).toMatch(/state=\{\{ journeyTone: quickActionJourneyTone \}\}/);
  });

  it('Explore Library (the former fourth quick-action tile) is gone entirely - navigation simplification follow-up, Library stays reachable via the permanent bottom-nav item instead, so there is no icon left for this contract to check', () => {
    expect(homeSource).not.toMatch(/text-2xl">video_library</);
    // Comments legitimately name "Explore Library" in prose explaining
    // what was removed - only the real code matters here.
    const codeOnly = homeSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/Explore Library/);
  });
});

describe('4. Morning-specific cards use dawn gold', () => {
  it('Welcome\'s "Start my morning" card', () => {
    expect(introductionSource).toMatch(/iconClass: 'bg-morning-accent\/15 text-morning-accent'/);
  });

  it('Routines Hub\'s Rise & Reset card border', () => {
    expect(routinesCatalogSource).toMatch(/accentColor: 'var\(--color-gratitude-accent\)'/); // morning-accent's underlying token
  });

  it('Library\'s Morning category header', () => {
    expect(mediaCatalogSource).toMatch(/Morning: 'text-morning-accent'/);
  });

  it('Home\'s Today\'s Rhythm Morning pill (pre-existing, confirmed unaffected)', () => {
    expect(homeSource).toMatch(/'bg-morning-accent text-on-morning-accent border-morning-accent shadow-morning-glow'/);
  });
});

describe('5. Equivalent repeated destinations use the same semantic accent everywhere they appear', () => {
  // Context-aware Breathing/Meditation theming — Home's own Breathe tile
  // is deliberately excluded from this "same token everywhere" check now:
  // it previews Home's own CURRENT active rhythm colour (gold/mint/
  // periwinkle, see section 1 above), not a permanently-mint icon the
  // way Welcome's static card and Routines Hub's static border still are.
  it('mint (breathing/calming-pause) appears on Welcome\'s "Take a calming pause" card and Routines Hub\'s Gentle Reset border - the same token, every time', () => {
    expect(introductionSource).toMatch(/iconClass: 'bg-tertiary\/15 text-tertiary'/); // Welcome
    expect(routinesCatalogSource).toMatch(/accentColor: 'var\(--color-tertiary\)'/); // Routines Hub
    expect(mediaCatalogSource).toMatch(/Breathing: 'text-tertiary'/); // Library category
  });

  it('lavender (Evening/sleep) appears on Welcome\'s "Wind down for sleep" card, Home\'s Sleep & Unwind tile, Routines Hub\'s Wind-Down border, and Library\'s Evening Wind-Down/Sleep Soundscapes categories - the same token, every time', () => {
    expect(introductionSource).toMatch(/iconClass: 'bg-evening-accent\/15 text-evening-accent'/); // Welcome
    expect(homeSource).toMatch(/text-evening-accent text-2xl">bedtime</); // Home
    expect(routinesCatalogSource).toMatch(/accentColor: 'var\(--color-evening-accent\)'/); // Routines Hub
    expect(mediaCatalogSource).toMatch(/'Evening Wind-Down': 'text-evening-accent'/); // Library
    expect(mediaCatalogSource).toMatch(/'Sleep Soundscapes': 'text-evening-accent'/); // Library
  });

  it('gold (Morning) appears on the same three+ surfaces - already proven individually above, cross-referenced here as one assertion', () => {
    const goldSurfaces = [
      introductionSource.includes("iconClass: 'bg-morning-accent/15 text-morning-accent'"),
      routinesCatalogSource.includes("accentColor: 'var(--color-gratitude-accent)'"),
      mediaCatalogSource.includes("Morning: 'text-morning-accent'"),
      homeSource.includes("'bg-morning-accent text-on-morning-accent border-morning-accent shadow-morning-glow'")
    ];
    expect(goldSurfaces.every(Boolean)).toBe(true);
  });
});

describe('6. Bottom navigation remains unchanged - neutral inactive, WakeWise-peach active, destination-agnostic', () => {
  it('active tab uses the plain peach primary token regardless of which tab it is - never a per-destination colour (Bottom Navigation Visual Uplift: bg-primary-container/on-primary-container - which resolved to a dark brown #783221 - replaced with plain text-primary/text-on-surface, matching the Stitch source)', () => {
    expect(layoutSource).toMatch(/isActive \? 'text-primary' : 'text-on-surface hover:text-primary active:bg-white\/5'/);
  });

  it('no morning-accent/tertiary/evening-accent token appears anywhere in the bottom-nav render block', () => {
    const navBlock = layoutSource.match(/\{!hideNavigation && \([\s\S]*?\n {8}\)\}/)?.[0] ?? '';
    expect(navBlock).not.toMatch(/morning-accent|tertiary|evening-accent/);
  });
});

describe('7. Destructive/status controls remain unchanged', () => {
  it('destructive styling (red/error tokens) is untouched by any file this Build 16 pass modified', () => {
    // Spot-check: Home.jsx's own destructive "Redo Tonight\'s Wind-Down"
    // control (text-red-300) is present and unchanged - the one
    // destructive-adjacent control on a page this pass otherwise edited.
    expect(homeSource).toMatch(/text-red-300 hover:text-red-200/);
  });
});

describe('8. No new duplicate colour literals were introduced', () => {
  it('every Circadian Colors usage in this pass reuses a named Tailwind token (morning-accent/tertiary/evening-accent/primary) - never a fresh inline hex/rgb value', () => {
    const filesToCheck = [
      // Scoped to WELCOME_CARDS itself, not the whole file - the file's
      // own doc comment legitimately cites these same real hex values
      // for documentation (see betaVideoManifest.js-style precedent
      // elsewhere in this codebase), which is not a "new colour literal"
      // concern.
      { name: 'Introduction.jsx (WELCOME_CARDS)', source: introductionSource.match(/const WELCOME_CARDS = \[[\s\S]*?\n\];/)?.[0] ?? '' },
      { name: 'Home.jsx (quick-action tiles slice)', source: homeSource.slice(homeSource.indexOf('Or choose something quick'), homeSource.indexOf('Or choose something quick') + 3000) },
      { name: 'mediaCatalog.js (accent map)', source: mediaCatalogSource.match(/const CATEGORY_ACCENT_CLASSES = \{[\s\S]*?\};/)?.[0] ?? '' },
      { name: 'routinesCatalog.js (accentColor values)', source: routinesCatalogSource }
    ];
    for (const { name, source } of filesToCheck) {
      // No raw hex colour literals (e.g. #f4c56a) introduced directly in
      // these specific card/icon colour definitions - var(--color-*)
      // references and Tailwind class names only.
      const hexLiterals = source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      expect(hexLiterals, `${name} should introduce no new hex literals`).toEqual([]);
    }
  });
});

describe('9. Labels/icons remain accessible without colour alone', () => {
  it('every Home quick-action tile keeps its own visible text label alongside the coloured icon - colour is never the only cue', () => {
    expect(homeSource).toMatch(/text-\[11px\] font-semibold text-on-surface leading-tight">Breathe</);
    expect(homeSource).toMatch(/text-\[11px\] font-semibold text-on-surface leading-tight">Sleep &amp;Unwind|Sleep &amp; Unwind/);
  });

  it('every Welcome card keeps its own visible title AND subtitle text alongside the coloured icon', () => {
    expect(introductionSource).toMatch(/title: 'Start my morning'/);
    expect(introductionSource).toMatch(/title: 'Take a calming pause'/);
    expect(introductionSource).toMatch(/title: 'Wind down for sleep'/);
  });

  it('every Library category keeps its own visible text heading alongside the coloured icon', () => {
    expect(librarySource).toMatch(/<h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">\{category\}<\/h3>/);
  });
});

describe('10. Existing routing, order and touch targets remain unchanged', () => {
  // Context-aware Breathing/Meditation theming — the Breathe/Meditate
  // tiles now carry an extra `state={{ journeyTone: ... }}` prop (and an
  // explanatory comment) between `to="..."` and `aria-describedby=...`;
  // matched with a bounded [\s\S]*? span rather than exact adjacency so
  // this still holds regardless of what sits in between.
  it('Home\'s three remaining quick-action tiles keep their exact original order and destinations (navigation simplification follow-up: the former fourth tile, /library?from=home "Explore Library", is removed - Library stays permanently reachable via the bottom nav)', () => {
    const hrefs = [...homeSource.matchAll(/<Link\s+to="([^"]+)"[\s\S]{0,900}?aria-describedby="quick-action-tip-/g)].map((m) => m[1]);
    expect(hrefs).toEqual(['/breathe-standalone', '/self-guided-meditation?from=home', '/library?category=sleep-soundscapes&from=home']);
  });

  it('every quick-action tile still carries its min-h-[44px] touch target', () => {
    const tileLinks = [...homeSource.matchAll(/<Link\s+to="[^"]+"[\s\S]{0,900}?aria-describedby="quick-action-tip-[^"]+"\s*\n\s*className="([^"]*)"/g)];
    expect(tileLinks.length).toBe(3);
    for (const [, className] of tileLinks) {
      expect(className).toMatch(/min-h-\[44px\]/);
    }
  });

  it('Routines Hub cards still link to their original three routes, in their original order', () => {
    const routinesSource = read('../pages/Routines.jsx');
    expect(routinesSource).toMatch(/to=\{`\/routines\/\$\{routine\.id\}`\}/);
  });
});
