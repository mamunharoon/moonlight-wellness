// WakeWise Phase 3B (3B.2) — IntentionSetup.jsx's own wiring for the
// "Use yesterday's intention" shortcut: day-scoped stage entry, the
// shortcut's gating/copy, and that it commits through the same validated
// path as manual selection. Source-level checks - no DOM rendering in
// this repo's Vitest. Functional round-trip coverage for the underlying
// storage lives in previousIntentionShortcut.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./IntentionSetup.jsx', import.meta.url)), 'utf-8');

describe('IntentionSetup.jsx — day-scoped stage entry (3B.2)', () => {
  it('imports the previous-intention helpers and date utilities', () => {
    expect(source).toMatch(/import \{ recordIntentionConfirmation, getPreviousDayIntention, wasConfirmedToday \} from '\.\.\/lib\/previousIntentionShortcut';/);
    expect(source).toMatch(/import \{ getZonedParts \} from '\.\.\/lib\/timezone';/);
  });

  it('resolves today and the previous-day intention once, at mount', () => {
    expect(source).toMatch(/const \[today\] = useState\(\(\) => getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey\);/);
    expect(source).toMatch(/const \[previousDayIntention\] = useState\(\(\) => getPreviousDayIntention\(userId, today\)\);/);
  });

  it('stage only skips to Summary when confirmed AND confirmed today - not merely "ever confirmed" - so a new day is asked fresh unless the shortcut or a manual pick is used', () => {
    expect(source).toMatch(/return isReviewMode \|\| \(intentionsConfirmed && wasConfirmedToday\(userId, today\)\) \? 'summary' : 'primary';/);
  });

  it('Review Mode is unaffected - it still always lands on Summary regardless of the date check (isReviewMode is checked first, short-circuiting)', () => {
    const stageInit = source.match(/const \[stage, setStage\] = useState\(\(\) => \{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(stageInit).toMatch(/isReviewMode \|\|/);
  });
});

describe('IntentionSetup.jsx — the shortcut itself: explicit tap only, real validated commit path', () => {
  it('only renders when a genuine prior-day record exists - never a default/invented value', () => {
    expect(source).toMatch(/\{previousDayIntention && previousDayIntention\.length > 0 && \(/);
  });

  it('shows the actual prior intentions as its own label text, not a generic "yesterday" placeholder', () => {
    expect(source).toMatch(/Use yesterday's intention/);
    expect(source).toMatch(/\{previousDayIntention\.join\(' · '\)\}/);
  });

  it('is a real 44px+ tap target button, not a link or a bare span', () => {
    const shortcutBlock = source.slice(source.indexOf("Use yesterday's intention") - 500, source.indexOf("Use yesterday's intention") + 100);
    expect(shortcutBlock).toMatch(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{handleUsePreviousIntention\}\s*\n\s*className="w-full min-h-\[44px\]/);
  });

  it('handleUsePreviousIntention commits BOTH roles at once through the same shared commit() path every manual selection uses, then jumps straight to Summary - never a separate, second write mechanism', () => {
    const handlerBody = source.match(/const handleUsePreviousIntention = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handlerBody).toMatch(/commit\(previousDayIntention\);/);
    expect(handlerBody).toMatch(/setStage\('summary'\);/);
    expect(handlerBody).not.toMatch(/setIntentions\(/); // never a second, redundant write bypassing commit()
  });

  it('guards against an empty/missing record defensively, even though the render condition above already excludes it', () => {
    const handlerBody = source.match(/const handleUsePreviousIntention = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handlerBody).toMatch(/if \(!previousDayIntention \|\| previousDayIntention\.length === 0\) return;/);
  });
});

describe('IntentionSetup.jsx — genuine confirmations are recorded, Skip never is', () => {
  it('handleComplete records a confirmation only inside the confirmed=true branch (Continue), never unconditionally', () => {
    const body = source.match(/const handleComplete = async \(confirmed\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(confirmed\) \{\s*\n\s*setIntentionsConfirmed\(true\);\s*\n\s*recordIntentionConfirmation\(userId, toSave, today\);\s*\n\s*\}/);
  });

  it('a review-mode edit also records a confirmation (it is a genuine save, matching its existing setIntentionsConfirmed(true) precedent)', () => {
    expect(source).toMatch(/setIntentionsConfirmed\(true\);\s*\n\s*recordIntentionConfirmation\(userId, next, today\);/);
  });
});
