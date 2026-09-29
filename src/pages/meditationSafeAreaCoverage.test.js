// Physical-iPhone correction — consolidated safe-area/header/scroll
// coverage for every rendered state of Morning, Anytime and Evening
// Meditation (setup, preparation countdown, active session, completed,
// ended-early). Source-level checks (this repo's established pattern for
// files with a Supabase-client import chain - no DOM rendering available;
// see backButtonSafeAreaCorrection.test.js's own identical justification).
//
// Every state must have exactly one protected, non-scrolling, opaque
// header and exactly one scrolling content body beneath it - never a
// second, nested full-viewport-height shell competing with it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const morningMeditateSource = read('./MorningMeditate.jsx');
const selfGuidedMeditationSource = read('./SelfGuidedMeditation.jsx');
const eveningMeditateSource = read('./EveningMeditate.jsx');
const meditationActiveSessionSource = read('../components/journey/MeditationActiveSession.jsx');
const exerciseScreenShellSource = read('../components/journey/ExerciseScreenShell.jsx');
const eveningSceneShellSource = read('../components/evening/EveningSceneShell.jsx');

describe('MeditationActiveSession.jsx — the one shared active-session screen for all three journeys', () => {
  it('renders the shared ExerciseScreenShell (its own single viewport/scroll owner) - never a second, bespoke h-dvh wrapper', () => {
    expect(meditationActiveSessionSource).toMatch(/import \{ ExerciseScreenShell \} from '\.\/ExerciseScreenShell';/);
    expect(meditationActiveSessionSource).toMatch(/<ExerciseScreenShell/);
    expect(meditationActiveSessionSource).not.toMatch(/className="h-dvh overflow-hidden"/);
  });

  it('receives a dynamic journeyTone (morning/anytime/evening, whichever caller mounted it) - never a hardcoded tone', () => {
    expect(meditationActiveSessionSource).toMatch(/<ExerciseScreenShell\s*\n\s*journeyTone=\{journeyTone\}/);
  });
});

describe('ExerciseScreenShell.jsx — the shared shell architecture every Meditation state (except Evening\'s active session) renders directly', () => {
  it('is a real fixed-viewport flex column with exactly one shrink-0 header and one flex-1 min-h-0 overflow-y-auto body - never two competing viewport owners', () => {
    expect(exerciseScreenShellSource).toMatch(/className="h-dvh overflow-hidden flex flex-col"/);
    expect(exerciseScreenShellSource).toMatch(/shrink-0 bg-background border-b/);
    expect(exerciseScreenShellSource).toMatch(/flex-1 min-h-0 overflow-y-auto/);
  });
});

