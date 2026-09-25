// Guest pre-start-music correction, part 2 (Build 18) — real-execution +
// source-level regression coverage for the two remaining controls
// identified after the first round (ExercisePausedPanel's "Resume with
// Music", MusicEntryChoice / Support's embedded Quiet Breathing), plus
// explicit QuietBreathing.jsx confirmation separate from Breathe.jsx.
// Complements (does not duplicate) musicEntryChoice.test.js's own
// updated structural coverage of both components and their consumers.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const pausedPanelSource = read('./ExercisePausedPanel.jsx');
const choiceSource = read('./MusicEntryChoice.jsx');
const breatheSource = read('../pages/Breathe.jsx');
const morningFlowSource = read('../pages/MorningFlow.jsx');
const eveningBreathingSource = read('../pages/EveningBreathing.jsx');
const quietBreathingSource = read('../pages/QuietBreathing.jsx');
const playerSource = read('./InteractiveAmbientMusic.jsx');

const RESUME_SURFACES = [
  ['Breathe.jsx', breatheSource],
  ['MorningFlow.jsx', morningFlowSource],
  ['EveningBreathing.jsx', eveningBreathingSource],
];

describe('ExercisePausedPanel — no /auth navigation, no authentication callback', () => {
  it('the component itself has no navigate/SignInPromptDialog/isGuest/onSignIn reference anywhere in real code', () => {
    const codeOnly = pausedPanelSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/navigate|SignInPromptDialog|isGuest|onSignIn|\/auth/);
  });

  for (const [name, source] of RESUME_SURFACES) {
    it(`${name}: handleResumeWithMusic itself has no isGuest check, no navigate('/auth') call - it is identical for every user`, () => {
      const body = source.match(/const handleResumeWithMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).not.toBe('');
      expect(body).not.toMatch(/isGuest|navigate\('\/auth'\)/);
      expect(body).toMatch(/musicPlayerRef\.current\?\.start\(\);/);
    });
  }
});

describe('ExercisePausedPanel — Resume with Music preserves the exact paused timer/phase/movement/session state', () => {
  for (const [name, source] of RESUME_SURFACES) {
    it(`${name}: handleResumeWithMusic only clears the interrupt flags and starts music - it never touches timer/phase/movement state`, () => {
      const body = source.match(/const handleResumeWithMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).not.toMatch(/setSecondsLeft|setBreatheState|setTimeLeft|setActiveStep|setSelectedMovements|setActiveSequence/);
    });
  }

  it('Breathe.jsx/MorningFlow.jsx: handleResumeWithMusic clears videoOpenedDuringExercise and manuallyPaused - the exact same two flags Resume Exercise clears, nothing more', () => {
    for (const source of [breatheSource, morningFlowSource]) {
      const body = source.match(/const handleResumeWithMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).toMatch(/setVideoOpenedDuringExercise\(false\);/);
      expect(body).toMatch(/setManuallyPaused\(false\);/);
    }
  });

  it('EveningBreathing.jsx: handleResumeWithMusic clears manuallyPaused only (no guided-video concept on this screen) - same shape, narrower', () => {
    const body = eveningBreathingSource.match(/const handleResumeWithMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setManuallyPaused\(false\);/);
  });
});

