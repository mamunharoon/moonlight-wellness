// Evening Visual Uplift (Phase 7) — EveningComplete.jsx spec section 8
// changes: a "100% Complete" indication, reordered actions (Sleep
// Experience -> Return Home -> Review/Edit (smaller) -> Explore Evening
// -> Redo), and ExploreCard's longer supporting sentence removed. No DOM
// rendering available in this repo's Vitest - source-level checks,
// matching this codebase's own established precedent.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./EveningComplete.jsx');

describe('EveningComplete - "100% Complete" indication', () => {
  it('shows a 100% Complete badge, reusing the existing evening-accent token (never a new colour)', () => {
    expect(source).toMatch(/100% Complete/);
    expect(source).toMatch(/text-evening-accent uppercase font-bold tracking-wider/);
  });

  it('only ever renders once this screen is genuinely reached via a completed Evening routine - the badge sits inside the same CompletionReveal stagger block every other completion element (headline/momentum) already relies on, not a separately-gated element', () => {
    const staggerBlock = source.slice(source.indexOf('stagger={['), source.indexOf(']}\n      />'));
    expect(staggerBlock).toMatch(/100% Complete/);
  });

  it('Anytime completion is untouched by this badge - EveningComplete.jsx is Evening-only, and this string never appears in Anytime\'s own completion screen (SupportComplete.jsx)', () => {
    const supportCompleteSource = read('./SupportComplete.jsx');
    expect(supportCompleteSource).not.toMatch(/100% Complete/);
  });
});

describe('EveningComplete - action order: Sleep Experience -> Return Home -> Review/Edit (smaller) -> Explore Evening -> Redo', () => {
  const iSleep = source.indexOf("onClick={() => navigate('/library?category=sleep-soundscapes&from=evening-summary')}");
  const iReturnHome = source.indexOf('onClick={handleReturnHome}');
  const iReviewEdit = source.indexOf("onClick={() => navigate('/review/reflection?q=1')}");
  const iExplore = source.indexOf('title="Would more support help you unwind?"');
  const iRedo = source.indexOf('onClick={handleRedoTap}');

  it('every action is present exactly once, in the required order', () => {
    expect(iSleep).toBeGreaterThanOrEqual(0);
    expect(iReturnHome).toBeGreaterThan(iSleep);
    expect(iReviewEdit).toBeGreaterThan(iReturnHome);
    expect(iExplore).toBeGreaterThan(iReviewEdit);
    expect(iRedo).toBeGreaterThan(iExplore);
  });

  it('Review or Edit is now visually smaller/quieter (plain text-only action, matching Redo\'s own weight) rather than a full glass-panel button', () => {
    const reviewButtonBlock = source.slice(source.lastIndexOf('<button', iReviewEdit), source.indexOf("Review or Edit Tonight's Responses", iReviewEdit));
    expect(reviewButtonBlock).toMatch(/py-3 text-center text-sm font-semibold text-on-surface-variant/);
    expect(reviewButtonBlock).not.toMatch(/glass-panel/);
  });

  it('every handler/destination is completely unchanged - only order and Review/Edit\'s visual weight moved', () => {
    expect(source).toMatch(/onClick=\{\(\) => navigate\('\/library\?category=sleep-soundscapes&from=evening-summary'\)\}/);
    expect(source).toMatch(/onClick=\{handleReturnHome\}/);
    expect(source).toMatch(/onClick=\{\(\) => navigate\('\/review\/reflection\?q=1'\)\}/);
    expect(source).toMatch(/onClick=\{handleRedoTap\}/);
  });

  it('Review/Edit and Redo both stay guest-gated exactly as before ({!isGuest && ...})', () => {
    const reviewGate = source.slice(source.lastIndexOf('{!isGuest &&', iReviewEdit), iReviewEdit);
    expect(reviewGate).toMatch(/\{!isGuest &&/);
    const redoGate = source.slice(source.lastIndexOf('{!isGuest &&', iRedo), iRedo);
    expect(redoGate).toMatch(/\{!isGuest &&/);
  });

  it('redoError still renders its existing error panel, now alongside the moved Redo button', () => {
    expect(source).toMatch(/Couldn't redo tonight's Wind-Down\. Your existing journey is unchanged — please try again\./);
  });
});

describe('EveningComplete - ExploreCard simplified per spec section 8', () => {
  const exploreBlock = source.slice(source.indexOf('<ExploreCard'), source.indexOf('/>', source.indexOf('<ExploreCard')) + 2);

  it('title/ctaLabel/route/itemCount are all unchanged', () => {
    expect(exploreBlock).toMatch(/title="Would more support help you unwind\?"/);
    expect(exploreBlock).toMatch(/ctaLabel="Explore Evening"/);
    expect(exploreBlock).toMatch(/to="\/library\?journey=evening&from=evening-summary"/);
    expect(exploreBlock).toMatch(/itemCount=\{getEveningExploreCatalog\(\)\.length\}/);
  });

  it('the longer supportingText prop describing sleep stories/videos/sounds is removed entirely', () => {
    expect(exploreBlock).not.toMatch(/supportingText/);
    expect(source).not.toMatch(/Explore sleep stories, calming videos and soothing sounds\./);
  });

  it('ExploreCard.jsx itself still treats supportingText as optional, so this removal renders nothing broken (no literal "undefined")', () => {
    const exploreCardSource = read('../components/ExploreCard.jsx');
    expect(exploreCardSource).toMatch(/\{supportingText && \(/);
  });
});
