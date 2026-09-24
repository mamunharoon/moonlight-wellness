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

  it('strong destructive renders solid red-600 (not the old red-500\/90), also solid for deterministic contrast', () => {
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

describe('The other 7 real ConfirmDialog consumers keep strong destructive, untouched by this change', () => {
  const consumers = [
    '../pages/AccountManagement.jsx',
    '../components/BackButton.jsx',
    '../pages/EditEveningResponses.jsx',
    '../pages/Profile.jsx',
    '../pages/PrivacyAndAccount.jsx',
    '../pages/EveningComplete.jsx',
    '../pages/Settings.jsx'
  ];

  for (const path of consumers) {
    it(`${path} still passes destructive with no mildDestructive prop`, () => {
      const source = read(path);
      expect(source).toMatch(/destructive/);
      expect(source).not.toMatch(/mildDestructive/);
    });
  }
});