describe('ExercisePausedPanel — starts or resumes exactly one correct audio instance; "Resume without Music" (Resume Exercise) stays silent', () => {
  for (const [name, source] of RESUME_SURFACES) {
    it(`${name}: InteractiveAmbientMusic is still mounted exactly once - Resume with Music can never create a second instance`, () => {
      const mountCount = (source.match(/<InteractiveAmbientMusic/g) ?? []).length;
      expect(mountCount).toBe(1);
    });

    it(`${name}: handleResumeExercise (the plain "Resume Exercise" action) never calls start() or touches musicPlayerRef - it stays genuinely silent`, () => {
      // Matches either a single-expression arrow (EveningBreathing.jsx) or
      // a block-bodied one (Breathe.jsx/MorningFlow.jsx).
      const body = (
        source.match(/const handleResumeExercise = \(\) => \{[\s\S]*?\n {2}\};/) ??
        source.match(/const handleResumeExercise = \(\) => [^\n]+;/)
      )?.[0] ?? '';
      expect(body).not.toBe('');
      expect(body).not.toMatch(/musicPlayerRef|start\(\)/);
    });
  }

  it('start() itself (InteractiveAmbientMusic.jsx, shared by every caller) is guarded by isBusyRef for its whole async body - Resume with Music tapped rapidly, or alongside the active toggle, can never issue two overlapping start() calls', () => {
    expect(playerSource).toMatch(/const start = async \(\) => \{\s*\n\s*if \(isBusyRef\.current\) return;\s*\n\s*isBusyRef\.current = true;/);
  });
});

describe('ExercisePausedPanel — guest selection is session-only; authenticated persistence is unchanged', () => {
  for (const [name, source] of RESUME_SURFACES) {
    it(`${name}: handleResumeWithMusic never calls setMusicPreference or setMusicPreferenceForUser directly - a ref-triggered start() was never, and is still not, a persistence event for any user`, () => {
      const body = source.match(/const handleResumeWithMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).not.toMatch(/setMusicPreference/);
    });
  }

  it('the active toggle\'s own persistence (InteractiveAmbientMusic.jsx\'s handleToggle) is completely untouched by this round - still routes through the shared setMusicPreferenceForUser exactly as the first correction left it', () => {
    const body = playerSource.match(/const handleToggle = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setMusicPreferenceForUser\(false, \{ isGuest \}\);/);
    expect(body).toMatch(/setMusicPreferenceForUser\(true, \{ isGuest \}\);/);
  });
});

describe('MusicEntryChoice / Support Quiet Breathing — no /auth navigation, no authentication callback', () => {
  it('the component itself has no navigate/SignInPromptDialog/isGuest/onSignIn reference anywhere in real code', () => {
    const codeOnly = choiceSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/navigate|SignInPromptDialog|isGuest|onSignIn|\/auth/);
  });

  it('QuietBreathing.jsx no longer defines confirmSignInForMusic anywhere, and no navigate(\'/auth\') call remains tied to the music entry choice', () => {
    const codeOnly = quietBreathingSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/confirmSignInForMusic/);
    expect(codeOnly).not.toMatch(/navigate\('\/auth'\)/);
  });

  it('handleStartWithMusic and handleContinueWithoutMusic (QuietBreathing.jsx) have no isGuest check at all - identical for every user', () => {
    const startBody = quietBreathingSource.match(/const handleStartWithMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const continueBody = quietBreathingSource.match(/const handleContinueWithoutMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(startBody).not.toMatch(/isGuest/);
    expect(continueBody).not.toMatch(/isGuest/);
  });
});

describe('MusicEntryChoice / Support Quiet Breathing — the choice flows into the real session correctly', () => {
  it('Music On (Start with Music) uses the guest-allowed IB01 path: the same INTERACTIVE_BREATHING_MUSIC_ID constant, the same musicPlayerRef, the same InteractiveAmbientMusic instance the choice itself is rendered above', () => {
    expect(quietBreathingSource).toMatch(/const INTERACTIVE_BREATHING_MUSIC_ID = 'IB01';/);
    expect(quietBreathingSource).toMatch(/const handleStartWithMusic = \(\) => \{\s*\n\s*setMusicChoiceMade\(true\);\s*\n\s*musicPlayerRef\.current\?\.start\(\);\s*\n\s*\};/);
    const nonStandaloneReturn = quietBreathingSource.slice(quietBreathingSource.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(nonStandaloneReturn).toMatch(/<InteractiveAmbientMusic ref=\{musicPlayerRef\} musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\} \/>/);
  });

  it('Music Off (Continue Without Music) starts the session silently - only sets musicChoiceMade, never touches musicPlayerRef or the countdown', () => {
    const body = quietBreathingSource.match(/const handleContinueWithoutMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setMusicChoiceMade\(true\);/);
    expect(body).not.toMatch(/musicPlayerRef|start\(\)|secondsLeft|breatheState/);
  });

  it('no duplicate audio: InteractiveAmbientMusic is mounted exactly once in the non-standalone (Support) return', () => {
    const nonStandaloneReturn = quietBreathingSource.slice(quietBreathingSource.lastIndexOf('return (\n    <EveningSceneShell'));
    const mountCount = (nonStandaloneReturn.match(/<InteractiveAmbientMusic/g) ?? []).length;
    expect(mountCount).toBe(1);
  });

  it('no timer reset or navigation side effect: neither handler touches secondsLeft/breatheState/navigate', () => {
    const startBody = quietBreathingSource.match(/const handleStartWithMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(startBody).not.toMatch(/setSecondsLeft|setBreatheState|navigate\(/);
  });
});

describe('MusicEntryChoice / Support Quiet Breathing — guest choice is not persisted', () => {
  it('neither handleStartWithMusic nor handleContinueWithoutMusic ever calls setMusicPreference or setMusicPreferenceForUser - this legacy entry-choice flow has never written to the shared key, for any user, guest or authenticated', () => {
    const startBody = quietBreathingSource.match(/const handleStartWithMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const continueBody = quietBreathingSource.match(/const handleContinueWithoutMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(startBody).not.toMatch(/setMusicPreference/);
    expect(continueBody).not.toMatch(/setMusicPreference/);
  });
});

describe('Explicit confirmation: QuietBreathing.jsx final behaviour, standalone vs non-standalone, separate from Breathe.jsx', () => {
  it('QuietBreathing.jsx standalone=true branch (the earlier round\'s fix) still uses MusicPreferenceToggle + a real Begin gesture, exactly like Breathe.jsx - confirmed independently here', () => {
    const standaloneReturn = quietBreathingSource.slice(quietBreathingSource.indexOf('if (standalone) {'), quietBreathingSource.indexOf('return (\n    <EveningSceneShell'));
    const toggleCallSite = standaloneReturn.match(/<MusicPreferenceToggle[\s\S]{0,300}\/>/)?.[0] ?? '';
    expect(toggleCallSite).toMatch(/isOn=\{musicPreferenceOn\}/);
    expect(toggleCallSite).toMatch(/onToggle=\{handleToggleMusicPreference\}/);
    // Scoped to the toggle's own call site, not the whole standalone
    // return - that block also legitimately renders SignInPromptDialog
    // with its own, unrelated onSignIn={confirmSignInForVideo} for
    // guided-video protection, which this correction must not touch.
    expect(toggleCallSite).not.toMatch(/isGuest=|onSignIn=/);
  });

  it('QuietBreathing.jsx non-standalone (Support) branch uses the ENTIRELY different MusicEntryChoice/musicChoiceMade pattern, never MusicPreferenceToggle/musicPreferenceOn/hasBegun - the two branches remain genuinely distinct code paths, both now guest-accessible via their own respective fix', () => {
    const nonStandaloneReturn = quietBreathingSource.slice(quietBreathingSource.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(nonStandaloneReturn).toMatch(/<MusicEntryChoice/);
    expect(nonStandaloneReturn).not.toMatch(/MusicPreferenceToggle|musicPreferenceOn|hasBegun/);
  });

  it('QuietBreathing.jsx is a genuinely separate file from Breathe.jsx - both fixed, neither reused as a stand-in for the other, both confirmed independently across this and the prior test round', () => {
    expect(quietBreathingSource).not.toBe(breatheSource);
    expect(quietBreathingSource).toMatch(/export const QuietBreathing = \(\{ standalone = false \}\) => \{/);
    expect(breatheSource).toMatch(/export const Breathe = \(\) => \{/);
  });
});

describe('Cleanup remains correct — unaffected by this round, confirmed unchanged', () => {
  it('InteractiveAmbientMusic.jsx\'s own unmount cleanup (pause/removeAttribute/load) is byte-identical to before this round - neither ExercisePausedPanel nor MusicEntryChoice\'s fix touched it', () => {
    expect(playerSource).toMatch(/audio\.pause\(\);\s*\n\s*audio\.removeAttribute\('src'\);\s*\n\s*audio\.load\(\);/);
  });

  it('QuietBreathing.jsx standalone branch: InteractiveAmbientMusic still sits once, outside the pre-start/active ternary, hidden pre-start or once complete (standalone completion redesign added the isComplete term) - the same single-stable-instance shape proven before, unaffected by the non-standalone branch\'s own separate fix', () => {
    const standaloneReturn = quietBreathingSource.slice(quietBreathingSource.indexOf('if (standalone) {'), quietBreathingSource.indexOf('return (\n    <EveningSceneShell'));
    expect(standaloneReturn).toMatch(/<InteractiveAmbientMusic\s*\n\s*ref=\{musicPlayerRef\}\s*\n\s*musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\}\s*\n\s*suspended=\{false\}\s*\n\s*hideToggle=\{!hasBegun \|\| isComplete\}\s*\n\s*\/>/);
  });
});
