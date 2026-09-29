// "Explore More" discovery, Phase 5 — source-level regression guard for
// ExploreCard's wiring into the three journey completion/recommendation
// screens. No DOM rendering available in this repo's Vitest.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('SessionComplete.jsx (Morning) — ExploreCard placement and content', () => {
  const source = read('./SessionComplete.jsx');

  // Morning copy simplification — "EXPLORE MORNING · 20" is now plain
  // "EXPLORE MORNING": SessionComplete.jsx no longer imports
  // getMorningExploreCatalog or passes itemCount at all (ExploreCard's own
  // `typeof itemCount === 'number' && itemCount > 0` guard already renders
  // nothing when the prop is omitted - no change to the shared
  // ExploreCard.jsx component itself). Evening/Anytime's own ExploreCard
  // usages below are completely unaffected and keep their own itemCount.
  it('imports ExploreCard, but no longer imports getMorningExploreCatalog (no catalogue count is shown)', () => {
    expect(source).toMatch(/import \{ ExploreCard \} from '\.\.\/components\/ExploreCard';/);
    expect(source).not.toMatch(/getMorningExploreCatalog/);
  });

  it('is placed AFTER the primary "Continue to My Day" action - never before it, never competing for primary styling', () => {
    const ctaIdx = source.indexOf('Continue to My Day');
    const exploreIdx = source.indexOf('<ExploreCard');
    expect(ctaIdx).toBeGreaterThan(-1);
    expect(exploreIdx).toBeGreaterThan(ctaIdx);
  });

  it('journey="morning", with the approved copy/CTA and no itemCount at all - "EXPLORE MORNING", never "EXPLORE MORNING · N"', () => {
    const block = source.match(/<ExploreCard\s*\n[\s\S]*?\n\s*\/>/)?.[0] ?? '';
    expect(block).not.toBe('');
    expect(block).toMatch(/journey="morning"/);
    expect(block).toMatch(/title="Have a little more time\?"/);
    expect(block).toMatch(/ctaLabel="Explore Morning"/);
    expect(block).not.toMatch(/itemCount/);
  });

  it('Physical-iPhone correction — the supporting sentence is removed (ExploreCard\'s supportingText is now optional; omitting it tightens the card automatically)', () => {
    const block = source.match(/<ExploreCard\s*\n[\s\S]*?\n\s*\/>/)?.[0] ?? '';
    expect(block).not.toMatch(/supportingText/);
    expect(source).not.toMatch(/Explore stretching, breathing and meditation for your morning\./);
  });

  it('links to /library with journey=morning and the allowlisted from=morning-complete origin - never a free-form return URL', () => {
    expect(source).toMatch(/to="\/library\?journey=morning&from=morning-complete"/);
  });
});

describe('EveningComplete.jsx — ExploreCard placement and content', () => {
  const source = read('./EveningComplete.jsx');

  // Evening pathway parity (Phase 13) — mirrors Morning's own identical
  // correction above: "EXPLORE EVENING · N" is now plain "EXPLORE
  // EVENING": EveningComplete.jsx no longer imports getEveningExploreCatalog
  // or passes itemCount at all (ExploreCard's own `typeof itemCount ===
  // 'number' && itemCount > 0` guard already renders nothing when the prop
  // is omitted - no change to the shared ExploreCard.jsx component
  // itself). Anytime's own ExploreCard usage below is unaffected and
  // keeps its own itemCount.
  it('imports ExploreCard, but no longer imports getEveningExploreCatalog (no catalogue count is shown)', () => {
    expect(source).toMatch(/import \{ ExploreCard \} from '\.\.\/components\/ExploreCard';/);
    expect(source).not.toMatch(/getEveningExploreCatalog/);
  });

  it('is placed AFTER the primary "Return Home" completion action', () => {
    const returnHomeIdx = source.indexOf('Return Home');
    const exploreIdx = source.indexOf('<ExploreCard');
    expect(returnHomeIdx).toBeGreaterThan(-1);
    expect(exploreIdx).toBeGreaterThan(returnHomeIdx);
  });

  it('journey="evening", with the approved copy/CTA and no itemCount at all - "EXPLORE EVENING", never "EXPLORE EVENING · N"', () => {
    const block = source.match(/<ExploreCard\s*\n[\s\S]*?\n\s*\/>/)?.[0] ?? '';
    expect(block).not.toBe('');
    expect(block).toMatch(/journey="evening"/);
    expect(block).toMatch(/title="Would more support help you unwind\?"/);
    // Evening Visual Uplift (Phase 7) — the longer supporting sentence is
    // removed (ExploreCard's own supportingText prop is optional - see
    // morningVisualUpliftPhase6.test.js's own updated coverage of the
    // same removal on Morning's ExploreCard); title/CTA/route are all
    // otherwise unchanged. Evening pathway parity (Phase 13) — itemCount
    // is now also removed, mirroring Morning's own identical correction.
    expect(block).not.toMatch(/supportingText/);
    expect(block).toMatch(/ctaLabel="Explore Evening"/);
    expect(block).not.toMatch(/itemCount/);
  });

  it('reuses the existing evening-summary FROM_CONTEXTS key (never a near-duplicate new key) - same destination as "Choose a Sleep Experience" already above it', () => {
    expect(source).toMatch(/to="\/library\?journey=evening&from=evening-summary"/);
  });

  it('coexists with, but is distinct from, "Choose a Sleep Experience" - that action still links straight to the Sleep Soundscapes category only, unaffected by this addition', () => {
    expect(source).toMatch(/navigate\('\/library\?category=sleep-soundscapes&from=evening-summary'\)/);
  });
});