describe('Morning Meditation — every rendered state uses the shared ExerciseScreenShell, journeyTone="morning"', () => {
  it('imports ExerciseScreenShell exactly once', () => {
    const importMatches = morningMeditateSource.match(/import \{ ExerciseScreenShell \} from '\.\.\/components\/journey\/ExerciseScreenShell';/g) ?? [];
    expect(importMatches.length).toBe(1);
  });

  it('countdown, completed and setup states each render <ExerciseScreenShell journeyTone="morning" - 3 occurrences (active delegates to the shared MeditationActiveSession, covered above)', () => {
    const occurrences = morningMeditateSource.match(/<ExerciseScreenShell\s*\n\s*journeyTone="morning"/g) ?? [];
    expect(occurrences.length).toBe(3);
  });

  it('no state still uses the old min-h-[85vh]/bare h-dvh ad hoc wrapper', () => {
    expect(morningMeditateSource).not.toMatch(/className="min-h-\[85vh\]/);
    expect(morningMeditateSource).not.toMatch(/className="h-dvh overflow-hidden"/);
  });

  it('active session (MeditationActiveSession) still preserves Back/Close/Skip/pause/completion routing exactly - onRequestLeave, onRequestClose, bottomAction and onChooseAnother wiring are all unchanged by the shell migration', () => {
    expect(morningMeditateSource).toMatch(/onRequestLeave=\{handleEndMeditation\}/);
    expect(morningMeditateSource).toMatch(/onRequestClose=\{handleRequestExitRoutine\}/);
    expect(morningMeditateSource).toMatch(/onConfirm: handleFinishAndContinue/);
    expect(morningMeditateSource).toMatch(/onChooseAnother=\{handleChooseAnother\}/);
  });
});

describe('Anytime Meditation (SelfGuidedMeditation.jsx) — every rendered state uses the shared ExerciseScreenShell, dynamic journeyTone', () => {
  it('imports ExerciseScreenShell exactly once', () => {
    const importMatches = selfGuidedMeditationSource.match(/import \{ ExerciseScreenShell \} from '\.\.\/components\/journey\/ExerciseScreenShell';/g) ?? [];
    expect(importMatches.length).toBe(1);
  });

  it('countdown, earlyEnded and setup states each render <ExerciseScreenShell journeyTone={journeyTone} - 3 occurrences (active delegates to the shared MeditationActiveSession, covered above)', () => {
    const occurrences = selfGuidedMeditationSource.match(/<ExerciseScreenShell[^>]*journeyTone=\{journeyTone\}/g) ?? [];
    expect(occurrences.length).toBe(3);
  });

  it('no state still uses the old bare h-dvh ad hoc wrapper', () => {
    expect(selfGuidedMeditationSource).not.toMatch(/className="h-dvh overflow-hidden"/);
  });

  it('Back/Close/End Session/Meditate Again routing is unchanged by the shell migration', () => {
    expect(selfGuidedMeditationSource).toMatch(/onRequestLeave=\{performLeave\}/);
    expect(selfGuidedMeditationSource).toMatch(/onRequestClose=\{handleRequestClose\}/);
    expect(selfGuidedMeditationSource).toMatch(/onEndSession=\{performEndSession\}/);
    expect(selfGuidedMeditationSource).toMatch(/onClick=\{handleMeditateAgainFromEarlyEnd\}/);
  });
});

describe('Evening Meditation (EveningMeditate.jsx) — countdown/completed/setup opt into EveningSceneShell\'s protectedHeader; active resolves the nested-shell issue structurally', () => {
  it('countdown, completed and setup states each pass protectedHeader to EveningSceneShell - 3 occurrences', () => {
    // Comments stripped first (this suite's established convention) - an
    // arrow function prop (onBeforeLeave={() => {...}}) inside the
    // countdown branch's own multi-line tag contains a literal ">",
    // so a naive [^>]* scan from "<EveningSceneShell" can truncate before
    // reaching "protectedHeader" on that one branch - counting the
    // code-only occurrences of the bare prop instead sidesteps that.
    const codeOnly = eveningMeditateSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const occurrences = codeOnly.match(/\sprotectedHeader[\s>]/g) ?? [];
    expect(occurrences.length).toBe(3);
  });

  it('the active session never wraps MeditationActiveSession in EveningSceneShell - exactly one viewport owner (MeditationActiveSession\'s own ExerciseScreenShell), never two nested full-height shells', () => {
    const activeBlock = eveningMeditateSource.match(/if \(session\.phase === 'active' && session\.snapshot\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(activeBlock).not.toBe('');
    expect(activeBlock).not.toMatch(/<EveningSceneShell/);
    expect(activeBlock).toMatch(/<MeditationActiveSession/);
  });

  it('the active session still shows the moonlight atmosphere (decorative, non-scrolling, reproduced directly) and the whole-journey Exit still uses the exact same leaveActiveRoutine() mechanism/copy as every other Evening screen', () => {
    const activeBlock = eveningMeditateSource.match(/if \(session\.phase === 'active' && session\.snapshot\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(activeBlock).toMatch(/<AtmosphereManager phase="moonlight"/);
    expect(eveningMeditateSource).toMatch(/leaveActiveRoutine\(\);/);
    expect(eveningMeditateSource).toMatch(/title="Leave Evening Wind-Down\?"/);
  });

  it('Back/End Meditation/Finish & continue/Choose another routing is unchanged by the structural fix', () => {
    const activeBlock = eveningMeditateSource.match(/if \(session\.phase === 'active' && session\.snapshot\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(activeBlock).toMatch(/onRequestLeave=\{handleEndMeditation\}/);
    expect(activeBlock).toMatch(/onConfirm: handleFinishAndContinue/);
    expect(activeBlock).toMatch(/onChooseAnother=\{handleChooseAnother\}/);
  });
});

describe('No new colour introduced by the meditation safe-area migration - every changed file still resolves to existing morning/evening/tertiary tokens', () => {
  // MeditationActiveSession.jsx's own #b3555f End/Leave button colour
  // predates this correction (confirmed unchanged by it - same exclusion
  // meditationBreathingAlignment.test.js's own "17. No raw hex colours"
  // section already documents) and is deliberately excluded here too.
  it('no raw hex literal in any of the migrated meditation files or the shared shells', () => {
    for (const source of [morningMeditateSource, selfGuidedMeditationSource, eveningMeditateSource, exerciseScreenShellSource, eveningSceneShellSource]) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });
});
