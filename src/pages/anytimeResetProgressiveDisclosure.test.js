// WakeWise Phase 2 (B5) — Anytime Reset's recommendation, "Choose
// another", "Change need"/"Change time", and the quick-reset alternatives
// used to all compete visually with the recommendation (everything always
// visible at once). This file covers the progressive-disclosure fix:
// the recommendation + Start stay primary; "Choose another" is a real
// disclosure toggle (collapsed by default); expanding it reveals the
// genuine other matching items (if any) plus the three existing
// quick-reset practices; Change need/Change time remain available as
// quieter tertiary actions; nothing is removed and nothing invented.
//
// No DOM/component rendering is available in this repo's Vitest - source-
// level checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./AnytimeReset.jsx', import.meta.url)), 'utf-8');
const recommendationCardSource = readFileSync(fileURLToPath(new URL('../components/journey/RecommendationCard.jsx', import.meta.url)), 'utf-8');

describe('AnytimeReset.jsx — alternativesOpen: collapsed by default, a real accessible disclosure', () => {
  it('starts false', () => {
    expect(source).toMatch(/const \[alternativesOpen, setAlternativesOpen\] = useState\(false\);/);
  });

  it('RecommendationCard receives expanded/controlsId for a standard aria-expanded/aria-controls disclosure contract (same pattern as Grounding.jsx\'s Phase 1 "Need more support?")', () => {
    expect(source).toMatch(/expanded=\{alternativesOpen\}/);
    expect(source).toMatch(/controlsId="anytime-reset-alternatives"/);
    expect(source).toMatch(/<div id="anytime-reset-alternatives" className="space-y-4">/);
  });

  it('RecommendationCard actually renders aria-expanded/aria-controls on its "Choose another" button when passed', () => {
    expect(recommendationCardSource).toMatch(/aria-expanded=\{expanded\}/);
    expect(recommendationCardSource).toMatch(/aria-controls=\{controlsId\}/);
  });
});

describe('AnytimeReset.jsx — the recommendation and Start stay primary; alternatives are collapsed, never competing equally', () => {
  it('the alternatives panel (other matches + quick-reset practices) only renders when alternativesOpen is true', () => {
    expect(source).toMatch(/\{!isComplete && alternativesOpen && \(/);
  });

  it('"Choose another" is always offered (never gated on items.length), so Breathe/Meditate/Instant Calm stay reachable even when the recommendation engine returns only one match (item 7)', () => {
    const cardBlock = source.match(/<RecommendationCard[\s\S]*?\/>/)?.[0] ?? '';
    expect(cardBlock).toMatch(/showChooseAnother\n/);
    expect(cardBlock).not.toMatch(/showChooseAnother=\{items\.length/);
  });

  it('Change need/Change time remain present as their own quieter row, visually distinct from the primary recommendation card and unaffected by the disclosure toggle', () => {
    expect(source).toMatch(/onClick=\{handleChangeNeed\}/);
    expect(source).toMatch(/onClick=\{handleChangeTime\}/);
    // Still their own `{!isComplete && (` block, independent of
    // alternativesOpen - visible regardless of whether the disclosure is
    // open, exactly as before.
    const changeBlock = source.slice(source.lastIndexOf('{!isComplete && (\n            <div className="flex gap-2">'));
    expect(changeBlock).not.toMatch(/alternativesOpen/);
  });
});

describe('AnytimeReset.jsx — expanding reveals the genuine existing alternatives, nothing invented', () => {
  it('other real recommendation-engine items (when more than one exists) are listed directly, excluding the currently-shown one, each selectable via handleSelectAlternativeItem', () => {
    const panelBlock = source.match(/\{!isComplete && alternativesOpen && \([\s\S]*?\n {10}\)\}/)?.[0] ?? '';
    expect(panelBlock).toMatch(/\{items\.length > 1 && \(/);
    expect(panelBlock).toMatch(/if \(index === optionIndex % items\.length\) return null;/);
    expect(panelBlock).toMatch(/onClick=\{\(\) => handleSelectAlternativeItem\(index\)\}/);
  });

  it('the three existing quick-reset practices (Breathe/Meditate/Instant Calm) are still rendered from the same unmodified QUICK_RESET_ALTERNATIVES data, now inside the disclosure', () => {
    const panelBlock = source.match(/\{!isComplete && alternativesOpen && \([\s\S]*?\n {10}\)\}/)?.[0] ?? '';
    expect(panelBlock).toMatch(/QUICK_RESET_ALTERNATIVES\.map/);
    expect(panelBlock).toMatch(/onClick=\{\(\) => handleQuickResetAlternative\(alt\.id\)\}/);
    expect(source).toMatch(/id: 'breathe', icon: 'air', label: 'Breathe'/);
    expect(source).toMatch(/id: 'meditate', icon: 'self_improvement', label: 'Meditate'/);
    expect(source).toMatch(/id: 'instant-calm', icon: 'bolt', label: 'Instant Calm'/);
    expect(source).not.toMatch(/label: 'Stretch'|label: 'Quick Walk'/);
  });

  it('the disclosure is hidden entirely during the completion state, matching the existing "Choose another quick reset" two-action panel as the one way back', () => {
    expect(source).toMatch(/\{!isComplete && alternativesOpen && \(/);
  });
});

describe('AnytimeReset.jsx — need/duration selection survives every alternative-related action (item 6)', () => {
  it('handleToggleAlternatives never touches needId/durationId', () => {
    const body = source.match(/const handleToggleAlternatives = \(\) => [\s\S]*?;/)?.[0] ?? '';
    expect(body).not.toMatch(/setNeedId|setDurationId/);
  });

  it('handleSelectAlternativeItem never touches needId/durationId', () => {
    const body = source.match(/const handleSelectAlternativeItem = \(index\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/setNeedId|setDurationId/);
  });

  it('Back (handleStepBack) never touches needId/durationId or the disclosure state - only the wizard step', () => {
    const body = source.match(/const handleStepBack = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/setNeedId|setDurationId|setAlternativesOpen/);
  });
});
