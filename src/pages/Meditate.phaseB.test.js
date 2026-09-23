// Build 15 Phase B — Meditate.jsx regression guard for the shared
// selection-screen restyling (JourneyHeader/SelectionChip/SelectionRow/
// RecommendationCard). Mirrors the AnytimeReset.test.js rework pattern:
// this file checks Meditate.jsx passes the correct DATA/PROPS into each
// shared component; each shared component's own test file covers the
// actual markup/accessibility guarantee. Source-level checks - this
// repo's Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Meditate.jsx', import.meta.url)), 'utf-8');

describe('Meditate.jsx — Phase B: shared components imported, no bespoke markup left behind', () => {
  it('imports all four shared journey components', () => {
    expect(source).toMatch(/import \{ JourneyHeader \} from '\.\.\/components\/journey\/JourneyHeader';/);
    expect(source).toMatch(/import \{ SelectionChip \} from '\.\.\/components\/journey\/SelectionChip';/);
    expect(source).toMatch(/import \{ SelectionRow \} from '\.\.\/components\/journey\/SelectionRow';/);
    expect(source).toMatch(/import \{ RecommendationCard \} from '\.\.\/components\/journey\/RecommendationCard';/);
  });

  it('no longer imports BackButton directly - JourneyHeader owns that now', () => {
    expect(source).not.toMatch(/import \{ BackButton \}/);
  });

  it('the duration step\'s old raw <button> list and the need step\'s old raw <button> grid are both gone', () => {
    expect(source).not.toMatch(/chevron_right<\/span>\s*\n\s*<\/button>/);
    expect(source).not.toMatch(/glass-panel rounded-2xl p-4 text-center/);
  });
});

describe('Meditate.jsx — Phase B: step order is unchanged (duration first, need second - opposite of Anytime Reset)', () => {
  it('stepIndex maps duration=0, need=1, recommend=2', () => {
    expect(source).toMatch(/const stepIndex = step === 'duration' \? 0 : step === 'need' \? 1 : 2;/);
  });

  it('JourneyHeader receives stepCount={3} and the correct live stepIndex', () => {
    expect(source).toMatch(/<JourneyHeader[\s\S]{0,200}stepIndex=\{stepIndex\}\s*\n\s*stepCount=\{3\}/);
  });
});

describe('Meditate.jsx — Phase B: JourneyHeader replaces the old inline Back/Close block', () => {
  it('passes showBackButton only true on the duration step (still the first step) and the existing handleStepBack/handleClose', () => {
    expect(source).toMatch(/<JourneyHeader\s*\n\s*showBackButton=\{step === 'duration'\}\s*\n\s*backFallback="\/"\s*\n\s*onStepBack=\{handleStepBack\}\s*\n\s*onClose=\{handleClose\}/);
  });

  it('handleClose is new in Phase B (Meditate never had a Close control before) and navigates Home, matching AnytimeReset.jsx\'s own handleClose', () => {
    const body = source.match(/const handleClose = \(\) => navigate\('\/'\);/)?.[0] ?? '';
    expect(body).not.toBe('');
  });
});

