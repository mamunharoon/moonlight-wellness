// Morning-flow redesign — regression guard for the approved step order
// (Intend -> Stretch -> Breathe -> Affirm -> Complete) and every entry
// point that starts the Session Engine at Morning's first content step.
// Source-level checks for the three page files, matching this codebase's
// established pattern for logic that isn't practically renderable in this
// repo's Node-environment Vitest (see Home.routineState.test.js's own
// note) — the registry itself (sessionDefinitions.js) is plain data and
// is asserted on directly.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MORNING_ROUTINE_SESSION } from './sessionDefinitions';
import { MORNING_STEP_IDS, MORNING_DISPLAY_STEP_NUMBERS, MORNING_DISPLAY_STEP_COUNT } from './sessionConstants';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const homeSource = read('../pages/Home.jsx');
const routineDetailSource = read('../pages/RoutineDetail.jsx');
const alarmActiveSource = read('../pages/AlarmActive.jsx');
const progressIndicatorSource = read('../components/ProgressIndicator.jsx');
const useActiveRoutineStepSource = read('../hooks/useActiveRoutineStep.js');

describe('Approved Morning order: Intend -> Stretch -> Breathe -> Affirm -> Complete', () => {
  it('the registry itself has exactly this order (alarm first, as the separate pre-routine entry state)', () => {
    expect(MORNING_ROUTINE_SESSION.steps.map((s) => s.id)).toEqual([
      MORNING_STEP_IDS.ALARM,
      MORNING_STEP_IDS.INTENTION,
      MORNING_STEP_IDS.STRETCH,
      MORNING_STEP_IDS.BREATHE,
      MORNING_STEP_IDS.AFFIRMATION,
      MORNING_STEP_IDS.COMPLETE,
    ]);
  });

  it('MORNING_STEP_IDS no longer has a START member - the former /morning-start step is fully removed', () => {
    expect(MORNING_STEP_IDS.START).toBeUndefined();
  });

  it('the routes attached to each step match the approved pages', () => {
    const byId = Object.fromEntries(MORNING_ROUTINE_SESSION.steps.map((s) => [s.id, s.route]));
    expect(byId[MORNING_STEP_IDS.INTENTION]).toBe('/intention-setup');
    expect(byId[MORNING_STEP_IDS.STRETCH]).toBe('/morning-flow');
    expect(byId[MORNING_STEP_IDS.BREATHE]).toBe('/breathe');
    expect(byId[MORNING_STEP_IDS.AFFIRMATION]).toBe('/affirmation');
    expect(byId[MORNING_STEP_IDS.COMPLETE]).toBe('/session-complete');
  });

  it('display numbering is Intend=1, Stretch=2, Breathe=3, Affirm=4, out of 4 total (start no longer counted)', () => {
    expect(MORNING_DISPLAY_STEP_NUMBERS).toEqual({ intention: 1, stretch: 2, breathe: 3, affirmation: 4 });
    expect(MORNING_DISPLAY_STEP_COUNT).toBe(4);
  });

  it('Home.jsx\'s "Your Next Step" card never claims the stale 5-step count (Home redesign replaced step-counting copy with a duration estimate - see nextStepCard.js)', () => {
    expect(homeSource).not.toMatch(/5-step sequence/);
  });

  it("ProgressIndicator's visible-step set for morning-routine no longer includes 'start'", () => {
    // Checked against the actual data structure line specifically, not the
    // whole file — this file's own doc comments legitimately discuss the
    // historical 'start' step in prose while explaining why it's gone.
    const visibleSetLine = progressIndicatorSource.match(/^const VISIBLE_STEP_IDS_BY_SESSION = \{[\s\S]*?\n\};$/m)?.[0] ?? '';
    expect(visibleSetLine).not.toMatch(/'start'/);
    expect(visibleSetLine).toMatch(/\['intention', 'stretch', 'breathe', 'affirmation', 'complete'\]/);
  });

  it("the legacy journeyStep fallback map no longer resolves 'start' to any route", () => {
    expect(useActiveRoutineStepSource).not.toMatch(/start: '\/morning-start'/);
  });
});

