// Evening Visual Uplift (Build 17), Decision E clarification — the
// genuinely Evening-only EveningReviewBanner.jsx and EveningEditBanner.jsx
// gain a restrained periwinkle border/tint/label, while the genuinely
// shared ConfirmDialog.jsx and ReviewModeBanner.jsx stay completely
// untouched (no accent mechanism added to either).
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

describe('EveningReviewBanner.jsx — periwinkle border/tint/label', () => {
  it('the container uses border-evening-accent/20 bg-evening-accent/5, not the old peach primary tint', () => {
    expect(reviewBannerSource).toMatch(/className="glass-panel rounded-2xl px-4 py-3 space-y-3 border-evening-accent\/20 bg-evening-accent\/5"/);
    expect(reviewBannerSource).not.toMatch(/border-primary\/20 bg-primary\/5/);
  });

  it('the "Reviewing" label is evening-accent, not peach', () => {
    expect(reviewBannerSource).toMatch(/<span className="font-bold text-evening-accent">Reviewing<\/span>/);
  });

  it('both action buttons (Evening Summary peach primary, Edit Tonight\'s Responses glass-panel secondary) are completely unchanged', () => {
    expect(reviewBannerSource).toMatch(/className="min-h-\[44px\] px-3 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:opacity-90 active:scale-95 transition-all"/);
    expect(reviewBannerSource).toMatch(/className="min-h-\[44px\] px-3 py-2 rounded-full glass-panel text-on-surface text-xs font-bold hover:bg-white\/10 active:scale-95 transition-all border-white\/10"/);
    expect(reviewBannerSource).toMatch(/Evening Summary/);
    expect(reviewBannerSource).toMatch(/Edit Tonight's Responses/);
  });

  it('onEdit stays optional/additive - the Edit button still only renders when onEdit is truthy', () => {
    expect(reviewBannerSource).toMatch(/export const EveningReviewBanner = \(\{ onReturn, onEdit \}\) => \(/);
    expect(reviewBannerSource).toMatch(/\{onEdit && \(/);
  });
});

describe('EveningEditBanner.jsx — periwinkle border/tint/icon/label', () => {
  it('the container uses border-evening-accent/20 bg-evening-accent/5, not the old peach primary tint', () => {
    expect(editBannerSource).toMatch(/className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3 border-evening-accent\/20 bg-evening-accent\/5"/);
    expect(editBannerSource).not.toMatch(/border-primary\/20 bg-primary\/5/);
  });

  it('the edit icon and "Editing" label are evening-accent, not peach', () => {
    expect(editBannerSource).toMatch(/className="material-symbols-outlined text-evening-accent text-lg shrink-0"/);
    expect(editBannerSource).toMatch(/<span className="font-bold text-evening-accent">Editing<\/span>/);
  });

  it('this banner still has no button of its own - the two guarded exits (BackButton, Cancel) remain the only way out of Edit Mode', () => {
    expect(editBannerSource).not.toMatch(/<button/);
  });
});

describe('ConfirmDialog.jsx and ReviewModeBanner.jsx — genuinely shared, completely untouched', () => {
  it('ConfirmDialog.jsx has no evening-accent reference anywhere - no accent mechanism was added to the global dialog', () => {
    expect(confirmDialogSource).not.toMatch(/evening-accent/);
  });

  it('ReviewModeBanner.jsx has no evening-accent reference anywhere - it keeps its existing peach primary treatment app-wide', () => {
    expect(reviewModeBannerSource).not.toMatch(/evening-accent/);
  });
});
