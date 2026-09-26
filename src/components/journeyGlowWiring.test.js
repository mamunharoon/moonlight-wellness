// WakeWise DEV — colour glow extension: regression guard proving the
// correct Morning/Anytime/Evening theme variant is wired to every
// relevant shared-shell consumer, and that no consumer renders two
// competing atmosphere layers. No DOM/component rendering is available
// in this repo's Vitest (see Home.routineState.test.js's own note) -
// source-level checks, matching every other regression guard in this
// codebase for that reason.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const journeyGlowSource = read('./JourneyGlow.jsx');
const eveningSceneShellSource = read('./evening/EveningSceneShell.jsx');

describe('JourneyGlow.jsx — the one shared decorative layer', () => {
  it('uses the opacity-safe -tint tokens, never the plain accent tokens directly (those resolve to fully transparent with a Tailwind /<n> modifier - see index.css\'s own doc comment)', () => {
    expect(journeyGlowSource).toMatch(/bg-morning-accent-tint\/10/);
    expect(journeyGlowSource).toMatch(/bg-tertiary-tint\/10/);
    expect(journeyGlowSource).toMatch(/bg-evening-accent-tint\/10/);
    // Comments legitimately name the broken bg-*-accent/10 form in prose
    // explaining the bug this fixes - only the real code (the
    // JOURNEY_GLOW_CIRCLES object literal) matters here.
    const circlesBlock = journeyGlowSource.match(/const JOURNEY_GLOW_CIRCLES = \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(circlesBlock).not.toBe('');
    expect(circlesBlock).not.toMatch(/bg-morning-accent\/10/);
    expect(circlesBlock).not.toMatch(/bg-tertiary\/10/);
    expect(circlesBlock).not.toMatch(/bg-evening-accent\/10/);
  });

  it('is negatively z-indexed, not z-0 - a fixed z-0 layer would paint above plain in-flow (non-positioned) content, not behind it', () => {
    expect(journeyGlowSource).toMatch(/fixed inset-0 -z-10/);
    expect(journeyGlowSource).not.toMatch(/fixed inset-0 z-0/);
  });

  it('unknown/unsupported journey values render nothing, rather than a wrong-coloured default', () => {
    expect(journeyGlowSource).toMatch(/if \(!circles\) return null;/);
  });
});

describe('EveningSceneShell.jsx — journey prop, additive and defaulting to today\'s exact Evening behaviour', () => {
  it('defaults to \'evening\' - every caller that omits the prop is byte-identical to before this change', () => {
    expect(eveningSceneShellSource).toMatch(/journey = 'evening'/);
  });

  it('renders exactly one of AtmosphereManager or JourneyGlow, never both - no consumer can ever show two competing atmospheres', () => {
    const body = eveningSceneShellSource.match(/return \(\s*<>[\s\S]*?<\/>\s*\);/)?.[0] ?? '';
    expect(body).toMatch(/glowJourney \? \(/);
    expect(body).toMatch(/<JourneyGlow journey=\{glowJourney\} \/>/);
    expect(body).toMatch(/<AtmosphereManager/);
    // Both branches of one ternary, not two independent conditionals that
    // could both be true at once.
    const atmosphereBlock = body.slice(body.indexOf('{glowJourney ? ('), body.indexOf('{(showBack || showExit)'));
    expect(atmosphereBlock.match(/<JourneyGlow/g)?.length).toBe(1);
    expect(atmosphereBlock.match(/<AtmosphereManager/g)?.length).toBe(1);
  });

  // Context-aware Meditation/Breathing theming — 'morning' is a new,
  // additive glowJourney value alongside the existing 'anytime' one, for
  // QuietBreathing.jsx's standalone branch alone (see that file's own
  // dynamically-resolved journeyTone). Neither value ever reaches
  // AtmosphereManager's own moonlight/periwinkle branch.
  it('treats journey="morning" the same as journey="anytime" - JourneyGlow, never AtmosphereManager', () => {
    expect(eveningSceneShellSource).toMatch(
      /const glowJourney = journey === 'anytime' \|\| journey === 'morning' \? journey : null;/
    );
  });
});

describe('Anytime-flavoured EveningSceneShell consumers — each deliberately passes journey="anytime"', () => {
  // QuietBreathing.jsx deliberately excluded here - see its own describe
  // block below (Context-aware Meditation/Breathing theming: its
  // standalone branch now passes a dynamically-resolved journeyTone,
  // never a hardcoded literal; only its non-standalone/Support branch
  // still passes the literal "anytime").
  const anytimeConsumers = [
    '../pages/Support.jsx',
    '../pages/SupportComplete.jsx',
    '../pages/PanicMode.jsx',
    '../pages/Grounding.jsx',
    '../pages/StressRelease.jsx'
  ];

  it('every one of them passes journey="anytime" on every <EveningSceneShell> it renders', () => {
    for (const path of anytimeConsumers) {
      const source = read(path);
      const shellOpenTags = source.match(/<EveningSceneShell[^>]*>/g) ?? [];
      expect(shellOpenTags.length, `${path} should render at least one EveningSceneShell`).toBeGreaterThan(0);
      for (const tag of shellOpenTags) {
        expect(tag, `${path}'s <EveningSceneShell> should pass journey="anytime"`).toMatch(/journey="anytime"/);
      }
    }
  });
});

describe('QuietBreathing.jsx — one dynamic journey (standalone), one fixed literal (Support\'s embedded, non-standalone use)', () => {
  const source = read('../pages/QuietBreathing.jsx');

  it('the standalone branch passes journey={journeyTone} - never a hardcoded literal', () => {
    const shellOpenTags = source.match(/<EveningSceneShell[^>]*>/g) ?? [];
    expect(shellOpenTags.length).toBe(2);
    expect(shellOpenTags[0]).toMatch(/journey=\{journeyTone\}/);
    expect(shellOpenTags[0]).not.toMatch(/journey="anytime"/);
  });

  it('the non-standalone (Support-embedded) branch keeps the fixed literal journey="anytime" - it has its own real, unambiguous Anytime identity, unrelated to Home\'s rhythm tabs', () => {
    const shellOpenTags = source.match(/<EveningSceneShell[^>]*>/g) ?? [];
    expect(shellOpenTags[1]).toMatch(/journey="anytime"/);
  });
});

describe('Real Evening routes — untouched, no journey prop, still the exact original moonlight/dusk behaviour', () => {
  const eveningRoutes = [
    './EveningWindDown.jsx',
    './Reflection.jsx',
    './Gratitude.jsx',
    './EveningBreathing.jsx',
    './EveningMeditate.jsx',
    './PrepareForRest.jsx',
    './EveningComplete.jsx',
    './ReflectionReview.jsx',
    './GratitudeReview.jsx',
    './EditEveningResponses.jsx'
  ];

  it('none of them pass a journey prop to EveningSceneShell - every one keeps the default \'evening\' behaviour', () => {
    for (const path of eveningRoutes) {
      const source = read(`../pages${path.slice(1)}`);
      expect(source, `${path} should not pass journey= to EveningSceneShell`).not.toMatch(/journey=/);
    }
  });
});

describe('Morning screens — each renders the shared JourneyGlow with journey="morning"', () => {
  const morningScreens = [
    '../pages/IntentionSetup.jsx',
    '../pages/Affirmation.jsx',
    '../pages/SessionComplete.jsx',
    '../pages/MorningMeditate.jsx',
    '../pages/MorningFlow.jsx',
    '../pages/Breathe.jsx'
  ];

  it('every one imports JourneyGlow and renders it at least once with journey="morning"', () => {
    for (const path of morningScreens) {
      const source = read(path);
      expect(source, `${path} should import JourneyGlow`).toMatch(/import \{ JourneyGlow \} from '\.\.\/components\/JourneyGlow';/);
      const occurrences = source.match(/<JourneyGlow journey="morning" \/>/g) ?? [];
      expect(occurrences.length, `${path} should render <JourneyGlow journey="morning" /> at least once`).toBeGreaterThan(0);
    }
  });

  it('MorningMeditate.jsx renders it on all three of its own return branches (countdown, active session, setup)', () => {
    const source = read('../pages/MorningMeditate.jsx');
    const occurrences = source.match(/<JourneyGlow journey="morning" \/>/g) ?? [];
    expect(occurrences.length).toBe(3);
  });
});

describe('Anytime screens outside EveningSceneShell — each renders the shared JourneyGlow with journey="anytime"', () => {
  it('AnytimeReset.jsx imports and renders it', () => {
    const source = read('../pages/AnytimeReset.jsx');
    expect(source).toMatch(/import \{ JourneyGlow \} from '\.\.\/components\/JourneyGlow';/);
    expect(source).toMatch(/<JourneyGlow journey="anytime" \/>/);
  });

  // Context-aware Breathing/Meditation theming — SelfGuidedMeditation.jsx
  // now renders JourneyGlow with its own dynamically-resolved journeyTone
  // (see usePracticeJourneyTone.js) on all four return branches, never a
  // hardcoded "anytime" literal - it inherits whichever journey launched
  // it (Home's active rhythm tab, or a daypart fallback) rather than
  // always being mint.
  it('SelfGuidedMeditation.jsx renders it on all four of its own return branches (countdown, active session, early-ended, setup), each with the dynamic journeyTone', () => {
    const source = read('../pages/SelfGuidedMeditation.jsx');
    expect(source).toMatch(/import \{ JourneyGlow \} from '\.\.\/components\/JourneyGlow';/);
    expect(source).toMatch(/import \{ usePracticeJourneyTone \} from '\.\.\/hooks\/usePracticeJourneyTone';/);
    expect(source).toMatch(/const journeyTone = usePracticeJourneyTone\(\);/);
    const occurrences = source.match(/<JourneyGlow journey=\{journeyTone\} \/>/g) ?? [];
    expect(occurrences.length).toBe(4);
  });
});
