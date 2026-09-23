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

describe('Home.jsx — Morning/Evening tabs now meet the 44px minimum, selected state and switching logic unchanged', () => {
  it('both tabs carry min-h-[44px] plus a flex-centered layout so the box (not just its content) is guaranteed 44px', () => {
    const morningTab = homeSource.match(/onClick=\{\(\) => setSelectedPeriod\('morning'\)\}[\s\S]{0,300}/)?.[0] ?? '';
    const eveningTab = homeSource.match(/onClick=\{\(\) => setSelectedPeriod\('evening'\)\}[\s\S]{0,300}/)?.[0] ?? '';
    expect(morningTab).toMatch(/min-h-\[44px\] flex items-center justify-center/);
    expect(eveningTab).toMatch(/min-h-\[44px\] flex items-center justify-center/);
  });

  it('both tabs now carry a visible focus-visible ring, which they never had before this remediation', () => {
    const morningTab = homeSource.match(/onClick=\{\(\) => setSelectedPeriod\('morning'\)\}[\s\S]{0,500}/)?.[0] ?? '';
    const eveningTab = homeSource.match(/onClick=\{\(\) => setSelectedPeriod\('evening'\)\}[\s\S]{0,500}/)?.[0] ?? '';
    expect(morningTab).toMatch(/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/);
    expect(eveningTab).toMatch(/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('selected-state styling and switching logic (setSelectedPeriod, aria-selected) are byte-for-byte unchanged', () => {
    expect(homeSource).toMatch(/aria-selected=\{activePeriod === 'morning'\}/);
    expect(homeSource).toMatch(/aria-selected=\{activePeriod === 'evening'\}/);
    expect(homeSource).toMatch(/bg-primary text-on-primary border-primary shadow-sm/);
    expect(homeSource).toMatch(/bg-secondary text-on-secondary border-secondary shadow-sm/);
  });

  it('the compact py-2/text-[10px] visual footprint is preserved - only the invisible hit box grew', () => {
    expect(homeSource).toMatch(/text-\[10px\] font-bold uppercase tracking-wider py-2 rounded-full/);
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
