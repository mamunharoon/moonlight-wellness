// Guest pre-start-music correction (Build 18) — real-execution + source-
// level regression coverage proving the pre-start `MusicPreferenceToggle`
// no longer intercepts a guest with a sign-in redirect on every
// interactive-timed screen that uses it (standalone Breathe, Morning
// Breathe, Evening Breathing, Morning Stretch), while an authenticated
// user's persisted preference is completely unaffected, and guided
// catalogue media (BetaVideoModal/SignInPromptDialog/useProtectedVideo)
// keeps its full, unrelated sign-in requirement.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase, plus real execution of the
// pure setMusicPreferenceForUser function itself.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const musicPreferenceLibSource = read('../lib/musicPreference.js');

const breatheSource = read('./Breathe.jsx');
const morningFlowSource = read('./MorningFlow.jsx');
const eveningBreathingSource = read('./EveningBreathing.jsx');
const quietBreathingSource = read('./QuietBreathing.jsx');
const toggleSource = read('../components/MusicPreferenceToggle.jsx');
const playerSource = read('../components/InteractiveAmbientMusic.jsx');

const SURFACES = [
  { name: 'Breathe.jsx (Morning Breathing, IB01)', source: breatheSource, accent: 'morning' },
  { name: 'MorningFlow.jsx (Morning Stretch, IS01)', source: morningFlowSource, accent: 'morning' },
  { name: 'EveningBreathing.jsx (Evening Breathing, IB01)', source: eveningBreathingSource, accent: 'evening' },
];

describe('1. Guest pre-start On/Off does not navigate or invoke authentication', () => {
  it('MusicPreferenceToggle.jsx itself has no isGuest/onSignIn prop and no navigate/SignInPromptDialog reference at all', () => {
    expect(toggleSource).toMatch(/export const MusicPreferenceToggle = \(\{ isOn, onToggle, label = 'Background music', description, accent = 'primary' \}\) => \{/);
    expect(toggleSource).toMatch(/onClick=\{onToggle\}/);
    const codeOnly = toggleSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/isGuest|onSignIn|navigate|SignInPromptDialog/);
  });

  for (const { name, source } of SURFACES) {
    it(`${name}: its own MusicPreferenceToggle call site passes neither isGuest nor onSignIn`, () => {
      const callSite = source.match(/<MusicPreferenceToggle[\s\S]{0,300}\/>/)?.[0] ?? '';
      expect(callSite).not.toBe('');
      expect(callSite).not.toMatch(/isGuest=/);
      expect(callSite).not.toMatch(/onSignIn=/);
    });
  }

  it('QuietBreathing.jsx standalone branch: same call site has neither prop either', () => {
    const callSite = quietBreathingSource.match(/<MusicPreferenceToggle[\s\S]{0,300}\/>/)?.[0] ?? '';
    expect(callSite).not.toBe('');
    expect(callSite).not.toMatch(/isGuest=/);
    expect(callSite).not.toMatch(/onSignIn=/);
  });
});

describe('2 & 3. Guest choice is session-only; authenticated choice still persists exactly as before', () => {
  it('setMusicPreferenceForUser (musicPreference.js) exists with the real guest-guard shape - see musicPreference.test.js for genuine real-execution coverage (localStorage mock lives there, this repo\'s established pattern)', () => {
    expect(musicPreferenceLibSource).toMatch(/export const setMusicPreferenceForUser = \(enabled, \{ isGuest \}\) => \{\s*\n\s*if \(isGuest\) return;\s*\n\s*setMusicPreference\(enabled\);\s*\n\s*\};/);
  });

  for (const { name, source } of SURFACES) {
    it(`${name}: handleToggleMusicPreference persists through the shared setMusicPreferenceForUser, passing the real isGuest, never the raw setMusicPreference`, () => {
      const body = source.match(/const handleToggleMusicPreference = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).toMatch(/setMusicPreferenceForUser\(next, \{ isGuest \}\);/);
      expect(body).not.toMatch(/setMusicPreference\(next\);/);
    });

    it(`${name}: imports setMusicPreferenceForUser, not the raw setMusicPreference`, () => {
      expect(source).toMatch(/import \{ getMusicPreference, setMusicPreferenceForUser \} from '\.\.\/lib\/musicPreference';/);
    });
  }

  it('QuietBreathing.jsx (standalone): same shared-helper wiring', () => {
    const body = quietBreathingSource.match(/const handleToggleMusicPreference = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setMusicPreferenceForUser\(next, \{ isGuest \}\);/);
    expect(quietBreathingSource).toMatch(/import \{ getMusicPreference, setMusicPreferenceForUser \} from '\.\.\/lib\/musicPreference';/);
  });

  it('InteractiveAmbientMusic.jsx\'s own active-view toggle also routes through the same shared helper (Build 18 - previously an inline duplicate of the same isGuest check)', () => {
    expect(playerSource).toMatch(/import \{ setMusicPreferenceForUser \} from '\.\.\/lib\/musicPreference';/);
    const body = playerSource.match(/const handleToggle = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setMusicPreferenceForUser\(false, \{ isGuest \}\);/);
    expect(body).toMatch(/setMusicPreferenceForUser\(true, \{ isGuest \}\);/);
  });

  it('the persisted preference\'s pre-start SEED for a returning authenticated user is untouched: still reads getMusicPreference() directly, guest still always seeded false', () => {
    for (const { source } of SURFACES) {
      expect(source).toMatch(/if \(isGuest\) return false;/);
      expect(source).toMatch(/return musicEligible && getMusicPreference\(\);/);
    }
  });
});

