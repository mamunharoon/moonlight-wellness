// Product-wide dialog-severity audit and correction (mobile corrections
// batch). Verifies every real consumer/rendered state, not just that
// ConfirmDialog.jsx supports variants. Fixes four confirmed gaps: (1) five
// "Exit routine" links exited with zero confirmation despite being MORE
// final than the guarded Back/Close paths next to them; (2) Home.jsx's
// Evening "Start Over" was over-severitized (full red) vs Morning's
// identical-consequence case; (3) Gratitude/Reflection's "Review an
// earlier step?" was under-severitized (neutral) despite admitting real
// progress loss; (4) DeleteAccount.jsx's billing step had an inverted
// Keep-my-account/Continue hierarchy. Source-level regression guard (no
// DOM rendering in this repo's Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('"Exit routine" links now confirm first, mildDestructive - previously zero confirmation despite abandonSession() being terminal/non-resumable (SKIPPED), unlike Back/Close\'s own resumable interruptSession()', () => {
  const FILES = [
    ['./IntentionSetup.jsx', 'intention'],
    ['./Breathe.jsx', 'breathe'],
    ['./MorningFlow.jsx', 'stretch'],
    ['./Affirmation.jsx', 'affirmation']
  ];

  it.each(FILES)('%s: handleExitRoutine opens a confirm dialog; confirmExitRoutine performs the unchanged action', (path, stepId) => {
    const source = read(path);
    expect(source).toMatch(/const \[exitRoutineConfirmOpen, setExitRoutineConfirmOpen\] = useState\(false\);/);
    expect(source).toMatch(/const handleExitRoutine = \(\) => setExitRoutineConfirmOpen\(true\);/);
    const confirmFn = source.match(/const confirmExitRoutine = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(confirmFn).toMatch(/setExitRoutineConfirmOpen\(false\);/);
    expect(confirmFn).toMatch(/setJourneyStep\(''\);/);
    expect(confirmFn).toMatch(/navigate\('\/'\);/);
    expect(confirmFn).toMatch(new RegExp(`currentStep\\?\\.id === '${stepId}'\\) abandonSession\\(\\);`));
    expect(source).toMatch(/open=\{exitRoutineConfirmOpen\}[\s\S]{0,400}mildDestructive/);
  });

  it('MorningMeditate.jsx: same fix, distinctly-named state (exitRoutineLinkConfirmOpen) since exitConfirmOpen is already used by its own separate active-screen Close/X dialog', () => {
    const source = read('./MorningMeditate.jsx');
    expect(source).toMatch(/const \[exitRoutineLinkConfirmOpen, setExitRoutineLinkConfirmOpen\] = useState\(false\);/);
    expect(source).toMatch(/const handleExitRoutine = \(\) => setExitRoutineLinkConfirmOpen\(true\);/);
    const confirmFn = source.match(/const confirmExitRoutine = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(confirmFn).toMatch(/abandonSession\(\);/);
    expect(source).toMatch(/open=\{exitRoutineLinkConfirmOpen\}[\s\S]{0,400}mildDestructive/);
  });
});

describe('Home.jsx — Evening Start Over no longer over-severitized relative to Morning\'s identical-consequence case', () => {
  const source = read('./Home.jsx');

  it('both periods share mildDestructive: true unconditionally, not scoped by activeDialog.period', () => {
    const startOverBlock = source.slice(
      source.indexOf("if (activeDialog.kind === 'start-over')"),
      source.indexOf("if (activeDialog.kind === 'repeat')")
    );
    expect(startOverBlock).toMatch(/mildDestructive: true/);
    expect(startOverBlock).not.toMatch(/mildDestructive: activeDialog\.period/);
  });
});

describe('Gratitude.jsx / Reflection.jsx — "Review an earlier step?" now correctly mild (copy already admitted real progress loss)', () => {
  it.each([['./Gratitude.jsx'], ['./Reflection.jsx']])('%s', (path) => {
    const source = read(path);
    const block = source.match(/title="Review an earlier step\?"[\s\S]*?onDismiss=\{cancelLeave\}/)?.[0] ?? '';
    expect(block).toMatch(/mildDestructive/);
  });
});

describe('DeleteAccount.jsx — billing step\'s inverted Keep-my-account/Continue hierarchy corrected, no behavior change', () => {
  const source = read('./DeleteAccount.jsx');

  it('"Keep my account" is the PrimaryButton and "Continue" is the SecondaryButton at the billing step, matching the "explain" step\'s already-correct hierarchy', () => {
    const billingBlock = source.match(/<PrimaryButton onClick=\{\(\) => navigate\('\/profile\/account-management'\)\}>\s*\n\s*Keep my account\s*\n\s*<\/PrimaryButton>\s*\n\s*<SecondaryButton disabled=\{billingLoading \|\| Boolean\(billingError\)\} onClick=\{\(\) => setPhase\('reauth'\)\}>\s*\n\s*Continue\s*\n\s*<\/SecondaryButton>/)?.[0] ?? '';
    expect(billingBlock).not.toBe('');
  });

  it('the actual consequence/handlers are unchanged - Continue still moves to reauth, Keep my account still returns to account management', () => {
    expect(source).toMatch(/onClick=\{\(\) => setPhase\('reauth'\)\}/);
    expect(source).toMatch(/onClick=\{\(\) => navigate\('\/profile\/account-management'\)\}/);
  });
});
