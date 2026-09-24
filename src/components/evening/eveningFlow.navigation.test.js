// Regression guard for the Evening Wind-down flow's back/exit
// navigation. No DOM/component rendering is available in this repo's
// Vitest (see index.css.test.js's own note), so this locks in the source
// wiring: every step passes showBack with a backFallback that actually
// chains to the step before it (the router history itself is what makes
// "back" return to the previous step in the real app - see
// BackButton.jsx's goBack() - this only confirms the fallback used when
// no history exists, e.g. a direct URL visit, still points somewhere
// sane).
//
// Build 15 Evening UX correction — Back and Exit now have two distinct
// meanings (see BackButton.jsx/EveningSceneShell.jsx/
// ExitEveningButton.jsx's own doc comments): Back is always a plain,
// confirmation-free navigate() to the previous question/stage; Exit/X is
// the one dedicated control that interrupts the active journey and
// returns Home, with its own confirmation. This file now covers both.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const shellSource = read('./EveningSceneShell.jsx');
const exitButtonSource = read('./ExitEveningButton.jsx');
const backButtonSource = read('../BackButton.jsx');
const windDownSource = read('../../pages/EveningWindDown.jsx');
const reflectionSource = read('../../pages/Reflection.jsx');
const gratitudeSource = read('../../pages/Gratitude.jsx');
const breathingSource = read('../../pages/EveningBreathing.jsx');
// Journey Embedding — the new optional step, now the real immediately-
// preceding step for Prepare for Rest (Breathing -> Meditate -> Prepare
// for Rest).
const meditateSource = read('../../pages/EveningMeditate.jsx');
const prepareSource = read('../../pages/PrepareForRest.jsx');
const completeSource = read('../../pages/EveningComplete.jsx');
const reflectionReviewSource = read('../../pages/ReflectionReview.jsx');
const gratitudeReviewSource = read('../../pages/GratitudeReview.jsx');

const ACTIVE_JOURNEY_PAGES = {
  EveningWindDown: windDownSource,
  Reflection: reflectionSource,
  Gratitude: gratitudeSource,
  EveningBreathing: breathingSource,
  EveningMeditate: meditateSource,
  PrepareForRest: prepareSource,
};

describe('Evening Wind-down back-navigation chain', () => {
  it('every step shows the back control (showBack), each falling back to the step before it', () => {
    expect(windDownSource).toMatch(/showBack backFallback="\/"/);
    // Phase 3 back-navigation fix: Reflection/Gratitude each have 3
    // internal questions now, addressed by their own `?q=` route param -
    // backFallback is a per-question COMPUTED value (backFallbackForIndex),
    // not a single static string, so the shared BackButton lands on the
    // exact previous question (or, for Q1, the actual previous Evening
    // journey stage) - see eveningFlow.questionBackNavigation.test.js for
    // the full per-question destination matrix this replaces.
    expect(reflectionSource).toMatch(/showBack backFallback=\{backFallbackForIndex\(activeIndex\)\}/);
    expect(gratitudeSource).toMatch(/showBack backFallback=\{backFallbackForIndex\(activeIndex\)\}/);
    // Build 15 Evening UX correction — fixes the confirmed bug where the
    // missing `?q=3` meant Back landed on Gratitude Q1 (parseActiveIndex
    // defaults a missing q to index 0), not Gratitude Q3 as required.
    expect(breathingSource).toMatch(/showBack backFallback="\/gratitude\?q=3"/);
    // Journey Embedding — Meditate's own Back returns to Evening Breathing
    // (the real preceding step), and Prepare for Rest's own Back now
    // returns to Meditate instead of skipping over it straight to
    // Breathing.
    expect(meditateSource).toMatch(/showBack backFallback="\/evening-breathing"/);
    expect(prepareSource).toMatch(/showBack backFallback="\/evening-meditate"/);
    expect(completeSource).toMatch(/showBack backFallback="\/"/);
  });

  it('EveningSceneShell renders the back control with a high-contrast panel, not the faint default glass-panel alone', () => {
    expect(shellSource).toMatch(/!bg-black\/55 !border-white\/40/);
  });
});

describe('Build 15 Evening UX correction — Back never interrupts the active session on any Evening screen', () => {
  it('EveningSceneShell always renders its BackButton with guardActiveRoute={false} - the old "Leave this routine?" dialog can never open from Back on an Evening screen', () => {
    expect(shellSource).toMatch(/<BackButton\s*\n\s*fallback=\{backFallback\}\s*\n\s*className="!bg-black\/55 !border-white\/40"\s*\n\s*onBeforeLeave=\{onBeforeLeave\}\s*\n\s*guardActiveRoute=\{false\}\s*\n\s*\/>/);
  });

  it('EveningSceneShell no longer passes confirmTitle/confirmMessage to BackButton - that confirmation can never fire here any more, since guardActiveRoute is always false', () => {
    expect(shellSource).not.toMatch(/confirmTitle=/);
    expect(shellSource).not.toMatch(/confirmMessage=/);
  });

  it('BackButton.jsx keeps guardActiveRoute defaulting to true - every non-Evening caller (Breathe.jsx\'s own BackButton, etc.) is completely unaffected', () => {
    expect(backButtonSource).toMatch(/guardActiveRoute = true/);
    expect(backButtonSource).toMatch(/const isActiveRoutineStep = guardActiveRoute && activeRoute === location\.pathname;/);
  });

  it('BackButton keeps its original generic confirmation copy as the default (still used by every non-Evening caller), unchanged', () => {
    expect(backButtonSource).toMatch(/confirmTitle = 'Leave this routine\?'/);
    expect(backButtonSource).toMatch(/confirmMessage = 'Your current progress may be paused\.'/);
  });
});

