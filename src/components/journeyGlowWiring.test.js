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
    expect(body).toMatch(/isAnytime \? \(/);
    expect(body).toMatch(/<JourneyGlow journey="anytime" \/>/);
    expect(body).toMatch(/<AtmosphereManager/);
    // Both branches of one ternary, not two independent conditionals that
    // could both be true at once.
    const atmosphereBlock = body.slice(body.indexOf('{isAnytime ? ('), body.indexOf('{(showBack || showExit)'));
    expect(atmosphereBlock.match(/<JourneyGlow/g)?.length).toBe(1);
    expect(atmosphereBlock.match(/<AtmosphereManager/g)?.length).toBe(1);
  });
});

describe('Anytime-flavoured EveningSceneShell consumers — each deliberately passes journey="anytime"', () => {
  const anytimeConsumers = [
    '../pages/Support.jsx',
    '../pages/SupportComplete.jsx',
    '../pages/PanicMode.jsx',
    '../pages/Grounding.jsx',
    '../pages/StressRelease.jsx',
    '../pages/QuietBreathing.jsx'
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

  it('QuietBreathing.jsx passes it on BOTH its standalone and non-standalone branches (two separate EveningSceneShell call sites)', () => {
    const source = read('../pages/QuietBreathing.jsx');
    const occurrences = source.match(/journey="anytime"/g) ?? [];
    expect(occurrences.length).toBe(2);
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

  it('SelfGuidedMeditation.jsx renders it on all four of its own return branches (countdown, active session, early-ended, setup)', () => {
    const source = read('../pages/SelfGuidedMeditation.jsx');
    expect(source).toMatch(/import \{ JourneyGlow \} from '\.\.\/components\/JourneyGlow';/);
    const occurrences = source.match(/<JourneyGlow journey="anytime" \/>/g) ?? [];
    expect(occurrences.length).toBe(4);
  });
});
