// Source-level regression guard for MeditationActiveSession.jsx - the
// shared active-session screen extracted from SelfGuidedMeditation.jsx
// (Journey Embedding, Phase 2). Standalone's own exact copy is the
// component's default `endCopy`; Morning/Evening embedded callers override
// it (see MorningMeditate.test.js/EveningMeditate.test.js).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./MeditationActiveSession.jsx', import.meta.url)), 'utf-8');

describe('MeditationActiveSession — Back always routes through this component\'s own local leave-confirmation; Close does too UNLESS the caller provides onRequestClose', () => {
  it('JourneyHeader\'s onStepBack always opens the local confirm dialog directly (via handleOpenLeaveConfirm, which also pauses the session - see the dialog-pause describe block below) - never overridable', () => {
    const block = source.match(/<JourneyHeader[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/showBackButton=\{false\}/);
    expect(block).toMatch(/onStepBack=\{handleOpenLeaveConfirm\}/);
  });

  it('onClose falls back to the same local dialog only when the caller omits onRequestClose - a caller-provided onRequestClose bypasses the local dialog entirely (Morning\'s own separate "Leave this routine?" flow)', () => {
    const block = source.match(/<JourneyHeader[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/onClose=\{onRequestClose \?\? handleOpenLeaveConfirm\}/);
  });

  it('never navigates itself - onRequestLeave is only ever called from the confirm dialog\'s own onConfirm, after the caller decides what "leaving" means', () => {
    // Comments stripped first - this file's own doc comment legitimately
    // says "never calls navigate() itself" in prose.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/navigate\(/);
    expect(codeOnly).not.toMatch(/from 'react-router-dom'/);
    expect(source).toMatch(/const handleConfirmLeave = \(\) => \{\s*\n\s*setLeaveConfirmOpen\(false\);\s*\n\s*onRequestLeave\(\);\s*\n\s*\};/);
  });
  // "never calls leaveActiveRoutine/interruptSession itself" is covered by
  // the dedicated onRequestClose describe block below, which states the
  // reasoning precisely (only a caller-supplied onRequestClose can ever
  // reach a whole-journey exit - this file never defines one itself).
});

describe('MeditationActiveSession — showHeaderClose (additive; default true, standalone/Morning unaffected)', () => {
  it('defaults to true and is forwarded to JourneyHeader as showCloseButton - a caller that omits the prop (standalone, Morning) keeps rendering both Back and Close in this component\'s own header, byte-identical to before this fix', () => {
    expect(source).toMatch(/showHeaderClose = true/);
    expect(source).toMatch(/showCloseButton=\{showHeaderClose\}/);
  });
});

describe('MeditationActiveSession — onRequestClose (additive, optional; standalone and Evening both omit it)', () => {
  it('is destructured as a plain optional prop, no default value - undefined when the caller omits it', () => {
    const propsBlock = source.match(/export const MeditationActiveSession = \(\{[\s\S]*?\}\) => \{/)?.[0] ?? '';
    expect(propsBlock).toMatch(/onRequestClose,/);
    expect(propsBlock).not.toMatch(/onRequestClose = /);
  });

  it('onStepBack is unaffected by onRequestClose - it always opens the local dialog regardless', () => {
    const block = source.match(/<JourneyHeader[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/onStepBack=\{handleOpenLeaveConfirm\}/);
  });

  it('the big bottom button only falls back to the same local leave dialog when the caller omits onEndSession too (see the dedicated onEndSession describe block below for the split behaviour)', () => {
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).toMatch(/onClick=\{onEndSession \? handleOpenEndSessionConfirm : handleOpenLeaveConfirm\}\s*\n\s*aria-label=\{onEndSession \? endSessionActiveCopy\.buttonAriaLabel : copy\.buttonAriaLabel\}/);
  });

  it('End Meditation preserving only-meditation semantics: neither this component nor its local dialog ever calls leaveActiveRoutine/interruptSession - only onRequestClose (a caller-supplied function this file never defines) can reach a whole-journey exit', () => {
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/leaveActiveRoutine/);
    expect(codeOnly).not.toMatch(/interruptSession/);
  });
});

// Found live: the bottom "End Session" button and the header Back arrow
// were wired to the exact same state (leaveConfirmOpen) and the exact
// same confirm handler (onRequestLeave) - two visibly separate controls
// that were actually one control in two places. onEndSession gives a
// caller (standalone) a genuinely independent confirm dialog and confirm
// handler for the bottom button, with Back completely untouched.
describe('MeditationActiveSession — onEndSession (additive, optional; makes the bottom End Session button independent of Back)', () => {
  it('is destructured as a plain optional prop, defaulting to null - a caller that omits it keeps the bottom button wired to setLeaveConfirmOpen, byte-identical to before this fix', () => {
    const propsBlock = source.match(/export const MeditationActiveSession = \(\{[\s\S]*?\}\) => \{/)?.[0] ?? '';
    expect(propsBlock).toMatch(/onEndSession = null/);
  });

  it('has its own separate confirm-open state and confirm handler, never touching leaveConfirmOpen/onRequestLeave', () => {
    expect(source).toMatch(/const \[endSessionConfirmOpen, setEndSessionConfirmOpen\] = useState\(false\);/);
    expect(source).toMatch(/const handleConfirmEndSession = \(\) => \{\s*\n\s*setEndSessionConfirmOpen\(false\);\s*\n\s*onEndSession\(\);\s*\n\s*\};/);
  });

  it('uses endSessionActiveCopy (its own wording, distinct from Back\'s copy when endSessionCopy is supplied - F4) for its own dialog', () => {
    const dialogBlock = source.match(/\{onEndSession && \(\s*\n\s*<ConfirmDialog[\s\S]*?\/>\s*\n\s*\)\}/)?.[0] ?? '';
    expect(dialogBlock).toMatch(/open=\{endSessionConfirmOpen\}/);
    expect(dialogBlock).toMatch(/title=\{endSessionActiveCopy\.dialogTitle\}/);
    expect(dialogBlock).toMatch(/message=\{endSessionActiveCopy\.dialogMessage\}/);
    expect(dialogBlock).toMatch(/confirmLabel=\{endSessionActiveCopy\.confirmLabel\}/);
    expect(dialogBlock).toMatch(/cancelLabel=\{endSessionActiveCopy\.cancelLabel\}/);
    expect(dialogBlock).toMatch(/onConfirm=\{handleConfirmEndSession\}/);
  });

  // F4 (pre-Build-15 usability pass) — found live: Back's dialog and End
  // Session's own dialog still showed IDENTICAL wording even after the
  // controls became independently wired (both derived from `copy` alone),
  // with no signal that Back returns quietly to setup while End Session
  // shows a distinct "ended early" result. `endSessionCopy` lets a caller
  // give End Session its own wording; omitting it preserves the exact
  // prior shared-copy behaviour (backward compatible with any future
  // caller that only passes `onEndSession`).
  it('endSessionCopy (additive, optional, default null) lets a caller give End Session its own wording, independent of endCopy/Back - falling back to sharing `copy` when omitted', () => {
    const propsBlock = source.match(/export const MeditationActiveSession = \(\{[\s\S]*?\}\) => \{/)?.[0] ?? '';
    expect(propsBlock).toMatch(/endSessionCopy = null/);
    expect(source).toMatch(/const endSessionActiveCopy = endSessionCopy \? \{ \.\.\.DEFAULT_END_COPY, \.\.\.endSessionCopy \} : copy;/);
  });

  it('the bottom button\'s own label/aria-label use endSessionActiveCopy only when onEndSession is active, falling back to copy otherwise', () => {
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).toMatch(/aria-label=\{onEndSession \? endSessionActiveCopy\.buttonAriaLabel : copy\.buttonAriaLabel\}/);
    expect(codeOnly).toMatch(/\{onEndSession \? endSessionActiveCopy\.buttonLabel : copy\.buttonLabel\}/);
  });

  it('onStepBack/Back is completely untouched by this prop - still always opens the original leaveConfirmOpen dialog via onRequestLeave, regardless of whether onEndSession is provided', () => {
    const block = source.match(/<JourneyHeader[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/onStepBack=\{handleOpenLeaveConfirm\}/);
    expect(source).toMatch(/const handleConfirmLeave = \(\) => \{\s*\n\s*setLeaveConfirmOpen\(false\);\s*\n\s*onRequestLeave\(\);\s*\n\s*\};/);
  });
});

describe('MeditationActiveSession — default (standalone) leave-confirmation copy is byte-identical to the pre-extraction original', () => {
  it('default title, message and both action labels match exactly', () => {
    expect(source).toMatch(/buttonLabel: 'End Session'/);
    expect(source).toMatch(/buttonAriaLabel: 'End meditation session'/);
    expect(source).toMatch(/dialogTitle: 'Leave meditation\?'/);
    expect(source).toMatch(/dialogMessage: 'Your current meditation will end\.'/);
    expect(source).toMatch(/confirmLabel: 'End and Leave'/);
    expect(source).toMatch(/cancelLabel: 'Continue Meditation'/);
  });

  it('endCopy is an additive override (caller-supplied fields win, everything else falls back to the standalone default)', () => {
    expect(source).toMatch(/const copy = \{ \.\.\.DEFAULT_END_COPY, \.\.\.endCopy \};/);
  });

  it('uses the established mild-destructive severity, never the strong/red destructive one', () => {
    const block = source.match(/<ConfirmDialog[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/mildDestructive/);
    expect(block).not.toMatch(/\bdestructive\b(?!\s*=\s*\{false\})/);
  });
});

describe('MeditationActiveSession — End button uses quiet caution styling, not alarming bright red', () => {
  it('reuses the existing mild-destructive colour token (#b3555f, same as ConfirmDialog.jsx), never Tailwind red/bg-red', () => {
    const block = source.match(/aria-label=\{onEndSession \? endSessionActiveCopy\.buttonAriaLabel : copy\.buttonAriaLabel\}[\s\S]{0,20}className="([^"]+)"/)?.[1] ?? '';
    expect(block).toMatch(/#b3555f/);
    expect(block).not.toMatch(/bg-red/);
  });
});

describe('MeditationActiveSession — Meditation ↔ Breathing alignment correction: no repeated "Choose your sound" list on the active screen', () => {
  it('renders no sound radiogroup and never imports MEDITATION_SOUNDS/MeditationOptionRow - the choice was already made on the setup screen', () => {
    expect(source).not.toMatch(/role="radiogroup" aria-label="Choose your sound"/);
    expect(source).not.toMatch(/MEDITATION_SOUNDS/);
    expect(source).not.toMatch(/MeditationOptionRow/);
  });

  it('still accepts soundId/onSelectSound as props for backward-compatible caller wiring, even though they are no longer rendered here', () => {
    expect(source).toMatch(/soundId,/);
    expect(source).toMatch(/onSelectSound,/);
  });

  it('the unavailable-message container reserves its height unconditionally, so switching tracks never shifts the layout', () => {
    expect(source).toMatch(/min-h-\[1\.5em\]/);
  });
});

describe('MeditationActiveSession — content-driven spacing, no artificial justify-between gap (physical-iPhone finding)', () => {
  it('the outer container no longer relies on justify-between across the full-height column', () => {
    expect(source).not.toMatch(/flex flex-col justify-between/);
  });

  it('the style/ring/cue group is no longer forced to consume all leftover vertical space via flex-1/justify-center', () => {
    expect(source).not.toMatch(/flex-1 flex flex-col items-center justify-center gap-8/);
    expect(source).toMatch(/flex flex-col items-center gap-4 text-center/);
  });
});

describe('MeditationActiveSession — Pause/Resume reflect the live snapshot status, never a separately-tracked boolean', () => {
  it('branches on snapshot.status === \'paused\' to decide which single button renders', () => {
    expect(source).toMatch(/snapshot\.status === 'paused'/);
    expect(source).toMatch(/onClick=\{onResume\}/);
    expect(source).toMatch(/onClick=\{onPause\}/);
  });
});

describe('MeditationActiveSession — reduced motion passed straight through to the progress ring', () => {
  it('reducedMotion is forwarded to MeditationProgressRing, defaulting to false', () => {
    expect(source).toMatch(/reducedMotion = false/);
    expect(source).toMatch(/reducedMotion=\{reducedMotion\}/);
  });
});

describe('MeditationActiveSession — safe-area insets, matching this app\'s established pattern', () => {
  // Physical-iPhone correction (exercise-screen safe-area architecture) —
  // safe-area handling (env(safe-area-inset-*), the non-scrolling header,
  // the single scroll body) moved into the shared ExerciseScreenShell;
  // see exerciseScreenShellSafeArea.test.js for that component's own
  // dedicated coverage. This file now delegates to it instead of owning
  // an inline safe-area style block itself.
  it('renders the shared ExerciseScreenShell with its own dynamic journeyTone, instead of its own ad hoc h-dvh/safe-area wrapper', () => {
    expect(source).toMatch(/import \{ ExerciseScreenShell \} from '\.\/ExerciseScreenShell';/);
    expect(source).toMatch(/<ExerciseScreenShell\s*\n\s*journeyTone=\{journeyTone\}/);
    expect(source).not.toMatch(/paddingTop: 'calc\(1rem \+ env\(safe-area-inset-top\)\)'/);
  });

  it('passes bodyOverscrollBehaviorY="auto" (never the shell\'s own default \'contain\') - preserves the documented Evening scroll-chaining fix, since Morning/standalone have no outer scrollable ancestor to chain into anyway', () => {
    expect(source).toMatch(/bodyOverscrollBehaviorY="auto"/);
  });
});

// Meditation-dialog pause correction (Evening Breathing/Meditation
// completion pass) — the previously disclosed gap: none of this
// component's own four confirm dialogs paused the timer/audio while
// open. Fixed once, shared by every caller (standalone/Morning/Evening).
describe('MeditationActiveSession — every confirm dialog now genuinely pauses the session while open, and restores it correctly on dismiss (shared fix, previously disclosed gap)', () => {
  it('pauseForDialog captures whether the session was genuinely running (never a manually-paused one) and calls the real onPause - reconcileAudio (meditationSessionController.js) stops the actual audio, not just the elapsed-time counter', () => {
    const fn = source.match(/const pauseForDialog = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/wasPlayingBeforeDialogRef\.current = snapshot\.status !== 'paused';/);
    expect(fn).toMatch(/if \(wasPlayingBeforeDialogRef\.current\) onPause\(\);/);
  });

  it('resumeAfterDialogDismiss only calls onResume when the session was captured as genuinely playing - a session the user had already manually paused before opening a dialog is never surprise-resumed', () => {
    const fn = source.match(/const resumeAfterDialogDismiss = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/if \(wasPlayingBeforeDialogRef\.current\) \{/);
    expect(fn).toMatch(/onResume\(\);/);
  });

  it('all four open-handlers pause before opening, and no-op if their own dialog is already open (repeated taps can never pause twice or open a duplicate dialog)', () => {
    for (const name of ['handleOpenLeaveConfirm', 'handleOpenEndSessionConfirm', 'handleOpenBottomActionConfirm', 'handleOpenChooseAnotherConfirm']) {
      const fn = source.match(new RegExp(`const ${name} = \\(\\) => \\{[\\s\\S]*?\\n {2}\\};`))?.[0] ?? '';
      expect(fn, `${name} should exist`).not.toBe('');
      expect(fn).toMatch(/if \([a-zA-Z]+ConfirmOpen\) return;/);
      expect(fn).toMatch(/pauseForDialog\(\);/);
    }
  });

  it('all four dialogs\' onDismiss now resumes (via the matching dismiss-handler) instead of only closing the dialog - onConfirm is untouched (every confirm path ends or leaves the session anyway, so there is nothing to resume)', () => {
    expect(source).toMatch(/onDismiss=\{handleDismissLeaveConfirm\}/);
    expect(source).toMatch(/onDismiss=\{handleDismissBottomActionConfirm\}/);
    expect(source).toMatch(/onDismiss=\{handleDismissEndSessionConfirm\}/);
    expect(source).toMatch(/onDismiss=\{handleDismissChooseAnotherConfirm\}/);
    // Confirm handlers still byte-identical to before this fix.
    expect(source).toMatch(/const handleConfirmLeave = \(\) => \{\s*\n\s*setLeaveConfirmOpen\(false\);\s*\n\s*onRequestLeave\(\);\s*\n\s*\};/);
    expect(source).toMatch(/const handleConfirmBottomAction = \(\) => \{\s*\n\s*setBottomActionConfirmOpen\(false\);\s*\n\s*bottomAction\?\.onConfirm\(\);\s*\n\s*\};/);
    expect(source).toMatch(/const handleConfirmEndSession = \(\) => \{\s*\n\s*setEndSessionConfirmOpen\(false\);\s*\n\s*onEndSession\(\);\s*\n\s*\};/);
    expect(source).toMatch(/const handleConfirmChooseAnother = \(\) => \{\s*\n\s*setChooseAnotherConfirmOpen\(false\);\s*\n\s*onChooseAnother\(\);\s*\n\s*\};/);
    for (const dismissFn of ['handleDismissLeaveConfirm', 'handleDismissBottomActionConfirm', 'handleDismissEndSessionConfirm', 'handleDismissChooseAnotherConfirm']) {
      const fn = source.match(new RegExp(`const ${dismissFn} = \\(\\) => \\{[\\s\\S]*?\\n {2}\\};`))?.[0] ?? '';
      expect(fn, `${dismissFn} should exist`).not.toBe('');
      expect(fn).toMatch(/resumeAfterDialogDismiss\(\);/);
    }
  });
});
