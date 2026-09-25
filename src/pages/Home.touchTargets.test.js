// Build 15 Phase B remediation (Task 2) — the three measured sub-44px
// touch targets on Home.jsx (Morning tab ~33px, Evening tab ~33px,
// Change intention ~16.5px - see Phase B's own final report) plus the
// migration-notice dismiss button found during this pass's own audit.
// Source-level checks - this repo's Vitest has no rendering engine; real
// getBoundingClientRect() measurements were taken separately against a
// live render (see this pass's own final report) since this repo's test
// setup cannot render components.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const homeSource = readFileSync(fileURLToPath(new URL('./Home.jsx', import.meta.url)), 'utf-8');
const cardSource = readFileSync(fileURLToPath(new URL('../components/ActiveIntentionCard.jsx', import.meta.url)), 'utf-8');
const recommendationCardSource = readFileSync(
  fileURLToPath(new URL('../components/journey/RecommendationCard.jsx', import.meta.url)),
  'utf-8'
);

describe('Home.jsx — Build 15 "Today\'s Rhythm" cards meet the 44px minimum, selected state and switching logic intact', () => {
  it('all three cards carry min-h-[52px] plus a flex-centered layout so the box (not just its content) still comfortably clears the 44px floor (Home Visual Uplift compact treatment - reduced from 64px, still 8px above the minimum)', () => {
    const morningTab = homeSource.match(/onClick=\{\(\) => setSelectedPeriod\('morning'\)\}[\s\S]{0,300}/)?.[0] ?? '';
    const anytimeTab = homeSource.match(/onClick=\{\(\) => setSelectedPeriod\('anytime'\)\}[\s\S]{0,300}/)?.[0] ?? '';
    const eveningTab = homeSource.match(/onClick=\{\(\) => setSelectedPeriod\('evening'\)\}[\s\S]{0,300}/)?.[0] ?? '';
    expect(morningTab).toMatch(/min-h-\[52px\] flex flex-col items-center justify-center/);
    expect(anytimeTab).toMatch(/min-h-\[52px\] flex flex-col items-center justify-center/);
    expect(eveningTab).toMatch(/min-h-\[52px\] flex flex-col items-center justify-center/);
  });

  it('all three cards carry a visible focus-visible ring', () => {
    const morningTab = homeSource.match(/onClick=\{\(\) => setSelectedPeriod\('morning'\)\}[\s\S]{0,500}/)?.[0] ?? '';
    const anytimeTab = homeSource.match(/onClick=\{\(\) => setSelectedPeriod\('anytime'\)\}[\s\S]{0,500}/)?.[0] ?? '';
    const eveningTab = homeSource.match(/onClick=\{\(\) => setSelectedPeriod\('evening'\)\}[\s\S]{0,500}/)?.[0] ?? '';
    expect(morningTab).toMatch(/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morning-accent/);
    // Anytime Reset Visual Uplift (Phase 2, approved decision A) - the
    // Anytime tab's focus ring is now mint (tertiary), matching its own
    // selected-state colour, exactly like Morning/Evening's own rings.
    expect(anytimeTab).toMatch(/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary/);
    expect(eveningTab).toMatch(/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-evening-accent/);
  });

  it('selected-state styling and switching logic (setSelectedPeriod, aria-selected) are intact for all three cards', () => {
    expect(homeSource).toMatch(/aria-selected=\{activePeriod === 'morning'\}/);
    expect(homeSource).toMatch(/aria-selected=\{activePeriod === 'anytime'\}/);
    expect(homeSource).toMatch(/aria-selected=\{activePeriod === 'evening'\}/);
    // Home Visual Uplift — each active tab now carries its own already-
    // existing named circadian glow (shadow-morning-glow/shadow-mint-glow/
    // shadow-evening-glow) in place of the old generic shadow-sm.
    expect(homeSource).toMatch(/bg-morning-accent text-on-morning-accent border-morning-accent shadow-morning-glow/);
    // Anytime Reset Visual Uplift (Phase 2) - mint now, not the generic peach.
    expect(homeSource).toMatch(/bg-tertiary text-on-tertiary border-tertiary shadow-mint-glow/);
    expect(homeSource).toMatch(/bg-evening-accent text-on-evening-accent border-evening-accent shadow-evening-glow/);
  });

  it('the compact text-[10px] label footprint is preserved on all three cards', () => {
    const labelMatches = homeSource.match(/text-\[10px\] font-bold uppercase tracking-wider/g) ?? [];
    expect(labelMatches.length).toBeGreaterThanOrEqual(3);
  });
});

describe('ActiveIntentionCard.jsx — "Change intention" now has a 44x44 effective hit area, compact label preserved', () => {
  it('the button carries min-h-[44px] and min-w-[44px]', () => {
    const body = cardSource.match(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{handleChangeTap\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(body).toMatch(/min-h-\[44px\] min-w-\[44px\]/);
  });

  it('the label text stays the same small size/weight as before - the fix is the hit area, not the visible size', () => {
    expect(cardSource).toMatch(/text-\[11px\] font-bold text-primary/);
  });
});

describe('Home.jsx — migration-notice "Got it" dismiss button, found during this pass\'s own audit', () => {
  it('now carries min-h-[44px] and a focus-visible ring, which it never had before', () => {
    const body = homeSource.match(/onClick=\{\(\) => setShowMorningFlowMigrationNotice\(false\)\}[\s\S]{0,400}/)?.[0] ?? '';
    expect(body).toMatch(/min-h-\[44px\]/);
    expect(body).toMatch(/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/);
  });
});

describe('Audit of the remaining shared journey components (used by both Anytime Reset and Meditate) - RecommendationCard\'s two buttons defensively confirmed at 44px', () => {
  it('the Start button carries an explicit min-h-[44px] alongside its existing generous py-4 padding', () => {
    const body = recommendationCardSource.match(/onClick=\{onStart\}[\s\S]{0,100}/)?.[0] ?? '';
    expect(body).toMatch(/min-h-\[44px\]/);
  });

  it('the "Choose another"/"Choose Another" button carries an explicit min-h-[44px] alongside its existing py-3 padding', () => {
    const body = recommendationCardSource.match(/onClick=\{onChooseAnother\}[\s\S]{0,100}/)?.[0] ?? '';
    expect(body).toMatch(/min-h-\[44px\]/);
  });
});