describe('Meditate.jsx — Phase B: duration step uses SelectionRow with real data, own copy/order preserved', () => {
  it('maps MEDITATION_DURATION_GROUPS (unchanged data source) into SelectionRow, passing label/description/selected/onClick', () => {
    expect(source).toMatch(/\{MEDITATION_DURATION_GROUPS\.map\(\(group\) => \(\s*\n\s*<SelectionRow\s*\n\s*key=\{group\.id\}\s*\n\s*label=\{group\.label\}\s*\n\s*description=\{group\.description\}\s*\n\s*selected=\{durationGroupId === group\.id\}\s*\n\s*onClick=\{\(\) => handleSelectDuration\(group\.id\)\}/);
  });

  it('duration remains the FIRST step shown (step === \'duration\'), never reordered to match Anytime Reset', () => {
    expect(source).toMatch(/\{step === 'duration' && \(/);
  });
});

describe('Meditate.jsx — Phase B: need step uses SelectionChip with a local, Meditate-specific icon map', () => {
  it('maps MEDITATION_NEEDS (unchanged data source, still 8 needs incl. mindfulness/gratitude/self-compassion) into SelectionChip', () => {
    expect(source).toMatch(/\{MEDITATION_NEEDS\.map\(\(need\) => \(\s*\n\s*<SelectionChip\s*\n\s*key=\{need\.id\}\s*\n\s*label=\{need\.label\}\s*\n\s*icon=\{NEED_ICONS\[need\.id\]\}\s*\n\s*selected=\{needId === need\.id\}\s*\n\s*onClick=\{\(\) => handleSelectNeed\(need\.id\)\}/);
  });

  it('NEED_ICONS is a local lookup (not a mediaCatalog.js field) covering all 8 Meditate need ids, and is a separate object from AnytimeReset\'s own NEED_ICONS', () => {
    expect(source).toMatch(/const NEED_ICONS = \{/);
    ['calm', 'focus', 'mindfulness', 'stress-relief', 'body-awareness', 'gratitude', 'self-compassion', 'deep-relaxation'].forEach((id) => {
      const key = /^[a-z]+$/.test(id) ? id : `'${id}'`;
      expect(source).toMatch(new RegExp(`${key}: '[a-z_]+'`));
    });
  });

  it('every NEED_ICONS value is a real Material Symbols ligature name, never an emoji literal', () => {
    const iconsBlock = source.match(/const NEED_ICONS = \{[\s\S]*?\n\};/)?.[0] ?? '';
    const values = [...iconsBlock.matchAll(/:\s*'([^']*)'/g)].map((m) => m[1]);
    expect(values).toHaveLength(8);
    values.forEach((v) => expect(v).toMatch(/^[a-z_]+$/));
  });
});

describe('Meditate.jsx — Phase B: recommend step uses RecommendationCard, own copy/logic preserved exactly', () => {
  it('passes the real recommendation engine\'s values through as props, never hardcoded/invented content', () => {
    expect(source).toMatch(/title=\{current\.title\}/);
    expect(source).toMatch(/durationLabel=\{formatDuration\(current\.meditation\.durationSeconds\)\}/);
    expect(source).toMatch(/description=\{current\.description\}/);
    expect(source).toMatch(/isClosestMatch=\{recommendation\.matchQuality === 'closest'\}/);
    expect(source).toMatch(/matchReason=\{current\.matchReason\}/);
  });

  it('keeps Meditate\'s own exact button copy - "Begin" (not "Start") and "Choose Another" (capital A, not AnytimeReset\'s "Choose another")', () => {
    expect(source).toMatch(/startLabel="Begin"/);
    expect(source).toMatch(/chooseAnotherLabel="Choose Another"/);
  });

  it('never passes startBusy/startDisabled - Meditate keeps its own simpler handleBegin (guest-check only, no server-revalidation hardening)', () => {
    const cardBlock = source.match(/<RecommendationCard[\s\S]*?\/>/)?.[0] ?? '';
    expect(cardBlock).not.toMatch(/startBusy/);
    expect(cardBlock).not.toMatch(/startDisabled/);
  });

  it('handleBegin itself is completely untouched: guest-check then setOpenVideoId, no verifyingAuthRef/getUser() added', () => {
    const body = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!current\) return;/);
    expect(body).toMatch(/if \(isGuest\) \{/);
    expect(body).toMatch(/setOpenVideoId\(current\.id\);/);
    expect(body).not.toMatch(/verifyingAuthRef|getUser\(/);
  });

  it('the empty-state copy is exactly preserved ("No session matches that combination yet.")', () => {
    expect(source).toMatch(/No session matches that combination yet\./);
  });

  it('showChooseAnother is driven by items.length > 1, same condition as before, no new persistence/logic', () => {
    expect(source).toMatch(/showChooseAnother=\{items\.length > 1\}/);
  });

  it('Change time then Change need button order is preserved exactly as before (opposite of AnytimeReset.jsx\'s own order)', () => {
    const recommendBlock = source.match(/\{step === 'recommend' && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    const timeIndex = recommendBlock.indexOf('onClick={handleChangeTime}');
    const needIndex = recommendBlock.indexOf('onClick={handleChangeNeed}');
    expect(timeIndex).toBeGreaterThan(-1);
    expect(needIndex).toBeGreaterThan(timeIndex);
  });
});

describe('Meditate.jsx — Phase B: protected regression areas stay byte-for-byte unchanged', () => {
  it('the recommendation engine and catalogue imports are unchanged', () => {
    expect(source).toMatch(/import \{ recommendMeditations \} from '\.\.\/lib\/meditationRecommendations';/);
    expect(source).toMatch(/import \{\s*\n\s*MEDITATION_DURATION_GROUPS,\s*\n\s*MEDITATION_NEEDS,\s*\n\s*getCatalogEntryById\s*\n\s*\} from '\.\.\/lib\/mediaCatalog';/);
  });

  it('BetaVideoModal is still reused unchanged - no second/alternate player introduced', () => {
    expect(source).toMatch(/<BetaVideoModal entry=\{openVideo\} onClose=\{handleVideoClose\} \/>/);
  });

  it('the post-sign-in restore/return-path mechanism is unchanged', () => {
    expect(source).toMatch(/const returnPath = \(\) => `\/meditate\?need=\$\{needId\}&duration=\$\{durationGroupId\}`;/);
    expect(source).toMatch(/setPendingContent\(\{ id: current\.id, returnPath: returnPath\(\) \}\);/);
  });
});
