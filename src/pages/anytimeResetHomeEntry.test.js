// Anytime Reset — Home entry point + routing regression guard (Build 15).
// Source-level checks (Home.jsx/App.jsx aren't rendered in this repo's
// Vitest - see Meditate.jsx's own sibling for the established pattern).
//
// Build 15 Home refinement — Anytime Reset moved off the quick-action row
// onto its own "Today's Rhythm" card (see Home.greeting.test.js's
// selector coverage and the activePeriod === 'anytime' detail-card
// assertions below), freeing the first quick-action tile for a
// standalone Breathe entry point instead (see standaloneBreathe.test.js).
// /anytime-reset itself is untouched either way.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const homeSource = read('./Home.jsx');
const appSource = read('../App.jsx');

describe('Home.jsx — Anytime Reset now lives in its own "Today\'s Rhythm" card', () => {
  it('the Today\'s Rhythm selector includes an Anytime card, and its own detail card routes to /anytime-reset, not /support', () => {
    expect(homeSource).toMatch(/onClick=\{\(\) => setSelectedPeriod\('anytime'\)\}/);
    const anytimeStart = homeSource.indexOf("{activePeriod === 'anytime' && (");
    const anytimeEnd = homeSource.indexOf('{/* 6. Active intentions', anytimeStart);
    const anytimeDetailCard = anytimeStart > -1 && anytimeEnd > -1 ? homeSource.slice(anytimeStart, anytimeEnd) : '';
    expect(anytimeDetailCard.length).toBeGreaterThan(0);
    expect(anytimeDetailCard).toMatch(/to="\/anytime-reset"/);
    expect(anytimeDetailCard).not.toMatch(/to="\/support"/);
  });

  it('the former "Need a moment?" label no longer appears anywhere in Home.jsx', () => {
    expect(homeSource).not.toMatch(/Need a moment\?/);
  });
});

describe('Home.jsx — quick-action row stays at exactly three tiles', () => {
  const quickActionBlock = homeSource.match(/Or choose something quick[\s\S]*?grid grid-cols-3 gap-2\.5">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] ?? '';

  it('the quick-action block was found and is non-empty', () => {
    expect(quickActionBlock.length).toBeGreaterThan(0);
  });

  it('contains exactly three <Link> tiles (navigation simplification follow-up: the former fourth tile, Explore Library, is removed - Library stays permanently reachable via the bottom nav instead)', () => {
    const links = quickActionBlock.match(/<Link\s/g) ?? [];
    expect(links).toHaveLength(3);
  });

  it('the three tiles are exactly: Breathe, Meditate, Sleep & Unwind (in that order) - Anytime Reset moved to its own Today\'s Rhythm card, see the describe block above; Explore Library removed, no replacement tile added', () => {
    const labels = [...quickActionBlock.matchAll(/text-\[11px\] font-semibold text-on-surface leading-tight">([^<]+)</g)].map((m) => m[1]);
    expect(labels).toEqual(['Breathe', 'Meditate', 'Sleep &amp; Unwind']);
  });

  it('the Breathe tile routes to the standalone /breathe-standalone destination, not /support or the old /anytime-reset slot', () => {
    // Context-aware Breathing/Meditation theming — the tile now carries
    // an extra explanatory comment + state={{ journeyTone: ... }} prop
    // before its label text, widening how far this needs to search.
    const tileMatch = quickActionBlock.match(/to="\/breathe-standalone"[\s\S]{0,1200}Breathe/);
    expect(tileMatch).toBeTruthy();
    expect(quickActionBlock).not.toMatch(/to="\/support"/);
    expect(quickActionBlock).not.toMatch(/to="\/anytime-reset"/);
  });

  it('the Breathe tile carries min-h-[44px], matching the other three', () => {
    const tileMatch = quickActionBlock.match(/to="\/breathe-standalone"[^>]*className="([^"]*)"/);
    expect(tileMatch).toBeTruthy();
    expect(tileMatch[1]).toMatch(/min-h-\[44px\]/);
  });
});

describe('App.jsx — routing', () => {
  it('a new /anytime-reset route exists, lazy-loaded like every other page route', () => {
    expect(appSource).toMatch(/const AnytimeReset = lazy\(\(\) => import\('\.\/pages\/AnytimeReset'\)\.then\(\(m\) => \(\{ default: m\.AnytimeReset \}\)\)\);/);
    expect(appSource).toMatch(/<Route path="anytime-reset" element=\{withFallback\(<AnytimeReset \/>\)\} \/>/);
  });

  it('/support and its sibling sub-routes (panic, grounding, stress-release, quiet-breathing, support-complete) are all still present, untouched', () => {
    expect(appSource).toMatch(/<Route path="support" element=\{withFallback\(<Support \/>\)\} \/>/);
    expect(appSource).toMatch(/<Route path="panic" element=\{withFallback\(<PanicMode \/>\)\} \/>/);
    expect(appSource).toMatch(/<Route path="grounding" element=\{withFallback\(<Grounding \/>\)\} \/>/);
    expect(appSource).toMatch(/<Route path="stress-release" element=\{withFallback\(<StressRelease \/>\)\} \/>/);
    expect(appSource).toMatch(/<Route path="quiet-breathing" element=\{withFallback\(<QuietBreathing \/>\)\} \/>/);
    expect(appSource).toMatch(/<Route path="support-complete" element=\{withFallback\(<SupportComplete \/>\)\} \/>/);
  });

  it('/meditate and /meditation-complete are still present, untouched', () => {
    expect(appSource).toMatch(/<Route path="meditate" element=\{withFallback\(<Meditate \/>\)\} \/>/);
    expect(appSource).toMatch(/<Route path="meditation-complete" element=\{withFallback\(<MeditationComplete \/>\)\} \/>/);
  });
});
