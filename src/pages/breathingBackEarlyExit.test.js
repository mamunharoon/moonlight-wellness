// Morning breathing Back/early-exit correction — pressing the top Back
// button during an active Morning breathing exercise previously reset
// the timer, animation, and music IMMEDIATELY with zero confirmation
// (found live on a physical iPhone). Fix: Back now opens a mild-warning
// "Leave this breathing exercise?" dialog; the timer/animation/music all
// genuinely PAUSE (via backConfirmOpen gating the same interval-
// management effect and InteractiveAmbientMusic's own `suspended` prop
// that isConfirming/isCompleted already use) while it is open, never
// reset. "Keep Breathing" resumes from the exact remaining time and
// restores music only if it was genuinely playing before. "Leave
// Exercise" is the one confirmed early-exit path (leaveExercise) - it
// records nothing, never calls the Session Engine completion mirror, and
// shows one short, stable, non-celebratory Morning message on the
// pre-start screen. Source-level regression guard (no DOM rendering
// available in this repo's Vitest - see embeddedBreathingContinueLock
// .test.js's own note); breathingSession.js's own tick()/end() idempotency
// is proven with real execution in breathingSession.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./Breathe.jsx');

describe('Back pauses an active session (never resets it) while the confirmation is open', () => {
  it('backConfirmOpen gates the interval-management effect - the exact same guard isConfirming/isCompleted already use, so the timer stops the instant the dialog opens', () => {
    expect(source).toMatch(/if \(!hasBegun \|\| isInterrupted \|\| isRepeatGated \|\| isConfirming \|\| isCompleted \|\| backConfirmOpen\) return;/);
    expect(source).toMatch(/\}, \[hasBegun, isInterrupted, isRepeatGated, isConfirming, isCompleted, backConfirmOpen\]\);/);
  });

  it('backConfirmOpen also suspends (pauses, never stops/destroys) the music and hides the now-irrelevant toggle', () => {
    expect(source).toMatch(/suspended=\{hasBegun \? \(isCompleted \|\| Boolean\(openVideo\) \|\| manuallyPaused \|\| backConfirmOpen\) : false\}/);
  });

  it('handleBackFromActive never resets secondsLeft/breatheState/sessionRef - only captures the pre-dialog music state and opens the dialog', () => {
    const fn = source.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toBe('');
    expect(fn).not.toMatch(/setSecondsLeft|setBreatheState|sessionRef\.current = null|stopBreathingInterval/);
    expect(fn).toMatch(/wasMusicPlayingRef\.current = musicPlayerRef\.current\?\.isPlaying\(\) \?\? false;/);
    expect(fn).toMatch(/setBackConfirmOpen\(true\);/);
  });
});

describe('The confirmation dialog itself - mild warning, exact required copy, correct handlers', () => {
  const dialogBlock = source.match(/<ConfirmDialog\s*\n\s*open=\{backConfirmOpen\}[\s\S]*?\/>/)?.[0] ?? '';

  it('exists with the exact required title/message', () => {
    expect(dialogBlock).not.toBe('');
    expect(dialogBlock).toMatch(/title="Leave this breathing exercise\?"/);
    expect(dialogBlock).toMatch(/message="Your progress in this exercise won.t be completed\."/);
  });

  it('is mildDestructive (temporary, resumable progress lost - not saved history erased), matching every other "exit an active session" dialog in this app', () => {
    expect(dialogBlock).toMatch(/mildDestructive/);
  });

  it('Keep Breathing is the cancel/dismiss action; Leave Exercise is the confirm action', () => {
    expect(dialogBlock).toMatch(/cancelLabel="Keep Breathing"/);
    expect(dialogBlock).toMatch(/confirmLabel="Leave Exercise"/);
    expect(dialogBlock).toMatch(/onConfirm=\{leaveExercise\}/);
    expect(dialogBlock).toMatch(/onDismiss=\{keepBreathing\}/);
  });
});

