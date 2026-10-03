// Rotating 100% Evening completion messages correction — EveningComplete.jsx
// now sources its rotating headline via the shared journey/practice
// completion-greeting architecture (getCompletionGreeting, evening/routine
// pool) already approved for every other Morning/Anytime/Evening exercise
// completion, migrated cleanly off the older getOutcomeMessage/day-of-year
// rotation (WakeWise Phase 2 B6) - that rotation only ever changed once
// every 5 calendar days per user, indistinguishable from "stuck" within any
// single test session, which is the real defect this correction fixes.
// Source-level regression guard.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./EveningComplete.jsx', import.meta.url)), 'utf-8');

describe('EveningComplete.jsx — migrated cleanly off the older getOutcomeMessage architecture, never stacking two selectors', () => {
  it('no longer imports OUTCOME/JOURNEY/getOutcomeMessage - imports getCompletionGreeting instead', () => {
    expect(source).not.toMatch(/import \{ OUTCOME, JOURNEY, getOutcomeMessage \}/);
    expect(source).not.toMatch(/getOutcomeMessage\(/);
    expect(source).toMatch(/import \{ getCompletionGreeting \} from '\.\.\/lib\/outcomeMessages';/);
  });

  it('picks the headline exactly once, via a lazy useState initializer, using the evening/routine pool - never a plain const recomputed on every render (which would corrupt the anti-repeat mechanism and violate "stable through re-renders")', () => {
    expect(source).toMatch(/const \[headline\] = useState\(\(\) => getCompletionGreeting\(\{ journey: 'evening', practice: 'routine' \}\)\);/);
  });

  it('Phase 9 — Truthful Journey Outcomes: the primary <h1>/supporting-line pair is now the outcome-gated exact copy (never the old unconditional "You\'ve reflected, appreciated the day and prepared for rest." claim); {headline} (this rotating pool) still renders, as a smaller secondary line beneath it', () => {
    expect(source).toMatch(/<h1 className="font-serif text-3xl text-on-surface">\s*\n\s*\{eveningFullyCompleted \? 'Evening Wind-Down complete' : 'Evening Wind-Down finished'\}\s*\n\s*<\/h1>/);
    expect(source).not.toMatch(/You've reflected, appreciated the day and prepared for rest\./);
    expect(source).toMatch(/<p className="text-sm text-on-surface-variant\/80 italic">\{headline\}<\/p>/);
  });

  it('`today`/getZonedParts/devNow are still present - still needed for the completion-date-attribution and Redo-tonight local-date logic, just no longer for the headline itself', () => {
    expect(source).toMatch(/const today = getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey;/);
    expect(source).toMatch(/import \{ getZonedParts \} from '\.\.\/lib\/timezone';/);
    expect(source).toMatch(/import \{ now as devNow \} from '\.\.\/lib\/devClock';/);
  });

  it('the mount-effect completion-recording guard is completely unchanged - this correction never touches when the daily flag is written', () => {
    expect(source).toMatch(/if \(state\.status === 'playing' && currentStep\?\.id === 'completion'\) \{\s*\n\s*completeSession\(\);/);
  });

  it('every existing action (Choose a Sleep Experience, Review or Edit, Redo Tonight\'s Wind-Down, Return Home) is completely unchanged', () => {
    expect(source).toMatch(/Choose a Sleep Experience/);
    expect(source).toMatch(/Review or Edit Tonight's Responses/);
    expect(source).toMatch(/Redo Tonight's Wind-Down/);
    expect(source).toMatch(/Return Home/);
  });

  it('the periwinkle evening-accent badge/styling is completely unchanged', () => {
    expect(source).toMatch(/bg-evening-accent\/10 border border-evening-accent-tint\/25 shadow-evening-glow/);
  });
});
