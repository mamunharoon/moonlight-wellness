// WakeWise Phase 2 (B4) — original found defect: Meditate.jsx's
// handleVideoClose routed to /meditation-complete unconditionally, with no
// natural-end check at all, so closing a guided meditation video early was
// indistinguishable from finishing it. Fixed then via a videoEndedNaturally
// flag carried through router state to a separate completion page.
//
// WakeWise guided-media completion phase — that separate-page architecture
// is now superseded: a genuine natural end is acknowledged entirely inside
// BetaVideoModal's own shared completion overlay (completionContext,
// journey: 'direct'); a real early close now correctly does nothing more
// than close the modal and return to this exact recommend step, matching
// every other migrated call site. videoEndedNaturally/endedEarly/the
// /meditation-complete navigation are gone from this file entirely.
// onEnded is still wired (fired only from BetaVideoModal's own real
// native `ended` event, same as before) purely to preserve the
// pre-existing "meditated today" daily-completion flag Home.jsx reads
// (isMeditatedToday) - previously written only from the now-bypassed
// MeditationComplete.jsx's own button handlers, on a genuine natural end
// only. MeditationComplete.jsx itself is untouched (still exists, still
// tested below) - only unreachable from this particular flow now.
//
// No DOM/component rendering is available in this repo's Vitest - source-
// level checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const meditateSource = readFileSync(fileURLToPath(new URL('./Meditate.jsx', import.meta.url)), 'utf-8');
const completeSource = readFileSync(fileURLToPath(new URL('./MeditationComplete.jsx', import.meta.url)), 'utf-8');

describe('Meditate.jsx — natural end is acknowledged in-modal, never a separate page or flag', () => {
  it('no more videoEndedNaturally/endedEarly tracking, and no navigation to /meditation-complete from this file', () => {
    expect(meditateSource).not.toMatch(/videoEndedNaturally|endedEarly/);
    expect(meditateSource).not.toMatch(/navigate\('\/meditation-complete'/);
  });

  it('handleVideoClose is now a plain, one-line close - no natural-end branching of its own (that lives in BetaVideoModal)', () => {
    expect(meditateSource).toMatch(/const handleVideoClose = \(\) => setOpenVideoId\(null\);/);
  });

  it('BetaVideoModal is wired with completionContext (journey: \'direct\')', () => {
    expect(meditateSource).toMatch(/<BetaVideoModal\s*\n\s*entry=\{openVideo\}\s*\n\s*onClose=\{handleVideoClose\}[\s\S]*?\n\s*onEnded=\{[\s\S]*?\n\s*completionContext=\{\{\s*\n\s*journey: 'direct',/);
  });

  it('onEnded still writes the exact same "meditated today" localStorage flag (same key, same user-scoped mechanism, same local dateKey) that MeditationComplete.jsx used to write on a genuine natural end - Home.jsx\'s isMeditatedToday indicator must survive this migration unchanged', () => {
    expect(meditateSource).toMatch(/import \{ getZonedParts \} from '\.\.\/lib\/timezone';/);
    expect(meditateSource).toMatch(/import \{ now as devNow \} from '\.\.\/lib\/devClock';/);
    expect(meditateSource).toMatch(/import \{ getMeditationCompletionKey \} from '\.\.\/lib\/dailyCompletion';/);
    expect(meditateSource).toMatch(/const \{ effectiveTimezone, userId \} = useAlarm\(\);/);
    const onEndedBody = meditateSource.match(/onEnded=\{\(\) => \{[\s\S]*?\n\s*\}\}/)?.[0] ?? '';
    expect(onEndedBody).toMatch(/const today = getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey;/);
    expect(onEndedBody).toMatch(/localStorage\.setItem\(getMeditationCompletionKey\(userId\), today\);/);
  });

  it('the primary action just closes the modal (stays right here); the secondary "Explore Another Session" only cycles when a genuinely different item exists (items.length > 1)', () => {
    const block = meditateSource.match(/completionContext=\{\{[\s\S]*?\n\s*\}\}/)?.[0] ?? '';
    expect(block).toMatch(/onPrimaryAction: \(\) => setOpenVideoId\(null\),/);
    expect(block).toMatch(/onSecondaryAction: items\.length > 1\s*\n\s*\? \(\) => \{\s*\n\s*handleChooseAnother\(\);\s*\n\s*setOpenVideoId\(null\);\s*\n\s*\}\s*\n\s*: undefined/);
  });
});

describe('MeditationComplete.jsx — honest outcome, and completion is never recorded for a genuine early exit', () => {
  it('imports the shared outcome-message model', () => {
    expect(completeSource).toMatch(/import \{ OUTCOME, JOURNEY, getOutcomeMessage \} from '\.\.\/lib\/outcomeMessages';/);
  });

  it('endedEarly is derived from session.endedEarly (real router state, never guessed)', () => {
    expect(completeSource).toMatch(/const endedEarly = Boolean\(session\?\.endedEarly\);/);
  });

  it('headline/body resolve to the honest ended_early message when endedEarly, otherwise the completed message - both Anytime-toned, both via the shared model', () => {
    expect(completeSource).toMatch(/const \{ headline, body: outcomeBody \} = endedEarly\s*\n\s*\? getOutcomeMessage\(OUTCOME\.ENDED_EARLY, JOURNEY\.ANYTIME, today\)\s*\n\s*: getOutcomeMessage\(OUTCOME\.COMPLETED, JOURNEY\.ANYTIME, today\);/);
  });

  it('Return Home and Choose another BOTH gate the daily-completion write behind !endedEarly (plus, "Your Momentum" foundation Phase 2, genuine session state) - a genuine early exit, or a bare direct URL visit, must never record completion', () => {
    const returnHomeBody = completeSource.match(/const handleReturnHome = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const chooseAnotherBody = completeSource.match(/const handleChooseAnother = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(returnHomeBody).toMatch(/if \(session && !endedEarly\) localStorage\.setItem\(getMeditationCompletionKey\(userId\), today\);/);
    expect(chooseAnotherBody).toMatch(/if \(session && !endedEarly\) localStorage\.setItem\(getMeditationCompletionKey\(userId\), today\);/);
  });

  it('renders {headline}/{outcomeBody} directly - no hardcoded "Meditation complete" string remains', () => {
    expect(completeSource).toMatch(/<h1 className="font-serif italic text-3xl text-on-surface">\{headline\}<\/h1>/);
    expect(completeSource).toMatch(/<p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">\{outcomeBody\}<\/p>/);
    expect(completeSource).not.toMatch(/>Meditation complete</);
  });

  it('the session-detail card (title/duration) still renders whenever real session state is present, regardless of outcome', () => {
    expect(completeSource).toMatch(/\{session && \(/);
    expect(completeSource).toMatch(/\{session\.title\}/);
  });
});
