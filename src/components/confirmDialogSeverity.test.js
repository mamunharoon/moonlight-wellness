// Build 15 muted-destructive addition — real, computed WCAG contrast for
// both destructive severities (mild + strong), and source-level checks
// that the correct severity reaches the correct dialog. No DOM rendering
// is available in this repo's Vitest, matching every other test file's
// own established precedent (see prepareForRest.test.js's own relLum/
// contrast helpers, reused verbatim here).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const confirmDialogSource = read('./ConfirmDialog.jsx');
const homeSource = read('../pages/Home.jsx');

const relLum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
  const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};
const contrast = (a, b) => {
  const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const WHITE = '#ffffff';
const MILD_DESTRUCTIVE = '#b3555f';
const STRONG_DESTRUCTIVE = '#dc2626'; // Tailwind red-600

describe('ConfirmDialog.jsx - two centrally defined destructive severities', () => {
  it('defines an additive mildDestructive prop, defaulting to false - every existing caller unaffected', () => {
    expect(confirmDialogSource).toMatch(/mildDestructive = false,/);
  });

  it('mild destructive renders the muted rose, solid (not translucent) for deterministic contrast', () => {
    expect(confirmDialogSource).toMatch(/mildDestructive\s*\n\s*\? 'bg-\[#b3555f\] text-white/);
  });

  it('strong destructive renders solid red-600 (not the old red-500/90), also solid for deterministic contrast', () => {
    expect(confirmDialogSource).toMatch(/: destructive\s*\n\s*\? 'bg-red-600 text-white/);
    expect(confirmDialogSource).not.toMatch(/bg-red-500\/90/);
  });

  it('mildDestructive takes precedence over destructive when both are somehow set (mild is checked first in the ternary)', () => {
    const buttonBlockStart = confirmDialogSource.indexOf('className={`flex-1 py-3.5 rounded-full');
    const buttonBlockEnd = confirmDialogSource.indexOf('}`}', buttonBlockStart);
    const buttonBlock = confirmDialogSource.slice(buttonBlockStart, buttonBlockEnd);
    const mildIndex = buttonBlock.indexOf('mildDestructive');
    const strongIndex = buttonBlock.search(/destructive\s*\r?\n\s*\?/);
    expect(mildIndex).toBeGreaterThanOrEqual(0);
    expect(strongIndex).toBeGreaterThanOrEqual(0);
    expect(mildIndex).toBeLessThan(strongIndex);
  });

  it('mild destructive (muted rose) vs white text clears WCAG AA 4.5:1 for normal text', () => {
    expect(contrast(MILD_DESTRUCTIVE, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('strong destructive (red-600) vs white text clears WCAG AA 4.5:1 - the old red-500/90 (~4.46:1) is fixed, not just replaced', () => {
    expect(contrast(STRONG_DESTRUCTIVE, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  it('the old, known-failing strong red (red-500/90, composited ~#d8403f) is genuinely below 4.5:1 - confirms the fix was real, not cosmetic', () => {
    expect(contrast('#d8403f', WHITE)).toBeLessThan(4.5);
  });

  it('mild destructive is clearly distinct in hue from strong destructive - never rendered as the same colour', () => {
    expect(MILD_DESTRUCTIVE.toLowerCase()).not.toBe(STRONG_DESTRUCTIVE.toLowerCase());
  });

  it('mild destructive is clearly distinct from the WakeWise peach primary accent (#ffc5b7) - never mistaken for the affirmative action', () => {
    expect(contrast(MILD_DESTRUCTIVE, '#ffc5b7')).toBeGreaterThan(1.5);
  });
});

describe('Home.jsx dialogCopy() - correct severity reaches the correct dialog kind', () => {
  it('Morning Start Over uses mildDestructive (resets only resumable step progress)', () => {
    expect(homeSource).toMatch(/mildDestructive: activeDialog\.period === 'morning'/);
  });

  it('Evening Start Over keeps destructive: true and is NOT unconditionally mild (scoped by period, not shared)', () => {
    const startOverBlock = homeSource.slice(
      homeSource.indexOf("if (activeDialog.kind === 'start-over')"),
      homeSource.indexOf("if (activeDialog.kind === 'repeat')")
    );
    expect(startOverBlock).toMatch(/destructive: true/);
    expect(startOverBlock).not.toMatch(/mildDestructive: true(?!\s*:)/);
  });

  it('discard-stale (both Morning and Evening) uses mildDestructive: true unconditionally - discards only a resumable snapshot, never saved history', () => {
    const discardStaleBlock = homeSource.slice(homeSource.lastIndexOf("title: \"Start today's routine?\""));
    expect(discardStaleBlock).toMatch(/mildDestructive: true/);
  });

  it('the shared ConfirmDialog instance passes mildDestructive through from dialogCopy, defaulting to false', () => {
    expect(homeSource).toMatch(/mildDestructive=\{dialogCopy\?\.mildDestructive \?\? false\}/);
  });

  it('Redo Tonight\'s Wind-Down keeps its own separate ConfirmDialog instance, strong destructive only, no mildDestructive prop at all - permanent deletion of saved responses never uses the muted treatment', () => {
    const redoBlock = homeSource.slice(
      homeSource.indexOf("Redo tonight's Wind-Down?"),
      homeSource.indexOf('onDismiss={() => setRedoConfirmOpen(false)}')
    );
    expect(redoBlock).toMatch(/destructive/);
    expect(redoBlock).not.toMatch(/mildDestructive/);
  });
});

// WakeWise Phase 2 (B7) — full dialog-severity audit. Aligns every real
// ConfirmDialog consumer's visual severity with its actual consequence:
// neutral for Sign out and cancel/close-without-data-loss; mild for
// exiting an active (resumable, nothing-erased) session or discarding a
// recoverable draft; strong destructive reserved for genuinely erasing
// saved data (Redo Tonight's Wind-Down). No action's actual behaviour
// changed - only which of ConfirmDialog's existing severity props each
// consumer passes. `stripComments` mirrors this codebase's own
// established convention (see e.g. index.css.test.js) so a doc comment
// that merely DISCUSSES a prop name in prose (as several of these fixes'
// own comments now do) can never be mistaken for the prop actually being
// passed.
const stripComments = (source) => source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('WakeWise Phase 2 (B7) — Sign out is neutral (no destructive/mildDestructive), never resembling Delete Account', () => {
  const signOutConsumers = ['../pages/Settings.jsx', '../pages/Profile.jsx', '../pages/PrivacyAndAccount.jsx', '../pages/AccountManagement.jsx'];

  for (const path of signOutConsumers) {
    it(`${path} — its "Sign out?" ConfirmDialog passes neither destructive nor mildDestructive`, () => {
      const code = stripComments(read(path));
      const dialogBlock = code.match(/<ConfirmDialog[\s\S]*?title="Sign out\?"[\s\S]*?\/>/)?.[0] ?? '';
      expect(dialogBlock).not.toBe('');
      expect(dialogBlock).not.toMatch(/destructive/);
    });
  }

  it('DeleteAccount.jsx is untouched by this pass - it never used ConfirmDialog at all (its own bespoke password + typed-phrase hierarchy is the correct, deliberately heavier flow for the single most destructive action in the app)', () => {
    const deleteAccountSource = read('../pages/DeleteAccount.jsx');
    expect(deleteAccountSource).not.toMatch(/import \{ ConfirmDialog \}/);
  });
});

describe('WakeWise Phase 2 (B7) — "exit an active session" (interruptSession, resumable, nothing erased) is mildDestructive, not strong destructive', () => {
  it('BackButton.jsx\'s shared default "Leave this routine?" confirmation - corrects every one of its own callers (Breathe.jsx, Affirmation.jsx, IntentionSetup.jsx, MorningFlow.jsx, etc.) at once', () => {
    const code = stripComments(read('../components/BackButton.jsx'));
    const dialogBlock = code.match(/<ConfirmDialog[\s\S]*?\/>/)?.[0] ?? '';
    expect(dialogBlock).toMatch(/mildDestructive/);
    expect(dialogBlock).not.toMatch(/\bdestructive\b/);
  });

  it('MorningMeditate.jsx\'s own local "Leave this routine?" (Close/X while active)', () => {
    const code = stripComments(read('../pages/MorningMeditate.jsx'));
    const dialogBlock = code.match(/<ConfirmDialog[\s\S]*?title="Leave this routine\?"[\s\S]*?\/>/)?.[0] ?? '';
    expect(dialogBlock).toMatch(/mildDestructive/);
    expect(dialogBlock).not.toMatch(/\bdestructive\b/);
  });

  it('SelfGuidedMeditation.jsx\'s "Leave meditation?" (was destructive, now aligned with MorningMeditate.jsx\'s own equivalent)', () => {
    const code = stripComments(read('../pages/SelfGuidedMeditation.jsx'));
    const dialogBlock = code.match(/<ConfirmDialog[\s\S]*?title="Leave meditation\?"[\s\S]*?\/>/)?.[0] ?? '';
    expect(dialogBlock).toMatch(/mildDestructive/);
    expect(dialogBlock).not.toMatch(/\bdestructive\b/);
  });

  it('ExitEveningButton.jsx\'s "Leave Evening Wind-Down?" - previously had NO severity styling at all', () => {
    const code = stripComments(read('../components/evening/ExitEveningButton.jsx'));
    const dialogBlock = code.match(/<ConfirmDialog[\s\S]*?\/>/)?.[0] ?? '';
    expect(dialogBlock).toMatch(/mildDestructive/);
    expect(dialogBlock).not.toMatch(/\bdestructive\b/);
  });
});

describe('WakeWise Phase 2 (B7) — "discard a temporary draft where recovery remains possible" is mildDestructive, not strong destructive', () => {
  it('EditEveningResponses.jsx\'s "Discard your changes?" - only the unsaved edit draft is discarded, the original saved responses are untouched and still recoverable', () => {
    const code = stripComments(read('../pages/EditEveningResponses.jsx'));
    const dialogBlock = code.match(/<ConfirmDialog[\s\S]*?title="Discard your changes\?"[\s\S]*?\/>/)?.[0] ?? '';
    expect(dialogBlock).toMatch(/mildDestructive/);
    expect(dialogBlock).not.toMatch(/\bdestructive\b/);
  });
});

describe('WakeWise Phase 2 (B7) — genuinely erasing saved data stays strong destructive, unchanged', () => {
  it('EveningComplete.jsx\'s "Redo tonight\'s Wind-Down?" (permanently deletes saved Reflection/Gratitude responses) is untouched by this pass', () => {
    const code = stripComments(read('../pages/EveningComplete.jsx'));
    const dialogBlock = code.match(/<ConfirmDialog[\s\S]*?title="Redo tonight's Wind-Down\?"[\s\S]*?\/>/)?.[0] ?? '';
    expect(dialogBlock).toMatch(/\bdestructive\b/);
    expect(dialogBlock).not.toMatch(/mildDestructive/);
  });
});
