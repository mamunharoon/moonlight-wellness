// Evening Visual Uplift (Phase 7) — Home.jsx's own wiring of
// EveningJourneyPathway across all 3 Evening card states. No DOM
// rendering available in this repo's Vitest - source-level checks,
// matching this codebase's own established precedent.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./Home.jsx');

describe('Home.jsx - EveningJourneyPathway wired into all 3 Evening card states', () => {
  it('imports EveningJourneyPathway and the pure stage-derivation helper, never a locally re-implemented mapping', () => {
    expect(source).toMatch(/import \{ EveningJourneyPathway \} from '\.\.\/components\/EveningJourneyPathway';/);
    expect(source).toMatch(/import \{ resolveEveningPathwayStage \} from '\.\.\/lib\/eveningJourneyPathwayStage';/);
  });

  it('not-started card renders the pathway with no currentStageId - plain/neutral preview, nothing highlighted yet', () => {
    // eveningCardState === 'in-progress' also appears earlier, in plain
    // derivation logic (not JSX) - anchor on the actual not-started CARD
    // JSX block (the one gated on !eveningHasStaleChoice) through to the
    // next real JSX card block after it.
    const iNotStartedCard = source.indexOf("eveningCardState === 'not-started' && !eveningHasStaleChoice");
    const notStartedBlock = source.slice(iNotStartedCard, source.indexOf("eveningCardState === 'in-progress' &&", iNotStartedCard));
    expect(notStartedBlock).toMatch(/<EveningJourneyPathway \/>/);
  });

  it('in-progress card passes currentStageId derived from the same resolved step index the card\'s own "Step X of Y" text already uses - one source of truth, no separate/competing progress store', () => {
    const iInProgressCard = source.indexOf("eveningCardState === 'in-progress' &&");
    const inProgressBlock = source.slice(
      iInProgressCard,
      source.indexOf("eveningCardState === 'completed'", iInProgressCard)
    );
    expect(inProgressBlock).toMatch(/<EveningJourneyPathway currentStageId=\{eveningCurrentStageId\} \/>/);
    expect(source).toMatch(/const eveningCurrentStageId = resolveEveningPathwayStage\(\s*\n\s*getSessionById\(RITUAL_SESSION_IDS\.evening\)\?\.steps\[eveningResolvedStepIndex\]\?\.id\s*\n\s*\);/);
  });

  it('completed card deliberately passes NEITHER currentStageId NOR stageStatus - state.status===\'completed\' only reliably confirms the whole routine finished, never that each individual stage was genuinely completed rather than skipped', () => {
    const iCompleted = source.indexOf("eveningCardState === 'completed'");
    const completedBlock = source.slice(iCompleted, source.indexOf('<EveningJourneyPathway', iCompleted) + 200);
    expect(completedBlock).toMatch(/<EveningJourneyPathway \/>/);
    expect(completedBlock).not.toMatch(/currentStageId=/);
    expect(completedBlock).not.toMatch(/stageStatus=/);
  });

  it('no call site anywhere in Home.jsx ever passes a stageStatus prop - the "100% vs skipped stages" policy is a reported follow-up, not fabricated here', () => {
    expect(source).not.toMatch(/stageStatus=/);
  });

  it('Morning\'s own MorningJourneyPathway wiring is completely untouched by this pass - still receives currentStepNumber, its own established (different) completion contract', () => {
    expect(source).toMatch(/<MorningJourneyPathway currentStepNumber=/);
  });
});
