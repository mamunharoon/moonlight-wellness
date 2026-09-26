// Anytime Reset Visual Uplift (Phase 2 follow-up) — QuietBreathing.jsx's
// non-standalone branch (the real shared Gentle Reset/Support "calming
// breath" experience) gains a mint accent. Complements
// musicEntryChoice.test.js's own coverage of the accent prop itself; this
// file proves the surrounding wiring: the exercise CTA stays peach,
// BreathingRing is untouched, standalone/Morning/Evening are unaffected,
// and guest-music/session-only behaviour from d414822 is unchanged.
//
// Source-level checks, matching every other regression guard in this
// codebase (no DOM rendering available in this repo's Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./QuietBreathing.jsx');
const routineDetailSource = read('./RoutineDetail.jsx');
const supportSource = read('./Support.jsx');
const breatheSource = read('./Breathe.jsx');
const morningFlowSource = read('./MorningFlow.jsx');
const eveningBreathingSource = read('./EveningBreathing.jsx');

const standaloneStart = source.indexOf('if (standalone) {');
const nonStandaloneStart = source.indexOf('\n  return (\n    <EveningSceneShell');
const standaloneBlock = source.slice(standaloneStart, nonStandaloneStart);
const nonStandaloneBlock = source.slice(nonStandaloneStart);

describe('QuietBreathing.jsx — non-standalone branch found and correctly isolated from standalone', () => {
  it('both blocks were located', () => {
    expect(standaloneStart).toBeGreaterThan(-1);
    expect(standaloneBlock.length).toBeGreaterThan(0);
    expect(nonStandaloneBlock.length).toBeGreaterThan(0);
  });
});

