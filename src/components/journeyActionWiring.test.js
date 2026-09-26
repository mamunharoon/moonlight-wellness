// WakeWise DEV — journey-aware primary action colour: regression guard
// proving the correct journey/accent value is wired to every primary CTA
// this pass touched. No DOM/component rendering is available in this
// repo's Vitest (see Home.routineState.test.js's own note) - source-level
// checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('Plain per-page primary CTAs — each resolves getJourneyPrimaryActionClasses with its own real journey', () => {
  const expectations = [
    // [file, journey, how many call sites expected]
    ['../pages/Home.jsx', 'morning', 4],
    ['../pages/Home.jsx', 'evening', 4],
    ['../pages/Home.jsx', 'anytime', 1],
    ['../pages/IntentionSetup.jsx', 'morning', 2],
    ['../pages/Affirmation.jsx', 'morning', 1],
    ['../pages/SessionComplete.jsx', 'morning', 1],
    ['../pages/MorningFlow.jsx', 'morning', 2],
    ['../pages/Breathe.jsx', 'morning', 2],
    ['../pages/AnytimeReset.jsx', 'anytime', 1],
    // Context-aware Breathing/Meditation theming — QuietBreathing.jsx's
    // standalone branch now passes the dynamic journeyTone (see the
    // describe block below), not a hardcoded 'anytime' literal; only its
    // non-standalone (Support-embedded) branch still does, which has its
    // own real, unambiguous Anytime identity.
    ['../pages/QuietBreathing.jsx', 'anytime', 1],
    ['../pages/EveningWindDown.jsx', 'evening', 2],
    ['../pages/EveningBreathing.jsx', 'evening', 2],
    ['../pages/PrepareForRest.jsx', 'evening', 1],
    ['../pages/EveningComplete.jsx', 'evening', 1]
  ];

  it.each(expectations)('%s calls getJourneyPrimaryActionClasses(%s) exactly %i time(s)', (path, journey, count) => {
    const source = read(path);
    expect(source).toMatch(/import \{ getJourneyPrimaryActionClasses \} from '\.\.\/lib\/journeyAction';/);
    const escaped = journey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const occurrences = source.match(new RegExp(`getJourneyPrimaryActionClasses\\('${escaped}'\\)`, 'g')) ?? [];
    expect(occurrences.length).toBe(count);
  });
});

describe('Shared accent-prop components — each caller passes its own real journey explicitly, never guessed from a route name inside the shared component', () => {
  // Context-aware Meditation theming — the prop MeditationSetupPanel.jsx/
  // MeditationActiveSession.jsx accept was renamed accent -> journeyTone
  // (see those files' own doc comments). Morning/Evening's embedded
  // callers still pass their own fixed literal (unambiguous, no capture
  // needed); SelfGuidedMeditation.jsx now passes its own dynamically-
  // resolved journeyTone instead of a hardcoded 'anytime' literal.
  it('MeditationSetupPanel.jsx: MorningMeditate/EveningMeditate pass their own fixed journeyTone; SelfGuidedMeditation passes its dynamically-resolved one', () => {
    expect(read('../pages/MorningMeditate.jsx')).toMatch(/<MeditationSetupPanel\s*\n\s*compact\s*\n\s*journeyTone="morning"/);
    expect(read('../pages/EveningMeditate.jsx')).toMatch(/<MeditationSetupPanel\s*\n\s*compact\s*\n\s*journeyTone="evening"/);
    expect(read('../pages/SelfGuidedMeditation.jsx')).toMatch(/<MeditationSetupPanel\s*\n\s*compact=\{false\}\s*\n\s*journeyTone=\{journeyTone\}/);
  });

  it('MeditationActiveSession.jsx: MorningMeditate/EveningMeditate pass their own fixed journeyTone; SelfGuidedMeditation passes its dynamically-resolved one', () => {
    expect(read('../pages/MorningMeditate.jsx')).toMatch(/<MeditationActiveSession\s*\n\s*journeyTone="morning"/);
    expect(read('../pages/EveningMeditate.jsx')).toMatch(/<MeditationActiveSession\s*\n\s*journeyTone="evening"/);
    expect(read('../pages/SelfGuidedMeditation.jsx')).toMatch(/<MeditationActiveSession\s*\n\s*journeyTone=\{journeyTone\}/);
  });

  it('PreparationCountdown.jsx: standalone Anytime-family callers still pass a real accent, not omitted - QuietBreathing.jsx dynamically, SelfGuidedMeditation.jsx dynamically too (see usePracticeJourneyTone.js)', () => {
    expect(read('../pages/QuietBreathing.jsx')).toMatch(/<PreparationCountdown[\s\S]*?accent=\{journeyTone\}/);
    expect(read('../pages/SelfGuidedMeditation.jsx')).toMatch(/<PreparationCountdown[\s\S]*?accent=\{journeyTone\}/);
  });

  it('MusicPreferenceToggle.jsx and BreathingPatternRow.jsx: QuietBreathing.jsx\'s standalone branch passes the dynamic accent={journeyTone} to both, never a hardcoded literal', () => {
    const source = read('../pages/QuietBreathing.jsx');
    expect(source).toMatch(/<MusicPreferenceToggle[\s\S]*?accent=\{journeyTone\}/);
    expect(source).toMatch(/<BreathingPatternRow[\s\S]*?accent=\{journeyTone\}/);
  });

  it('RecommendationCard.jsx: AnytimeReset.jsx passes accent="anytime" (unchanged from the earlier mint-border pass); Meditate.jsx still omits it, keeping the peach fallback', () => {
    expect(read('../pages/AnytimeReset.jsx')).toMatch(/<RecommendationCard[\s\S]*?accent="anytime"/);
    const meditateSource = read('../pages/Meditate.jsx');
    expect(meditateSource).toMatch(/<RecommendationCard/);
    const callSite = meditateSource.match(/<RecommendationCard[\s\S]*?\/>/)?.[0] ?? '';
    expect(callSite).not.toMatch(/accent=/);
  });
});

describe('Escape/neutral controls are never recoloured', () => {
  it('Home.jsx: "Start Over"/"Start Today\'s Routine" secondary buttons never reference getJourneyPrimaryActionClasses', () => {
    const source = read('../pages/Home.jsx');
    const startOverButtons = source.match(/onClick=\{\(\) => setActiveDialog\(\{ kind: '(?:start-over|discard-stale)'[^)]*\)\}[\s\S]{0,300}?className="[^"]*"/g) ?? [];
    expect(startOverButtons.length).toBeGreaterThanOrEqual(2);
    for (const button of startOverButtons) {
      expect(button).not.toMatch(/getJourneyPrimaryActionClasses/);
      expect(button).toMatch(/glass-panel/);
    }
  });

  it('QuietBreathing.jsx: standalone Skip/End early/Back controls are never recoloured', () => {
    const source = read('../pages/QuietBreathing.jsx');
    expect(source).toMatch(/onClick=\{handleEndEarly\}[\s\S]{0,200}?glass-panel text-on-surface-variant/);
  });
});
