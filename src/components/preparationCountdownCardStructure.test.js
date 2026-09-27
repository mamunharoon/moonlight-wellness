// Physical-device correction — shared preparation countdown card.
//
// Confirmed on a real phone: the countdown number sat in its own small
// circle floating on the bare page background, with "Starting in…"/cue/
// "Start now" directly on that same bare background below it - reported
// as reading weak/undefined rather than as one clear countdown card.
// Fixed by moving the ENTIRE presentation (number, Seconds label,
// "Starting in…", cue, Start now) inside one near-square card carrying
// the dark surface/border/journey-glow - a container restructure only.
// preparationCountdownVisualUplift.test.js already covers the pre-
// existing contrast math, exact copy, animation exclusion and unchanged
// functional contract (prop signature/onSkip/role) - this file covers
// only what's new: the single shared card structure itself, and that it
// stays responsive (no forced aspect-square, no fixed height) so it can
// never clip on a short 320x568 viewport.
//
// No DOM rendering is available in this repo's Vitest - source-level
// checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./PreparationCountdown.jsx', import.meta.url)), 'utf-8');
const cardBlock = source.match(/<div\s*\n\s*className=\{`w-full max-w-\[300px\][\s\S]*?\n {6}>/)?.[0] ?? '';

describe('PreparationCountdown.jsx — one shared card contains the whole presentation, not just the number', () => {
  it('the card block was located correctly - a sanity check every other test in this file depends on', () => {
    expect(cardBlock).not.toBe('');
  });

  it('the number, "Seconds" label, "Starting in…"/cue text, and the Start now button are all inside this one card element (not split across an inner circle + an outer bare-background block)', () => {
    const fullComponentBody = source.slice(source.indexOf('export const PreparationCountdown'));
    const cardOpenIndex = fullComponentBody.indexOf('max-w-[300px]');
    const afterCard = fullComponentBody.slice(cardOpenIndex);
    expect(afterCard.indexOf('{secondsRemaining}')).toBeGreaterThan(0);
    expect(afterCard.indexOf('Seconds</span>')).toBeGreaterThan(afterCard.indexOf('{secondsRemaining}'));
    expect(afterCard.indexOf('Starting in')).toBeGreaterThan(afterCard.indexOf('Seconds</span>'));
    expect(afterCard.indexOf('Start now')).toBeGreaterThan(afterCard.indexOf('Starting in'));
  });

  it('the card carries the dark surface background, a subtle single-width border (not the old border-2), and the journey glow, all on the SAME element', () => {
    expect(cardBlock).toMatch(/bg-surface-container/);
    expect(cardBlock).toMatch(/border \$\{tone\.border\}/);
    expect(cardBlock).not.toMatch(/border-2/);
    expect(cardBlock).toMatch(/\$\{tone\.glow\}/);
  });

  it('the card has rounded corners appropriate to a near-square card (not the old rounded-full circle)', () => {
    expect(cardBlock).toMatch(/rounded-\[2rem\]/);
    expect(cardBlock).not.toMatch(/rounded-full/);
  });
});

describe('PreparationCountdown.jsx — responsive, not one rigid pixel size; never forced into a strict aspect-square that could clip content', () => {
  it('width is capped with max-w (a ceiling), combined with w-full (fluid below that) - never a fixed width/height pair, and never a forced aspect-square that could clip real content on a short viewport', () => {
    expect(cardBlock).toMatch(/w-full max-w-\[300px\]/);
    expect(cardBlock).not.toMatch(/aspect-square/);
  });

  it('height is never fixed or forced - it is left to flow from real content (no h-\\d+ or fixed-height utility on the card itself)', () => {
    expect(cardBlock).not.toMatch(/\bh-\d+\b/);
  });

  it('the card is horizontally centred within its own flex-centred wrapper, so it never sits flush against a viewport edge at any width', () => {
    expect(cardBlock).toMatch(/mx-auto/);
    expect(source).toMatch(/min-h-\[60vh\] flex flex-col items-center justify-center px-4/);
  });
});

describe('PreparationCountdown.jsx — no distracting animation on the new card (still true after the restructure)', () => {
  it('no pulse/ping/bounce/keyframes on the card itself', () => {
    expect(cardBlock).not.toMatch(/animate-pulse|animate-ping|animate-bounce|@keyframes/);
  });
});

describe('PreparationCountdown.jsx — "Start now" stays a clear, reachable action inside the card', () => {
  it('the button is full-width within the card (w-full) and keeps the existing 44px minimum tap target', () => {
    const buttonBlock = source.match(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{onSkip\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(buttonBlock).toMatch(/min-h-\[44px\] w-full/);
  });
});
