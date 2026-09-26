// WakeWise Phase 2 (B4) — real found defect: Meditate.jsx's handleVideoClose
// routed to /meditation-complete unconditionally, with no natural-end
// check at all (unlike AnytimeReset.jsx's onEnded-driven isComplete or
// QuietBreathing.jsx's earlyEnded), so closing a guided meditation video
// early was indistinguishable from finishing it - MeditationComplete.jsx
// showed "Meditation complete" and wrote the daily completion flag either
// way. Fixed: a real videoEndedNaturally flag (BetaVideoModal's onEnded),
// carried through router state as `endedEarly`, gates both the honest
// headline/body and whether completion is ever recorded.
//
// No DOM/component rendering is available in this repo's Vitest - source-
// level checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const meditateSource = readFileSync(fileURLToPath(new URL('./Meditate.jsx', import.meta.url)), 'utf-8');
const completeSource = readFileSync(fileURLToPath(new URL('./MeditationComplete.jsx', import.meta.url)), 'utf-8');

describe('Meditate.jsx — real natural-end vs early-close distinction', () => {
  it('videoEndedNaturally starts false and is reset before opening a new video (handleBegin)', () => {
    expect(meditateSource).toMatch(/const \[videoEndedNaturally, setVideoEndedNaturally\] = useState\(false\);/);
    const beginBody = meditateSource.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(beginBody).toMatch(/setVideoEndedNaturally\(false\);/);
  });

  it('BetaVideoModal is wired with a real onEnded callback, exactly like AnytimeReset.jsx\'s own onEnded={() => setIsComplete(true)}', () => {
    expect(meditateSource).toMatch(/<BetaVideoModal entry=\{openVideo\} onClose=\{handleVideoClose\} onEnded=\{\(\) => setVideoEndedNaturally\(true\)\} \/>/);
  });

  it('handleVideoClose computes endedEarly as the inverse of videoEndedNaturally, resets the flag, and forwards endedEarly through router state to /meditation-complete', () => {
    const body = meditateSource.match(/const handleVideoClose = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/const endedEarly = !videoEndedNaturally;/);
    expect(body).toMatch(/setVideoEndedNaturally\(false\);/);
    expect(body).toMatch(/navigate\('\/meditation-complete', \{\s*\n\s*state: \{\s*\n\s*id: entry\.id,\s*\n\s*title: entry\.title,\s*\n\s*durationSeconds: entry\.meditation\?\.durationSeconds \?\? null,\s*\n\s*endedEarly/);
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

  it('Return Home and Choose another BOTH gate the daily-completion write behind !endedEarly - a genuine early exit must never record completion', () => {
    const returnHomeBody = completeSource.match(/const handleReturnHome = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const chooseAnotherBody = completeSource.match(/const handleChooseAnother = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(returnHomeBody).toMatch(/if \(!endedEarly\) localStorage\.setItem\(getMeditationCompletionKey\(userId\), today\);/);
    expect(chooseAnotherBody).toMatch(/if \(!endedEarly\) localStorage\.setItem\(getMeditationCompletionKey\(userId\), today\);/);
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