describe('Keep Breathing resumes the exact remaining time and restores prior music state correctly', () => {
  it('keepBreathing only closes the dialog and conditionally restarts music - never touches secondsLeft/breatheState/sessionRef, so resuming continues from the exact remaining time (nothing was ever reset)', () => {
    const fn = source.match(/const keepBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toBe('');
    expect(fn).toMatch(/setBackConfirmOpen\(false\);/);
    expect(fn).not.toMatch(/setSecondsLeft|setBreatheState|sessionRef|setHasBegun/);
  });

  it('music is restored ONLY if it was genuinely playing before the dialog opened (wasMusicPlayingRef), never unconditionally - and the flag is consumed (reset to false) so a later unrelated pause/resume never wrongly restarts it', () => {
    const fn = source.match(/const keepBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/if \(wasMusicPlayingRef\.current\) \{\s*\n\s*wasMusicPlayingRef\.current = false;\s*\n\s*musicPlayerRef\.current\?\.start\(\);\s*\n\s*\}/);
  });
});

describe('Leave Exercise stops the timer and music, and is not recorded as completion', () => {
  const fn = source.match(/const leaveExercise = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

  it('exists and fully tears down the interval/session/music', () => {
    expect(fn).not.toBe('');
    expect(fn).toMatch(/stopBreathingInterval\(\);/);
    expect(fn).toMatch(/sessionRef\.current\?\.end\(\);/);
    expect(fn).toMatch(/sessionRef\.current = null;/);
    expect(fn).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
  });

  it('never sets isCompleted true and never calls the Session Engine completion mirror (mirrorBreathingExitRef) - an early exit can never be recorded as completion', () => {
    expect(fn).not.toMatch(/setIsCompleted\(true\)/);
    expect(fn).not.toMatch(/mirrorBreathingExitRef|advanceStep/);
    expect(fn).toMatch(/setIsCompleted\(false\);/);
  });

  it('resets the double-tap guard and interruption flags too, so a later fresh Begin is never blocked or contaminated by the exited session', () => {
    expect(fn).toMatch(/hasBegunOnceRef\.current = false;/);
    expect(fn).toMatch(/setVideoOpenedDuringExercise\(false\);/);
    expect(fn).toMatch(/setManuallyPaused\(false\);/);
    expect(fn).toMatch(/wasMusicPlayingRef\.current = false;/);
  });

  it('returns to the pre-start/selection screen (setHasBegun(false)) and closes the dialog', () => {
    expect(fn).toMatch(/setBackConfirmOpen\(false\);/);
    expect(fn).toMatch(/setHasBegun\(false\);/);
  });
});

describe('A supportive Morning message appears on the selection screen and remains stable', () => {
  it('leaveExercise picks the message exactly once via getMorningBreathingEarlyExitMessage, held in earlyExitMessage state - never recomputed on re-render', () => {
    const fn = source.match(/const leaveExercise = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/setEarlyExitMessage\(getMorningBreathingEarlyExitMessage\(\)\);/);
    expect(source).toMatch(/const \[earlyExitMessage, setEarlyExitMessage\] = useState\(null\);/);
  });

  it('is rendered on the pre-start screen as a plain, non-blocking status line - never a modal, never disabling any control near it', () => {
    expect(source).toMatch(/\{earlyExitMessage && \(\s*\n\s*<p className="[^"]*" role="status">\s*\n\s*\{earlyExitMessage\}/);
    expect(source).not.toMatch(/earlyExitMessage[\s\S]{0,40}disabled/);
  });

  it('never uses completion language, a checkmark, or the natural-completion greeting pool - genuinely distinct from getBreathingCompletionGreeting', () => {
    const fn = source.match(/const leaveExercise = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toMatch(/getBreathingCompletionGreeting|Exercise Completed|check_circle/);
  });
});

describe('The supportive message never blocks the user - every control remains immediately usable', () => {
  it('Begin Breathing, the pattern grid, Skip, and Exit routine are all still rendered in the same pre-start branch as the message, none disabled by it', () => {
    expect(source).toMatch(/onClick=\{handleBeginBreathing\}/);
    expect(source).toMatch(/onClick=\{handleSkip\}/);
    expect(source).toMatch(/onClick=\{handleExitRoutine\}/);
  });
});

describe('Repeated Back taps never create duplicate dialogs, duplicate cleanup, or clobber the captured music state', () => {
  it('handleBackFromActive returns early (a no-op) if the dialog is already open, before ever re-capturing wasMusicPlayingRef or re-opening it', () => {
    const fn = source.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const guardIndex = fn.indexOf('if (backConfirmOpen) return false;');
    const captureIndex = fn.indexOf('wasMusicPlayingRef.current = musicPlayerRef.current?.isPlaying()');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(captureIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(captureIndex);
  });
});

describe('Leaving after completing must not change the completed outcome to ended_early', () => {
  it('handleBackFromActive returns (ordinary navigation) immediately if isCompleted, before ever touching backConfirmOpen or the early-exit path - checked before the duplicate-dialog guard too', () => {
    const fn = source.match(/const handleBackFromActive = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const completedGuardIndex = fn.indexOf('if (isCompleted) return;');
    const backConfirmGuardIndex = fn.indexOf('if (backConfirmOpen) return false;');
    expect(completedGuardIndex).toBeGreaterThan(-1);
    expect(backConfirmGuardIndex).toBeGreaterThan(completedGuardIndex);
  });
});

describe('Starting another pattern after early exit creates a fresh session', () => {
  it('countdown.onComplete (the one true "start a fresh session" entry point) is unaffected by this fix - still always creates a brand new controller for whichever pattern is currently selected', () => {
    const countdownBlock = source.match(/const countdown = usePreparationCountdown\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(countdownBlock).toMatch(/sessionRef\.current = createBreathingSession\(\{ pattern: activePattern, resolveBreathPhase \}\);/);
    expect(countdownBlock).toMatch(/sessionRef\.current\.begin\(\);/);
  });
});

describe('Component unmount/navigation still stops the timer and music with no false completion', () => {
  it('the existing unmount-cleanup effect is unaffected by this fix', () => {
    expect(source).toMatch(/useEffect\(\(\) => \(\) => stopBreathingInterval\(\), \[\]\);/);
  });
});

describe('Natural completion remains unchanged by this fix', () => {
  it('the completion-detecting interval callback (stop, music-stop, greeting, isCompleted) is untouched - Back/early-exit is a genuinely separate path', () => {
    const callbackBody = source.match(/intervalRef\.current = setInterval\(\(\) => \{([\s\S]*?)\n\s*\}, 1000\);/)?.[1] ?? '';
    expect(callbackBody).toMatch(/if \(completed\) \{/);
    const completedBranch = callbackBody.match(/if \(completed\) \{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
    expect(completedBranch).toMatch(/stopBreathingInterval\(\);/);
    expect(completedBranch).toMatch(/musicPlayerRef\.current\?\.stop\(\);/);
    expect(completedBranch).toMatch(/setCompletionGreeting\(getBreathingCompletionGreeting\('morning'\)\);/);
    expect(completedBranch).toMatch(/setIsCompleted\(true\);/);
  });
});

describe('Pause button remains a genuinely separate, non-early-exit path', () => {
  it('handlePauseExercise never touches backConfirmOpen/earlyExitMessage - the existing paused panel is unaffected by this fix', () => {
    const fn = source.match(/const handlePauseExercise = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).not.toMatch(/backConfirmOpen|earlyExitMessage/);
  });
});