describe('4 & 5. Off -> Begin creates no audio instance; On -> Begin creates exactly one', () => {
  for (const { name, source } of SURFACES) {
    it(`${name}: the Begin handler's own start() call is gated ONLY on musicEligible && musicPreferenceOn - guest status no longer excludes it`, () => {
      const body = source.match(/const handleBegin\w* = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).not.toBe('');
      expect(body).toMatch(/if \(musicEligible && musicPreferenceOn\) \{\s*\n\s*musicPlayerRef\.current\?\.start\(\);\s*\n\s*\}/);
      expect(body).not.toMatch(/!isGuest/);
    });

    it(`${name}: InteractiveAmbientMusic is still mounted exactly once (never two mount points across the pre-start/active transition) - a guest starting music can never create a duplicate instance`, () => {
      const mountCount = (source.match(/<InteractiveAmbientMusic/g) ?? []).length;
      expect(mountCount).toBe(1);
    });

    it(`${name}: start() itself is guarded by isBusyRef for its whole async body (InteractiveAmbientMusic.jsx, shared by every surface) - a guest tapping Begin twice, or Begin then the active toggle, can never issue two overlapping start() calls`, () => {
      expect(playerSource).toMatch(/const start = async \(\) => \{\s*\n\s*if \(isBusyRef\.current\) return;\s*\n\s*isBusyRef\.current = true;/);
    });
  }

  it('QuietBreathing.jsx (standalone) Begin handler: same ungated condition', () => {
    const body = quietBreathingSource.match(/const handleBeginBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(musicEligible && musicPreferenceOn\) \{\s*\n\s*musicPlayerRef\.current\?\.start\(\);\s*\n\s*\}/);
    expect(body).not.toMatch(/!isGuest/);
  });
});

describe('6. Pre-start choice and active-view state remain consistent', () => {
  it('InteractiveAmbientMusic\'s own isChecked is driven purely by the real <audio> element\'s play/pause events (onPlay/onPause), never a separate guest-aware flag - the active toggle always reflects genuine playback state for every user identically', () => {
    expect(playerSource).toMatch(/const isChecked = musicEnabled && !suspended;/);
    expect(playerSource).toMatch(/onPlay=\{\(\) => \{\s*\n\s*setMusicEnabledState\(true\);/);
    expect(playerSource).toMatch(/onPause=\{\(\) => setMusicEnabledState\(false\)\}/);
  });

  for (const { name, source } of SURFACES) {
    it(`${name}: hideToggle={!hasBegun} still hands off from the pre-start switch to the same single InteractiveAmbientMusic instance's own toggle the instant Begin is tapped - no separate/duplicate state to fall out of sync`, () => {
      expect(source).toMatch(/hideToggle=\{!hasBegun\}/);
    });
  }
});

describe('7. Timer/phase/movement state is unaffected by the music toggle', () => {
  for (const { name, source } of SURFACES) {
    it(`${name}: handleToggleMusicPreference never touches the timer/phase state (setSecondsLeft/setBreatheState/setTimeLeft/setActiveStep/setSelectedMovements)`, () => {
      const body = source.match(/const handleToggleMusicPreference = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).not.toMatch(/setSecondsLeft|setBreatheState|setTimeLeft|setActiveStep|setSelectedMovements/);
    });
  }

  it('QuietBreathing.jsx (standalone): same isolation', () => {
    const body = quietBreathingSource.match(/const handleToggleMusicPreference = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/setSecondsLeft|setBreatheState/);
  });
});

describe('8. Morning, Evening, Anytime and standalone breathing styling remains exactly as delivered by the visual uplift phases', () => {
  it('Breathe.jsx and MorningFlow.jsx (Morning) still pass accent="morning" - untouched by this correction', () => {
    for (const source of [breatheSource, morningFlowSource]) {
      const callSite = source.match(/<MusicPreferenceToggle[\s\S]{0,300}\/>/)?.[0] ?? '';
      expect(callSite).toMatch(/accent="morning"/);
    }
  });

  it('EveningBreathing.jsx still passes accent="evening" - untouched by this correction', () => {
    const callSite = eveningBreathingSource.match(/<MusicPreferenceToggle[\s\S]{0,300}\/>/)?.[0] ?? '';
    expect(callSite).toMatch(/accent="evening"/);
  });

  it('QuietBreathing.jsx (Anytime/standalone) still passes no accent prop at all - stays the original peach', () => {
    const callSite = quietBreathingSource.match(/<MusicPreferenceToggle[\s\S]{0,300}\/>/)?.[0] ?? '';
    expect(callSite).not.toMatch(/accent=/);
  });

  it('the ACCENT_TOKENS map itself (primary/morning/evening) is completely unchanged by this correction', () => {
    expect(toggleSource).toMatch(/primary: \{ track: 'bg-primary', knobBorder: 'border-primary', focusRing: 'focus-visible:ring-primary' \}/);
    expect(toggleSource).toMatch(/morning: \{ track: 'bg-morning-accent', knobBorder: 'border-morning-accent', focusRing: 'focus-visible:ring-morning-accent' \}/);
    expect(toggleSource).toMatch(/evening: \{ track: 'bg-evening-accent', knobBorder: 'border-evening-accent', focusRing: 'focus-visible:ring-evening-accent' \}/);
  });
});

describe('9. Guided catalogue media remains fully protected - this correction touches only the interactive ambient-music controls', () => {
  it('Breathe.jsx and MorningFlow.jsx still gate every guided video through useProtectedVideo/SignInPromptDialog, completely untouched', () => {
    for (const source of [breatheSource, morningFlowSource]) {
      expect(source).toMatch(/import \{ useProtectedVideo \} from '\.\.\/hooks\/useProtectedVideo';/);
      expect(source).toMatch(/<SignInPromptDialog\s*\n\s*open=\{promptOpen\}/);
    }
  });

  it('QuietBreathing.jsx (standalone) still gates its own guided videos through the identical useProtectedVideo/SignInPromptDialog pattern', () => {
    expect(quietBreathingSource).toMatch(/import \{ useProtectedVideo \} from '\.\.\/hooks\/useProtectedVideo';/);
    expect(quietBreathingSource).toMatch(/<SignInPromptDialog\s*\n\s*open=\{promptOpen\}/);
  });

  it('EveningBreathing.jsx has no guided-video rows at all (unaffected either way) - confirmSignInForMusic is now fully removed from real code (Build 18 part 2: ExercisePausedPanel no longer needs it either; only this file\'s own doc comment still mentions the removed name in prose)', () => {
    expect(eveningBreathingSource).not.toMatch(/useProtectedVideo|BetaVideoModal/);
    const codeOnly = eveningBreathingSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/confirmSignInForMusic/);
  });

  it('QuietBreathing.jsx non-standalone (Support): MusicEntryChoice is now fixed too (Build 18 part 2) - see musicEntryChoice.test.js for full dedicated coverage', () => {
    const nonStandaloneReturn = quietBreathingSource.slice(quietBreathingSource.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(nonStandaloneReturn).toMatch(/<MusicEntryChoice\s*\n\s*onStartWithMusic=\{handleStartWithMusic\}\s*\n\s*onContinueWithoutMusic=\{handleContinueWithoutMusic\}\s*\n\s*\/>/);
  });
});