describe('AnytimeReset.jsx — ExploreCard placement, content, and active-session exclusion', () => {
  const source = read('./AnytimeReset.jsx');

  it('imports ExploreCard and getAnytimeExploreCatalog', () => {
    expect(source).toMatch(/import \{ ExploreCard \} from '\.\.\/components\/ExploreCard';/);
    expect(source).toMatch(/import \{ getAnytimeExploreCatalog \} from '\.\.\/lib\/exploreFiltering';/);
  });

  it('is rendered only inside the recommend step, gated on !isComplete && !openVideo - never shown while a video is open, playing, or showing its own completion overlay', () => {
    const recommendBlockStart = source.indexOf("step === 'recommend' && (");
    const recommendBlockEnd = source.indexOf('{openVideo && (', recommendBlockStart);
    expect(recommendBlockStart).toBeGreaterThan(-1);
    const recommendBlock = source.slice(recommendBlockStart, recommendBlockEnd);
    expect(recommendBlock).toMatch(/\{!isComplete && !openVideo && \(\s*\n\s*<ExploreCard/);
  });

  it('journey="anytime", with the approved copy/CTA and a real itemCount from getAnytimeExploreCatalog()', () => {
    const block = source.match(/<ExploreCard\s*\n[\s\S]*?\n\s*\/>/)?.[0] ?? '';
    expect(block).not.toBe('');
    expect(block).toMatch(/journey="anytime"/);
    expect(block).toMatch(/title="Want another way to reset\?"/);
    expect(block).toMatch(/supportingText="Explore quick practices for the time and need you have\."/);
    expect(block).toMatch(/ctaLabel="Explore Anytime"/);
    expect(block).toMatch(/itemCount=\{getAnytimeExploreCatalog\(\)\.length\}/);
  });

  it('the destination carries the exact current needId/durationId (not a guess) via the allowlisted from=anytime-recommend origin, so Back can restore the precise Anytime origin', () => {
    expect(source).toMatch(/to=\{`\/library\?journey=anytime&from=anytime-recommend&need=\$\{encodeURIComponent\(needId\)\}&duration=\$\{encodeURIComponent\(durationId\)\}`\}/);
  });

  it('never rendered on any other step (need/duration selection) - only the recommend step even reaches this code path', () => {
    const recommendStepIdx = source.indexOf("step === 'recommend'");
    const exploreCardIdx = source.indexOf('<ExploreCard');
    expect(exploreCardIdx).toBeGreaterThan(recommendStepIdx);
    // (need/duration selection happens on earlier, structurally separate
    // steps entirely - this just confirms ExploreCard sits within/after
    // the recommend step's own block, never earlier in the file.)
    expect(recommendStepIdx).toBeGreaterThan(-1);
  });
});

describe('Active-session exclusion — Explore is never wired into any active exercise/timer/media/input screen', () => {
  it('Breathe.jsx/MorningFlow.jsx/EveningBreathing.jsx/QuietBreathing.jsx (active breathing/stretching) never import ExploreCard - only their completion screens do', () => {
    for (const file of ['./Breathe.jsx', './MorningFlow.jsx', './EveningBreathing.jsx', './QuietBreathing.jsx']) {
      expect(read(file)).not.toMatch(/ExploreCard/);
    }
  });

  it('MorningMeditate.jsx/EveningMeditate.jsx/Meditate.jsx/SelfGuidedMeditation.jsx (meditation setup/active/timer) never import ExploreCard', () => {
    for (const file of ['./MorningMeditate.jsx', './EveningMeditate.jsx', './Meditate.jsx', './SelfGuidedMeditation.jsx']) {
      expect(read(file)).not.toMatch(/ExploreCard/);
    }
  });

  it('Reflection.jsx/Gratitude.jsx (active input) and Grounding.jsx/PanicMode.jsx (active support/panic) never import ExploreCard', () => {
    for (const file of ['./Reflection.jsx', './Gratitude.jsx', './Grounding.jsx', './PanicMode.jsx']) {
      expect(read(file)).not.toMatch(/ExploreCard/);
    }
  });

  it('BetaVideoModal.jsx (the shared guided-video player, active across every journey) never imports ExploreCard - a playing/completed video overlay never shows a content catalogue', () => {
    expect(read('../components/BetaVideoModal.jsx')).not.toMatch(/ExploreCard/);
  });
});

describe('Merely opening/previewing content, or an early close, never counts as completion', () => {
  it('Library.jsx\'s own BetaVideoModal usage is completely unchanged by this pass - completion still fires only on hasEnded (a genuine natural end), never on open/preview', () => {
    const librarySource = read('./Library.jsx');
    expect(librarySource).toMatch(/completionContext=\{\{ journey: 'library', onPrimaryAction: closeVideo, onSecondaryAction: closeVideo \}\}/);
  });

  it('opening the Explore destination itself (a plain navigation) never calls recordPracticeCompletion or any completion-writing function - ExploreCard/Library both import no such function', () => {
    expect(read('../components/ExploreCard.jsx')).not.toMatch(/recordPracticeCompletion/);
    expect(read('./Library.jsx')).not.toMatch(/recordPracticeCompletion/);
  });
});