describe('Build 15 Evening UX correction — dedicated Exit/X control on every active-journey screen, never on Evening Complete', () => {
  it('all six active-journey screens pass showExit to EveningSceneShell (Journey Embedding added Evening Meditate as a sixth)', () => {
    for (const source of Object.values(ACTIVE_JOURNEY_PAGES)) {
      expect(source).toMatch(/<EveningSceneShell[^>]*\bshowExit\b/);
    }
  });

  it('EveningComplete.jsx (the terminal screen) never passes showExit - it already has its own safe Return Home action', () => {
    expect(completeSource).not.toMatch(/showExit/);
  });

  it('the post-completion Review screens never pass showExit either - they are not part of the active journey (session is already \'completed\' by the time they can render)', () => {
    expect(reflectionReviewSource).not.toMatch(/showExit/);
    expect(gratitudeReviewSource).not.toMatch(/showExit/);
  });

  it('EveningSceneShell only renders ExitEveningButton when showExit is true, positioned top-right, mirroring BackButton\'s own top-left offset', () => {
    expect(shellSource).toMatch(/\{showExit && \(/);
    expect(shellSource).toMatch(/className="absolute right-6 z-20"/);
    expect(shellSource).toMatch(/<ExitEveningButton \/>/);
  });
});

describe('ExitEveningButton - 44px target, accessible name, approved confirmation copy, safe interruption', () => {
  it('is a real 44x44 button with the exact required accessible name', () => {
    expect(exitButtonSource).toMatch(/className="w-11 h-11 rounded-full/);
    expect(exitButtonSource).toMatch(/aria-label="Exit Evening Wind-Down"/);
  });

  it('uses the exact approved confirmation copy', () => {
    expect(exitButtonSource).toMatch(/title="Leave Evening Wind-Down\?"/);
    expect(exitButtonSource).toMatch(
      /message="Your place in the Evening Wind-Down will be saved\. You can continue from Home when you're ready\."/
    );
    expect(exitButtonSource).toMatch(/confirmLabel="Return Home"/);
    expect(exitButtonSource).toMatch(/cancelLabel="Continue Wind-Down"/);
  });

  it('is never styled destructive - leaving is not a data-destructive action', () => {
    expect(exitButtonSource).not.toMatch(/destructive/);
  });

  it('tapping the button only opens the dialog when genuine Evening progress exists - nothing is mutated before confirmation', () => {
    const tapBody = exitButtonSource.match(/const handleTap = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(tapBody).not.toMatch(/leaveActiveRoutine/);
    expect(tapBody).toMatch(/setConfirmOpen\(true\);/);
  });

  it('the no-progress case (Evening session not genuinely playing/interrupted) skips the confirmation entirely and goes straight Home - never a misleading "your place will be saved" claim when nothing has started', () => {
    const tapBody = exitButtonSource.match(/const handleTap = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(tapBody).toMatch(/if \(!hasActiveEveningProgress\) \{\s*\n\s*navigate\('\/'\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('scopes "active progress" to Evening\'s own sessionId only - never derived from whichever routine happens to occupy the Session Engine\'s one global live slot (the same cross-routine-isolation principle useStepReviewMode.js already established)', () => {
    expect(exitButtonSource).toMatch(
      /const hasActiveEveningProgress =\s*\n\s*state\.sessionId === 'evening-wind-down' && \(state\.status === 'playing' \|\| state\.status === 'interrupted'\);/
    );
  });

  it('confirming calls the shared leaveActiveRoutine() (interruptSession, never resetRoutine/completeSession/advanceStep) exactly once, guarded against rapid double taps, before navigating Home', () => {
    const body = exitButtonSource.match(/const handleConfirmReturnHome = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(hasLeftRef\.current\) return;/);
    expect(body).toMatch(/hasLeftRef\.current = true;/);
    const leaveIdx = body.indexOf('leaveActiveRoutine();');
    const navigateIdx = body.indexOf("navigate('/');");
    expect(leaveIdx).toBeGreaterThan(-1);
    expect(navigateIdx).toBeGreaterThan(leaveIdx);
    expect(exitButtonSource).not.toMatch(/resetRoutine\(|completeSession\(|advanceStep\(/);
  });

  it('Continue Wind-Down (onDismiss) only closes the dialog - no navigation, no state change', () => {
    expect(exitButtonSource).toMatch(/onDismiss=\{\(\) => setConfirmOpen\(false\)\}/);
  });
});