describe('All three Morning entry points start the Session Engine at Intend, never Start', () => {
  it('Home.jsx\'s "Begin Rise & Reset" (handleBeginRiseAndReset) starts at MORNING_STEP_IDS.INTENTION and navigates to /intention-setup', () => {
    expect(homeSource).toMatch(/startSession\('morning-routine', \{ startIndex: getStepIndex\('morning-routine', MORNING_STEP_IDS\.INTENTION\) \}\);/);
    expect(homeSource).toMatch(/navigate\('\/intention-setup'\);/);
    expect(homeSource).not.toMatch(/MORNING_STEP_IDS\.START/);
  });

  it('"Repeat Morning Routine" reuses that exact same handleBeginRiseAndReset function - no separate repeat-specific start logic to drift out of sync', () => {
    expect(homeSource).toMatch(/if \(period === 'morning'\) handleBeginRiseAndReset\(\);/);
  });

  it('RoutineDetail.jsx\'s "Start Routine" for rise-reset starts at MORNING_STEP_IDS.INTENTION and its own startRoute is /intention-setup', () => {
    expect(routineDetailSource).toMatch(/startSession\('morning-routine', \{ startIndex: getStepIndex\('morning-routine', MORNING_STEP_IDS\.INTENTION\) \}\);/);
    expect(routineDetailSource).toMatch(/startRoute: '\/intention-setup'/);
    expect(routineDetailSource).not.toMatch(/MORNING_STEP_IDS\.START/);
  });

  it('AlarmActive.jsx\'s slide-to-unlock (handleUnlock) starts at MORNING_STEP_IDS.INTENTION and navigates to /intention-setup', () => {
    expect(alarmActiveSource).toMatch(/startSession\('morning-routine', \{ startIndex: getStepIndex\('morning-routine', MORNING_STEP_IDS\.INTENTION\) \}\);/);
    expect(alarmActiveSource).toMatch(/setJourneyStep\('intention'\);\s*\n\s*navigate\('\/intention-setup'\);/);
    expect(alarmActiveSource).not.toMatch(/MORNING_STEP_IDS\.START/);
  });

  it('none of the three entry points navigate to the removed /morning-start route (checked as an actual quoted route literal, not doc-comment prose)', () => {
    expect(homeSource).not.toMatch(/navigate\('\/morning-start'\)/);
    expect(routineDetailSource).not.toMatch(/startRoute: '\/morning-start'/);
    expect(alarmActiveSource).not.toMatch(/navigate\('\/morning-start'\)/);
  });
});

describe('One-time user-facing migration notice on Home.jsx - exact required copy, never framed as an error', () => {
  it('reads the notice via the one-shot consumeMorningFlowMigrationNotice() at module-evaluation time, never inside the component or an effect (StrictMode double-invoke safe)', () => {
    expect(homeSource).toMatch(/import \{ consumeMorningFlowMigrationNotice \} from '\.\.\/session\/morningFlowMigration';/);
    expect(homeSource).toMatch(/^const shouldShowMorningFlowMigrationNoticeOnLoad = consumeMorningFlowMigrationNotice\(\);$/m);
    expect(homeSource).toMatch(/const \[showMorningFlowMigrationNotice, setShowMorningFlowMigrationNotice\] = useState\(\s*\n\s*shouldShowMorningFlowMigrationNoticeOnLoad\s*\n\s*\);/);
  });

  it('shows the exact required copy when the flag is set', () => {
    expect(homeSource).toMatch(/Your Morning routine has been refreshed\. Start today's updated routine from the beginning\./);
  });

  it('never uses error-framed language (no "error", "failed", "sorry", "problem") anywhere in the notice copy', () => {
    const noticeBlock = homeSource.match(/\{showMorningFlowMigrationNotice && \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(noticeBlock.length).toBeGreaterThan(0);
    expect(noticeBlock.toLowerCase()).not.toMatch(/error|failed|sorry|problem|corrupt/);
  });

  it('dismissing only sets local component state (false) - the underlying flag was already consumed/cleared at read time, so it can never reappear on a later visit', () => {
    expect(homeSource).toMatch(/onClick=\{\(\) => setShowMorningFlowMigrationNotice\(false\)\}/);
  });
});
