// Evening Visual Uplift (Phase 7) — EveningComplete.jsx spec section 8
// changes: reordered actions (Sleep Experience -> Return Home -> Review/
// Edit (smaller) -> Explore Evening -> Redo), and ExploreCard's longer
// supporting sentence removed. No DOM rendering available in this repo's
// Vitest - source-level checks, matching this codebase's own established
// precedent.
//
// Phase 9 — Truthful Journey Outcomes superseded Phase 7's own "100%
// Complete" badge, which unconditionally overclaimed full completion
// merely for reaching this terminal screen. It is removed entirely, in
// favour of a heading/supporting-line pair gated on whether every
// displayed Evening stage genuinely completed - see
// eveningCompleteOutcomeMessages.test.js for that behavior's own coverage.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./EveningComplete.jsx');

describe('EveningComplete - Phase 9: no percentage/graded-score wording anywhere', () => {
  it('never shows a "100% Complete" badge or any other percentage in real code/markup - removed in favour of a truthful, outcome-gated heading/supporting-line pair (doc comments referencing the historical Phase 7 feature name by way of explanation are not user-facing, so are not checked here)', () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/100%/);
    expect(code).not.toMatch(/\d+%/);
  });

  it('Anytime completion remains untouched either way - EveningComplete.jsx is Evening-only, and no percentage ever appeared in Anytime\'s own completion screen (SupportComplete.jsx)', () => {
    const supportCompleteSource = read('./SupportComplete.jsx');
    expect(supportCompleteSource).not.toMatch(/100%/);
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

  it('title/ctaLabel/route are all unchanged; itemCount is no longer passed at all', () => {
    expect(exploreBlock).toMatch(/title="Would more support help you unwind\?"/);
    expect(exploreBlock).toMatch(/ctaLabel="Explore Evening"/);
    expect(exploreBlock).toMatch(/to="\/library\?journey=evening&from=evening-summary"/);
    // Evening pathway parity (Phase 13) — mirrors SessionComplete.jsx's own
    // identical Morning correction: the catalogue count is removed
    // entirely (ExploreCard's own optional-itemCount guard already
    // renders nothing when the prop is omitted), never a number shown.
    expect(exploreBlock).not.toMatch(/itemCount/);
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
