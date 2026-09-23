// Build 15 Evening UX correction — EveningReviewBanner's additive onEdit
// action (the shared entry point into Edit Mode from anywhere inside
// Review). No DOM rendering is available in this repo's Vitest -
// source-level checks, matching every other regression guard in this
// codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./EveningReviewBanner.jsx', import.meta.url)), 'utf-8');

describe('EveningReviewBanner - onEdit is additive, optional, never required', () => {
  it('destructures onEdit alongside onReturn with no default - a caller that omits it simply never renders the Edit button', () => {
    expect(source).toMatch(/export const EveningReviewBanner = \(\{ onReturn, onEdit \}\) => \(/);
  });

  it('the Edit button only renders when onEdit is truthy - Review stays read-only-only (no Edit affordance at all) for any caller that omits it', () => {
    expect(source).toMatch(/\{onEdit && \(/);
  });

  it('Edit never replaces or hides "Evening Summary" - both actions render side by side when onEdit is provided', () => {
    const actionsBlock = source.match(/<div className="flex flex-wrap gap-2">([\s\S]*?)\n {4}<\/div>/)?.[0] ?? '';
    expect(actionsBlock).toMatch(/onClick=\{onReturn\}/);
    expect(actionsBlock).toMatch(/onClick=\{onEdit\}/);
    expect(actionsBlock).toMatch(/Evening Summary/);
    expect(actionsBlock).toMatch(/Edit Tonight's Responses/);
  });
});

describe('EveningReviewBanner - 320px layout: wraps cleanly, no crowding, no truncation, 44px targets', () => {
  it('the two actions sit in their own flex-wrap row, separate from the status label - never squeezed onto one line together', () => {
    expect(source).toMatch(/<div className="flex flex-wrap gap-2">/);
    // The label paragraph is its own sibling, not inside the actions row.
    const labelIdx = source.indexOf('Reviewing');
    const actionsRowIdx = source.indexOf('flex flex-wrap gap-2');
    expect(labelIdx).toBeGreaterThan(-1);
    expect(actionsRowIdx).toBeGreaterThan(labelIdx);
  });

  it('both actions carry an explicit min-h-[44px], regardless of their compact text-xs label', () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
    const minHeightMatches = code.match(/min-h-\[44px\]/g) ?? [];
    expect(minHeightMatches.length).toBe(2);
  });

  it('neither action truncates its label (no truncate/line-clamp/overflow-hidden anywhere)', () => {
    expect(source).not.toMatch(/truncate|line-clamp|overflow-hidden/);
  });

  it('the status label itself is a plain paragraph with no truncation - Review status remains readable at any width', () => {
    const labelBlock = source.match(/<p className="text-xs text-on-surface-variant">[\s\S]*?<\/p>/)?.[0] ?? '';
    expect(labelBlock).not.toMatch(/truncate|line-clamp|overflow-hidden/);
  });
});

describe('EveningReviewBanner - Edit never makes Review itself editable', () => {
  it('onEdit is a plain click handler the caller owns (a navigate() to the existing /edit/evening route) - this component itself has no draft/save/cancel state of its own', () => {
    expect(source).not.toMatch(/useState|draft|Save Changes/);
  });
});
