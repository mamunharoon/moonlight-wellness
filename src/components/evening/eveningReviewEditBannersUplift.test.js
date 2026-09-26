// Evening Visual Uplift (Build 17), Decision E clarification — the
// genuinely Evening-only EveningReviewBanner.jsx and EveningEditBanner.jsx
// gained a restrained periwinkle border/tint/label, while the genuinely
// shared ConfirmDialog.jsx and ReviewModeBanner.jsx stayed completely
// untouched at the time (no accent mechanism on either).
//
// Evening journey-theme correction (later phase) — found live: (1)
// EveningReviewBanner.jsx/EveningEditBanner.jsx's own border/tint used a
// `/<n>` opacity modifier directly on the plain-hex evening-accent token,
// the same silently-transparent bug already fixed elsewhere in this app
// (see journeyTone.js's own doc comment) - both now use the alpha-safe
// evening-accent-tint token instead, so the periwinkle border/tint Build
// 17 intended actually renders. (2) EveningReviewBanner's own "Evening
// Summary" review-return action was deliberately left peach at the time
// ("stays bg-primary, unchanged") - now corrected to the same
// periwinkle-tinted/outline treatment ReviewModeBanner's own "Return to
// X" uses, since both are the same kind of secondary review-return
// control. (3) ReviewModeBanner.jsx - genuinely shared between Morning
// and Evening - gained its own OPT-IN journeyTone prop (default
// 'primary', byte-identical peach for every existing caller); only
// Reflection.jsx/Gratitude.jsx pass journeyTone="evening" explicitly, so
// it is no longer "completely untouched" but every non-Evening caller's
// rendered output is unchanged. ConfirmDialog.jsx remains completely
// untouched by both phases - no accent mechanism was ever added to it.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const reviewBannerSource = read('./EveningReviewBanner.jsx');
const editBannerSource = read('./EveningEditBanner.jsx');
const confirmDialogSource = read('../ConfirmDialog.jsx');
const reviewModeBannerSource = read('../ReviewModeBanner.jsx');

describe('EveningReviewBanner.jsx — periwinkle border/tint/label, alpha-safe token', () => {
  it('the container uses the alpha-safe border-evening-accent-tint/20 bg-evening-accent-tint/5, not the plain-hex opacity-bug form nor the old peach primary tint', () => {
    expect(reviewBannerSource).toMatch(/className="glass-panel rounded-2xl px-4 py-3 space-y-3 border-evening-accent-tint\/20 bg-evening-accent-tint\/5"/);
    expect(reviewBannerSource).not.toMatch(/border-primary\/20 bg-primary\/5/);
    expect(reviewBannerSource).not.toMatch(/className="glass-panel rounded-2xl px-4 py-3 space-y-3 border-evening-accent\/20 bg-evening-accent\/5"/);
  });

  it('the "Reviewing" label is evening-accent, not peach', () => {
    expect(reviewBannerSource).toMatch(/<span className="font-bold text-evening-accent">Reviewing<\/span>/);
  });

  it('"Evening Summary" is now a periwinkle-tinted/outline review-return control (matching ReviewModeBanner\'s own "Return to X" treatment), no longer peach; "Edit Tonight\'s Responses" glass-panel secondary is unchanged', () => {
    expect(reviewBannerSource).toMatch(/className="min-h-\[44px\] px-3 py-2 rounded-full bg-evening-accent-tint\/15 text-evening-accent border border-evening-accent text-xs font-bold hover:bg-evening-accent-tint\/25 active:scale-95 transition-all"/);
    expect(reviewBannerSource).not.toMatch(/bg-primary text-on-primary text-xs font-bold hover:opacity-90/);
    expect(reviewBannerSource).toMatch(/className="min-h-\[44px\] px-3 py-2 rounded-full glass-panel text-on-surface text-xs font-bold hover:bg-white\/10 active:scale-95 transition-all border-white\/10"/);
    expect(reviewBannerSource).toMatch(/Evening Summary/);
    expect(reviewBannerSource).toMatch(/Edit Tonight's Responses/);
  });

  it('onEdit stays optional/additive - the Edit button still only renders when onEdit is truthy', () => {
    expect(reviewBannerSource).toMatch(/export const EveningReviewBanner = \(\{ onReturn, onEdit \}\) => \(/);
    expect(reviewBannerSource).toMatch(/\{onEdit && \(/);
  });
});

describe('EveningEditBanner.jsx — periwinkle border/tint/icon/label, alpha-safe token', () => {
  it('the container uses the alpha-safe border-evening-accent-tint/20 bg-evening-accent-tint/5, not the plain-hex opacity-bug form nor the old peach primary tint', () => {
    expect(editBannerSource).toMatch(/className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3 border-evening-accent-tint\/20 bg-evening-accent-tint\/5"/);
    expect(editBannerSource).not.toMatch(/border-primary\/20 bg-primary\/5/);
    expect(editBannerSource).not.toMatch(/className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3 border-evening-accent\/20 bg-evening-accent\/5"/);
  });

  it('the edit icon and "Editing" label are evening-accent, not peach', () => {
    expect(editBannerSource).toMatch(/className="material-symbols-outlined text-evening-accent text-lg shrink-0"/);
    expect(editBannerSource).toMatch(/<span className="font-bold text-evening-accent">Editing<\/span>/);
  });

  it('this banner still has no button of its own - the two guarded exits (BackButton, Cancel) remain the only way out of Edit Mode', () => {
    expect(editBannerSource).not.toMatch(/<button/);
  });
});

describe('ConfirmDialog.jsx — genuinely shared, completely untouched by either phase', () => {
  it('has no evening-accent reference anywhere - no accent mechanism was ever added to the global dialog', () => {
    expect(confirmDialogSource).not.toMatch(/evening-accent/);
  });
});

describe('ReviewModeBanner.jsx — Evening journey-theme correction: opt-in journeyTone, every existing (non-Evening) caller unaffected', () => {
  it('now declares an additive journeyTone prop, default \'primary\' - the exact original peach classes', () => {
    expect(reviewModeBannerSource).toMatch(/journeyTone = 'primary'/);
    expect(reviewModeBannerSource).toMatch(/container: 'border-primary\/20 bg-primary\/5',/);
    expect(reviewModeBannerSource).toMatch(/label: 'text-primary',/);
    expect(reviewModeBannerSource).toMatch(/action: 'bg-primary text-on-primary hover:opacity-90'/);
  });

  it('the \'evening\' entry is a periwinkle-tinted/outline "Return to X" treatment (not the solid primary-action fill), since it sits alongside PromptStepper\'s own solid Next/Continue on Reflection.jsx/Gratitude.jsx', () => {
    expect(reviewModeBannerSource).toMatch(/container: 'border-evening-accent-tint\/20 bg-evening-accent-tint\/5',/);
    expect(reviewModeBannerSource).toMatch(/label: 'text-evening-accent',/);
    expect(reviewModeBannerSource).toMatch(/action: 'bg-evening-accent-tint\/15 text-evening-accent border border-evening-accent hover:bg-evening-accent-tint\/25'/);
  });
});