// WakeWise DEV — journey-aware primary action colour: the later approved
// journey-colour pass explicitly reversed this phase's own "the CTA
// stays peach" decision for Continue specifically (this non-standalone
// branch is the same shared Gentle Reset/Support "calming breath"
// experience EveningSceneShell now renders with journey="anytime" - see
// EveningSceneShell.jsx's own doc comment), while deliberately leaving
// Skip exactly as it always was (still plain glass-panel/peach-neutral -
// Skip is one of the explicitly-excluded "stay subdued" controls in the
// approved brief, never recoloured).
describe('QuietBreathing.jsx — Continue resolves to the mint journey-action helper; Skip stays neutral, untouched', () => {
  it('the non-standalone Continue button resolves to the shared journey-action helper with journey=\'anytime\'', () => {
    const continueBlock = nonStandaloneBlock.match(/onClick=\{handleAdvance\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(continueBlock).toMatch(/getJourneyPrimaryActionClasses\('anytime'\)/);
    expect(continueBlock).not.toMatch(/bg-primary text-on-primary/);
  });

  it('the non-standalone Skip button is unchanged - still plain glass-panel, never accented', () => {
    const buttonMatches = nonStandaloneBlock.match(/className="w-full glass-panel[^"]*"/g) ?? [];
    expect(buttonMatches.length).toBeGreaterThanOrEqual(1);
    for (const cls of buttonMatches) {
      expect(cls).not.toMatch(/tertiary/);
    }
  });
});

describe('QuietBreathing.jsx — BreathingRing stays completely unchanged (approved decision C)', () => {
  it('BreathingRing is rendered with only its original two props, no new accent prop introduced anywhere in this file', () => {
    const usages = [...source.matchAll(/<BreathingRing[^/]*\/>/g)].map((m) => m[0]);
    expect(usages.length).toBeGreaterThanOrEqual(1);
    for (const usage of usages) {
      expect(usage).toBe('<BreathingRing breatheState={breatheState} secondsLeft={secondsLeft} />');
    }
  });

  it('BreathingRing.jsx itself was not touched by this phase - it has no accent mechanism to pass one to', () => {
    const ringSource = read('../components/BreathingRing.jsx');
    expect(ringSource).not.toMatch(/accent/);
  });
});

describe('QuietBreathing.jsx — standalone branch (/breathe-standalone) is completely unaffected', () => {
  it('the mint intro icon only exists in the non-standalone block, never inside the standalone block', () => {
    expect(standaloneBlock).not.toMatch(/text-tertiary/);
    expect(nonStandaloneBlock).toMatch(/text-tertiary text-3xl" aria-hidden="true">air</);
  });

  // WakeWise DEV — journey-aware primary action colour: MusicPreferenceToggle
  // and BreathingPatternRow now both explicitly pass accent="anytime"
  // (added by that later pass) instead of omitting the prop - this test's
  // own original "neither received an accent prop this phase" was true
  // only of the phase it was written for; standalone's mint identity now
  // extends to these two controls as well, not just the intro icon.
  it('standalone never renders MusicEntryChoice at all - it uses MusicPreferenceToggle/BreathingPatternRow instead, both explicitly passing accent="anytime"', () => {
    expect(standaloneBlock).not.toMatch(/<MusicEntryChoice/);
    expect(standaloneBlock).toMatch(/<MusicPreferenceToggle\s*\n\s*isOn=\{musicPreferenceOn\}\s*\n\s*onToggle=\{handleToggleMusicPreference\}\s*\n\s*description="Play gentle music during your breathing practice\."\s*\n\s*accent="anytime"\s*\n\s*\/>/);
    expect(standaloneBlock).toMatch(/<BreathingPatternRow[\s\S]*?accent="anytime"/);
  });
});

describe('Morning and Evening breathing screens are unaffected by this phase', () => {
  it('Breathe.jsx, MorningFlow.jsx, and EveningBreathing.jsx no longer render MusicEntryChoice at all (Build 15), so none of them can be touched by its new accent prop', () => {
    for (const s of [breatheSource, morningFlowSource, eveningBreathingSource]) {
      expect(s).not.toMatch(/<MusicEntryChoice/);
    }
  });

  it('none of the three files reference the new mint intro icon added to QuietBreathing.jsx', () => {
    for (const s of [breatheSource, morningFlowSource, eveningBreathingSource]) {
      expect(s).not.toMatch(/text-tertiary text-3xl" aria-hidden="true">air</);
    }
  });
});

describe('Guest music choice remains session-only and causes no authentication navigation (d414822 unchanged)', () => {
  it('handleStartWithMusic/handleContinueWithoutMusic only ever set local musicChoiceMade state and (for Start) call the ref-exposed start() - never setPendingContent, never navigate', () => {
    const startBody = source.match(/const handleStartWithMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const continueBody = source.match(/const handleContinueWithoutMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(startBody).toMatch(/setMusicChoiceMade\(true\)/);
    expect(startBody).toMatch(/musicPlayerRef\.current\?\.start\(\)/);
    expect(continueBody).toMatch(/setMusicChoiceMade\(true\)/);
    for (const body of [startBody, continueBody]) {
      expect(body).not.toMatch(/setPendingContent|navigate\(|isGuest/);
    }
  });

  it('no confirmSignInForMusic (or any music-related auth helper) is actually declared or called anywhere in this file - fully removed in d414822, not reintroduced by this phase (a doc comment legitimately still names it in prose explaining its removal)', () => {
    expect(source).not.toMatch(/const confirmSignInForMusic|confirmSignInForMusic\(/);
  });

  it('the choice is never persisted to the shared musicPreference.js key - setMusicPreferenceForUser is used elsewhere in this file only for the real, separate pre-start toggle (standalone), never for this one-shot entry choice', () => {
    const startBody = source.match(/const handleStartWithMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(startBody).not.toMatch(/setMusicPreferenceForUser/);
  });
});

describe('Support and Gentle Reset continue to open the exact same route and behaviour', () => {
  it('Gentle Reset\'s startRoute is /quiet-breathing, non-standalone (no `standalone` prop passed at the route level)', () => {
    expect(routineDetailSource).toMatch(/startRoute: '\/quiet-breathing'/);
  });

  it('Support\'s "calm" need also routes interactively to the exact same /quiet-breathing path', () => {
    expect(supportSource).toMatch(/route: '\/quiet-breathing'/);
  });

  it('App.jsx registers exactly one non-standalone route for this component - both entry points share the identical rendered experience, including the new mint accent', () => {
    const appSource = read('../App.jsx');
    expect(appSource).toMatch(/<Route path="quiet-breathing" element=\{withFallback\(<QuietBreathing \/>\)\} \/>/);
  });
});
