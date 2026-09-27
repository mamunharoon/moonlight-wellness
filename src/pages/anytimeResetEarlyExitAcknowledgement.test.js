// WakeWise Phase 2 (B4) — Anytime Reset's real, found defect: closing the
// recommended media early never claimed completion (correct), but it also
// never acknowledged stopping early in any way - it silently fell back to
// the ordinary "Recommended for you" state as if nothing had happened.
// This file covers the fix: a transient justEndedEarly flag, raised only
// on an early close, cleared by every action that already clears
// isComplete, and rendered as a rotating, honest "ended early" message
// via the shared outcomeMessages.js model - never a claim of completion,
// never a blocking modal.
//
// No DOM/component rendering is available in this repo's Vitest - source-
// level checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./AnytimeReset.jsx', import.meta.url)), 'utf-8');

describe('AnytimeReset.jsx — justEndedEarly: raised only on an early close, never on a natural end', () => {
  it('starts false', () => {
    expect(source).toMatch(/const \[justEndedEarly, setJustEndedEarly\] = useState\(false\);/);
  });

  it('handleVideoClose raises it ONLY when isComplete is not already true (a genuine natural end, via onEnded, never touches this flag)', () => {
    const body = source.match(/const handleVideoClose = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!isComplete\) setJustEndedEarly\(true\);/);
  });

  it('imports the shared outcome-message model', () => {
    expect(source).toMatch(/import \{ OUTCOME, JOURNEY, getOutcomeMessage \} from '\.\.\/lib\/outcomeMessages';/);
  });
});

describe('AnytimeReset.jsx — justEndedEarly is cleared by every action that already clears isComplete (a fresh recommendation never inherits a stale acknowledgement)', () => {
  it.each(['handleSelectNeed', 'handleSelectDuration', 'handleChangeTime', 'handleChangeNeed'])('%s resets both isComplete and justEndedEarly', (handler) => {
    const body = source.match(new RegExp(`const ${handler} = \\([^)]*\\) => \\{[\\s\\S]*?\\n {2}\\};`))?.[0] ?? '';
    expect(body).toMatch(/setIsComplete\(false\);/);
    expect(body).toMatch(/setJustEndedEarly\(false\);/);
  });

  it('handleBegin also clears it before opening a new video, so re-starting after an early close never shows a stale acknowledgement mid-playback', () => {
    const body = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setJustEndedEarly\(false\);/);
  });

  it('handleSelectAlternativeItem (choosing a specific real alternative directly) also clears both, so a fresh selection never inherits a stale acknowledgement', () => {
    const body = source.match(/const handleSelectAlternativeItem = \(index\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setIsComplete\(false\);/);
    expect(body).toMatch(/setJustEndedEarly\(false\);/);
  });
});

describe('AnytimeReset.jsx — rendering: three mutually-exclusive states, never a false completion claim', () => {
  // WakeWise guided-media completion phase — outcomeMessage no longer has
  // a completed branch of its own: a genuine natural completion is now
  // acknowledged entirely inside BetaVideoModal's own shared overlay
  // (completionContext, journey: 'anytime'), never by this page's own
  // headline. This is the honest early-close acknowledgement or nothing.
  it('outcomeMessage resolves ended_early, else null (ordinary state) - dateKey-rotated via the caller\'s own local "today" - never a completed branch of its own any more', () => {
    expect(source).toMatch(/const today = getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey;/);
    expect(source).toMatch(/const outcomeMessage = justEndedEarly \? getOutcomeMessage\(OUTCOME\.ENDED_EARLY, JOURNEY\.ANYTIME, today\) : null;/);
    expect(source).not.toMatch(/OUTCOME\.COMPLETED/);
  });

  it('the heading/body fall back to "Recommended for you"/the need+duration summary only when outcomeMessage is null', () => {
    expect(source).toMatch(/\{outcomeMessage \? outcomeMessage\.headline : 'Recommended for you'\}/);
    expect(source).toMatch(/\{outcomeMessage\s*\n\s*\? outcomeMessage\.body\s*\n\s*: `\$\{ANYTIME_RESET_NEEDS\.find/);
  });

  it('an early-exit acknowledgement is shown inline alongside the still-functional recommendation (RecommendationCard/Start remain reachable) - never a blocking modal; justEndedEarly only ever affects the heading copy above, never the recommendation view itself (there is no page-level completion panel of any kind any more - guided-media completion phase)', () => {
    const recommendStep = source.slice(source.indexOf("step === 'recommend' &&"), source.indexOf('{openVideo && ('));
    expect(recommendStep).toMatch(/\{current \? \(/);
    expect(recommendStep).not.toMatch(/isComplete \? \(/);
    expect(recommendStep).not.toMatch(/justEndedEarly \? \(/);
  });
});
