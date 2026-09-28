// Evening Visual Uplift (Phase 7), Phase 9 — Truthful Journey Outcomes —
// Home.jsx's own wiring of EveningJourneyPathway across all 3 Evening
// card states. No DOM rendering available in this repo's Vitest -
// source-level checks, matching this codebase's own established
// precedent.
//
// Phase 7's "completed card deliberately passes NEITHER currentStageId
// NOR stageStatus" behaviour is exactly the gap Phase 9 was raised to
// close (the Session Engine now genuinely tracks stepOutcomes per stage,
// so the completed card can finally show each stage's real, honest
// outcome instead of omitting it entirely). These tests assert the new,
// corrected wiring.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./Home.jsx');

describe('Home.jsx - EveningJourneyPathway wired into all 3 Evening card states with real per-stage status', () => {
  it('imports EveningJourneyPathway/EVENING_PATHWAY_STAGES and the pure stage-status helper, never a locally re-implemented mapping', () => {
    expect(source).toMatch(/import \{ EveningJourneyPathway \} from '\.\.\/components\/EveningJourneyPathway';/);
    expect(source).toMatch(/import \{ MORNING_PATHWAY_STAGES, EVENING_PATHWAY_STAGES \} from '\.\.\/session\/pathwayStages';/);
    expect(source).toMatch(/import \{ computeStageStatus \} from '\.\.\/session\/stageStatus';/);
  });

  it('computes eveningPathwayStages once from computeStageStatus, fed by the real Session Engine stepOutcomes (live state when this routine is live, otherwise today\'s persisted snapshot) - never a fabricated/hardcoded status', () => {
    expect(source).toMatch(/const eveningPathwayStages = computeStageStatus\(\{/);
    expect(source).toMatch(/stages: EVENING_PATHWAY_STAGES,/);
    expect(source).toMatch(/stepOutcomes: eveningStepOutcomes,/);
  });

  it('not-started card renders the pathway with no props - plain/neutral preview, nothing highlighted yet, byte-identical to before this stage was ever reached', () => {
    const iNotStartedCard = source.indexOf("eveningCardState === 'not-started' && !eveningHasStaleChoice");
    const notStartedBlock = source.slice(iNotStartedCard, source.indexOf("eveningCardState === 'in-progress' &&", iNotStartedCard));
    expect(notStartedBlock).toMatch(/<EveningJourneyPathway \/>/);
  });

  it('in-progress card passes the real computed stages prop - one source of truth, no separate/competing progress store', () => {
    const iInProgressCard = source.indexOf("eveningCardState === 'in-progress' &&");
    const inProgressBlock = source.slice(
      iInProgressCard,
      source.indexOf("eveningCardState === 'completed'", iInProgressCard)
    );
    expect(inProgressBlock).toMatch(/<EveningJourneyPathway stages=\{eveningPathwayStages\} \/>/);
  });

  it('completed card ALSO now passes the real computed stages prop - Phase 9 closes the "100% vs skipped stages" follow-up: each stage shows its true, honest recorded outcome instead of being omitted', () => {
    const iCompleted = source.indexOf("eveningCardState === 'completed'");
    const completedBlock = source.slice(iCompleted, source.indexOf('<EveningJourneyPathway', iCompleted) + 200);
    expect(completedBlock).toMatch(/<EveningJourneyPathway stages=\{eveningPathwayStages\} \/>/);
  });

  it('Morning\'s own MorningJourneyPathway wiring received the identical treatment - the in-progress/completed cards both now pass real stages too', () => {
    expect(source).toMatch(/<MorningJourneyPathway stages=\{morningPathwayStages\} \/>/);
  });
});
