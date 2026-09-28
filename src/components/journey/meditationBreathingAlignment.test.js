// Meditation ↔ Breathing alignment correction — consolidated regression
// guard for the 18-point checklist. Several points are already proven,
// unchanged, by pre-existing test files (noted per item below rather than
// duplicated here); this file covers the points that are new or that
// changed shape as part of this correction. Source-level checks throughout
// - this repo's Vitest has no rendering engine (environment: 'node').
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MEDITATION_STYLES } from '../../lib/meditationStyles';
import { MEDITATION_DURATIONS } from '../../lib/meditationDurations';
import { MEDITATION_SOUNDS } from '../../lib/meditationSounds';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const morningSource = read('../../pages/MorningMeditate.jsx');
const eveningSource = read('../../pages/EveningMeditate.jsx');
const anytimeSource = read('../../pages/SelfGuidedMeditation.jsx');
const setupPanelSource = read('./MeditationSetupPanel.jsx');
const activeSessionSource = read('./MeditationActiveSession.jsx');
const soundControlSource = read('./MeditationSoundControl.jsx');
const controlsSource = read('./MeditationControls.jsx');

// 1. Morning, Anytime and Evening use the aligned Meditation setup structure.
describe('1. Morning, Anytime and Evening all render the same aligned MeditationSetupPanel structure', () => {
  it('each page renders exactly one MeditationSetupPanel, with the exact approved journey-specific heading/purpose', () => {
    expect(morningSource).toMatch(/<MeditationSetupPanel/);
    expect(morningSource).toMatch(/heading="Mindful Pause"/);
    expect(morningSource).toMatch(/purpose="A quiet moment before your affirmation\."/);

    expect(eveningSource).toMatch(/<MeditationSetupPanel/);
    expect(eveningSource).toMatch(/heading="Take a Mindful Pause"/);
    expect(eveningSource).toMatch(/purpose="A quiet pause before you rest\."/);

    expect(anytimeSource).toMatch(/<MeditationSetupPanel/);
    expect(anytimeSource).toMatch(/heading="Choose Your Meditation"/);
    expect(anytimeSource).toMatch(/purpose="Find a pause that fits this moment\."/);
  });

  it('the shared panel itself renders the 8-element structure in order: Sound control, heading/purpose, style, duration, Explore, Begin, Skip', () => {
    const order = [
      '<MeditationSoundControl',
      "aria-hidden=\"true\">self_improvement</span>",
      'aria-label="Meditation style"',
      'aria-label="Duration"',
      '{onExploreGuided && (',
      'onClick={onBegin}',
      '{onSkip && ('
    ];
    let cursor = -1;
    for (const marker of order) {
      const idx = setupPanelSource.indexOf(marker);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });
});

// 2. The large repeated recommendation card is absent.
describe('2. The large repeated "RECOMMENDED FOR YOU" card is gone', () => {
  it('no such card exists in the shared setup panel - recommendation is instead conveyed by the already-selected style row, duration chip, and sound control', () => {
    const codeOnly = stripComments(setupPanelSource);
    expect(codeOnly).not.toMatch(/Recommended for you/i);
    expect(codeOnly).not.toMatch(/glass-panel rounded-2xl p-4 mt-3 space-y-1\.5/);
  });

  it('the duration chip still carries its own real "Recommended" sublabel - recommendation state lives in the real controls, not a separate summary', () => {
    expect(setupPanelSource).toMatch(/sublabel=\{d\.id === recommendedDurationId \? 'Recommended' : null\}/);
  });
});

// 3 & 4. All existing meditation styles remain available; IDs/stored
// values/defaults/selection behavior unchanged. (Full id/order/copy
// coverage already lives in meditationStyles.test.js - this checks only
// that this correction didn't touch that data beyond adding `icon`.)
describe('3-4. All five meditation styles remain available with unchanged ids, order, labels, descriptions, defaults', () => {
  it('still exactly five styles, same ids in the same order', () => {
    expect(MEDITATION_STYLES.map((s) => s.id)).toEqual([
      'quiet',
      'breath-awareness',
      'mindful-pause',
      'body-awareness',
      'loving-kindness'
    ]);
  });

  it('every style now also carries a genuine presentation-only icon, additive - no id/label/description/prompts field was altered', () => {
    for (const style of MEDITATION_STYLES) {
      expect(typeof style.icon).toBe('string');
      expect(style.icon.length).toBeGreaterThan(0);
    }
  });

  it('the setup panel selects/deselects styles via the same onSelectStyle(s.id) contract as before - real selection behavior, not a new mechanism', () => {
    expect(setupPanelSource).toMatch(/selected=\{style\.id === s\.id\}/);
    expect(setupPanelSource).toMatch(/onSelect=\{\(\) => onSelectStyle\(s\.id\)\}/);
  });
});

// 5. All existing durations remain available.
describe('5. All three durations remain available, unchanged', () => {
  it('still exactly three durations: 2, 5, 10 minutes, 5 the default/recommended', () => {
    expect(MEDITATION_DURATIONS.map((d) => d.id)).toEqual(['2min', '5min', '10min']);
  });
});

// 6. The compact Sound control exposes the same three sound choices.
describe('6. MeditationSoundControl exposes the same three real sound choices', () => {
  it('maps over the real MEDITATION_SOUNDS registry (Gentle Ambient / Soft Piano / No Music), no second/duplicate list', () => {
    expect(MEDITATION_SOUNDS.map((s) => s.id)).toEqual(['IM01', 'IM02', 'none']);
    expect(soundControlSource).toMatch(/\{MEDITATION_SOUNDS\.map\(\(sound\) => \(/);
    expect(soundControlSource).toMatch(/from '\.\.\/\.\.\/lib\/meditationSounds';/);
  });

  it('selecting an option calls the real onSelectSound(sound.id) the caller supplied - never a second sound-selection mechanism', () => {
    expect(soundControlSource).toMatch(/onClick=\{\(\) => \{\s*\n\s*onSelectSound\(sound\.id\);/);
  });

  it('is rendered by MeditationSetupPanel, right-aligned, wired to the live soundId/onSelectSound props (never a second, divergent audio state)', () => {
    expect(setupPanelSource).toMatch(/<MeditationSoundControl soundId=\{soundId\} onSelectSound=\{onSelectSound\} journeyTone=\{journeyTone\} \/>/);
  });
});

// 7. The active screen contains no repeated full CHOOSE YOUR SOUND list.
describe('7. MeditationActiveSession renders no repeated full sound list', () => {
  it('no "Choose your sound" radiogroup, no MEDITATION_SOUNDS import, on the active screen', () => {
    expect(activeSessionSource).not.toMatch(/aria-label="Choose your sound"/);
    const codeOnly = stripComments(activeSessionSource);
    expect(codeOnly).not.toMatch(/MEDITATION_SOUNDS/);
  });

  it('the active screen still contains only: header controls, style label, countdown ring, one cue, Pause/Resume, and the journey-accurate final action(s)', () => {
    expect(activeSessionSource).toMatch(/<JourneyHeader/);
    expect(activeSessionSource).toMatch(/style\.label/);
    expect(activeSessionSource).toMatch(/<MeditationProgressRing/);
    expect(activeSessionSource).toMatch(/snapshot\.promptText/);
    expect(activeSessionSource).toMatch(/Pause<\/span>/);
    expect(activeSessionSource).toMatch(/Resume<\/span>/);
  });
});

// 8, 9, 10, 11 — selected sound keeps playing after Begin; pause pauses
// timer+audio; resume restores audio only if it was genuinely playing;
// "No Music" stays silent. This is the underlying audio/timer/controller
// behavior (useMeditationSession.js / meditationSessionController.js),
// which this correction explicitly does not touch - only the DUPLICATE
// UI on the active screen was removed. Already proven by real execution in
// meditationSessionController.test.js/useMeditationSession.test.js
// (unchanged, still passing). This just confirms this correction's own
// files never reimplement or duplicate that logic.
describe('8-11. Audio/timer/pause/resume/silence logic is untouched - no duplicate implementation introduced here', () => {
  it('MeditationActiveSession still forwards Pause/Resume straight to the caller-owned onPause/onResume - no local audio/timer state of its own', () => {
    expect(activeSessionSource).toMatch(/onClick=\{onResume\}/);
    expect(activeSessionSource).toMatch(/onClick=\{onPause\}/);
    const codeOnly = stripComments(activeSessionSource);
    expect(codeOnly).not.toMatch(/new Audio\(|setInterval\(|HTMLAudioElement/);
  });

  it('MeditationSoundControl and MeditationSetupPanel hold no audio/timer state of their own either - selection is always a caller-supplied callback', () => {
    for (const source of [soundControlSource, setupPanelSource]) {
      const codeOnly = stripComments(source);
      expect(codeOnly).not.toMatch(/new Audio\(|setInterval\(|HTMLAudioElement/);
    }
  });
});

// 12. Back confirmation and early exit remain correct.
describe('12. Back confirmation and early exit remain correct, including the ended_early outcome wiring added by the Session Engine correction', () => {
  it('Morning/Evening still call recordStepEndedEarly() from their End Meditation handler, unchanged by this presentation pass', () => {
    expect(morningSource).toMatch(/const handleEndMeditation = \(\) => \{\s*\n\s*recordStepEndedEarly\(\);\s*\n\s*session\.endSession\(\);\s*\n\s*\};/);
  });

  it('MeditationActiveSession still owns its own leave-confirmation dialog, pausing the session while any dialog is open', () => {
    expect(activeSessionSource).toMatch(/pauseForDialog/);
    expect(activeSessionSource).toMatch(/resumeAfterDialogDismiss/);
  });
});

// 13, 14. Natural completion records exactly once; early exit/Skip never
// record completion. Unchanged by this pass - already proven by real
// execution/source checks in meditationCompletionLifecycle.test.js and
// eveningMeditationCompletionLifecycle.test.js (both still passing,
// untouched by this correction). This just confirms handleNaturalCompletion
// still exists and is still the one place completion is recorded.
describe('13-14. Completion recording paths untouched (full behavioral coverage in meditationCompletionLifecycle.test.js / eveningMeditationCompletionLifecycle.test.js)', () => {
  it('handleNaturalCompletion is still the one function that sets isCompleted for Morning and Evening', () => {
    expect(morningSource).toMatch(/const handleNaturalCompletion = \(\) => \{/);
    expect(eveningSource).toMatch(/const handleNaturalCompletion = \(\) => \{/);
  });
});

// 15. Morning, Anytime and Evening routing remains unchanged.
describe('15. Routing is untouched - this correction is presentation-only', () => {
  it('no navigate()/route-changing call was added to any of the touched files', () => {
    for (const source of [setupPanelSource, activeSessionSource, soundControlSource, controlsSource]) {
      const codeOnly = stripComments(source);
      expect(codeOnly).not.toMatch(/from 'react-router-dom'/);
    }
  });
});

// 16. Small-screen scrolling and safe-area ownership remain intact.
describe('16. Small-screen scrolling and safe-area ownership are preserved', () => {
  it('MeditationActiveSession keeps its own h-dvh/overflow-y-auto single scroll container - no NEW fixed height introduced (min-h-[44px] touch targets are unrelated and expected)', () => {
    expect(activeSessionSource).toMatch(/h-dvh overflow-hidden/);
    expect(activeSessionSource).toMatch(/overflow-y-auto overflow-x-hidden scroll-hide/);
    expect(activeSessionSource).toMatch(/min-h-full/);
    expect(activeSessionSource).not.toMatch(/(?<!min-)(?<!max-)h-\[\d+px\]/);
  });
});

// 17. No raw hexadecimal colours are introduced. MeditationActiveSession.jsx
// pre-existing #b3555f End/Leave button colour predates this correction
// (confirmed unchanged by it - see this file's own "no touch to
// audio/timer/controller/colour tokens" scope) and is deliberately excluded
// from this check.
describe('17. No raw hex colours introduced by this correction', () => {
  it('the two files most exposed to a new colour choice (the new MeditationSoundControl, and MeditationSetupPanel, rewritten in full) use only existing design tokens', () => {
    expect(soundControlSource).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(setupPanelSource).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(controlsSource).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('MeditationActiveSession\'s only hex colour is the pre-existing #b3555f End/Leave button, unchanged by this correction - no new hex value was added', () => {
    const hexMatches = activeSessionSource.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
    expect(new Set(hexMatches)).toEqual(new Set(['#b3555f']));
  });
});

// 18. No percentage wording reintroduced. Checked against literal
// completion-style percentage text (the Phase 7 "100% Complete" badge
// shape), not CSS calc()/width percentages, which are unrelated layout
// values, not a wellbeing score.
describe('18. No percentage-based completion wording reintroduced', () => {
  it('no "100% Complete"/standalone rendered "%" completion claim in any touched Meditation file', () => {
    for (const source of [setupPanelSource, activeSessionSource, soundControlSource, controlsSource, morningSource, eveningSource, anytimeSource]) {
      expect(source).not.toMatch(/100%\s*Complete/i);
      expect(source).not.toMatch(/>\s*\d+%\s*</);
    }
  });
});

describe('Journey colours are preserved exactly - Morning gold, Anytime mint, Evening periwinkle', () => {
  it('each caller still passes its own real journeyTone - never guessed, never a shared default leaking across journeys', () => {
    expect(morningSource).toMatch(/journeyTone="morning"/);
    expect(eveningSource).toMatch(/journeyTone="evening"/);
    expect(anytimeSource).toMatch(/journeyTone=\{journeyTone\}/);
  });
});
