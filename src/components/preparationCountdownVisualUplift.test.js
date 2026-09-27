// Mobile correction #3 — strengthen the shared countdown visual (dark
// contained card, subtle static journey-glow, larger number + "Seconds"
// support text, more prominent "Start now"). Real, computed WCAG contrast
// math (same relLum/contrast helpers as affirmationMorningUplift.test.js's
// own precedent) plus source-level checks that timing/skip/audio-unlock
// props and Reduced Motion are untouched - this file is purely
// presentational (see the component's own doc comment), so no DOM
// rendering is needed or available in this repo's Vitest.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./PreparationCountdown.jsx');

const relLum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
  const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};
const contrast = (a, b) => {
  const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// Real hex values from src/index.css - the dark card background and each
// journey's real number-text colour (never hand-typed guesses).
const SURFACE_CONTAINER = '#171f33';
const MORNING_TEXT = '#fdba74'; // --color-gratitude-accent (morning-accent alias)
const ANYTIME_TEXT = '#7fe4d0'; // --color-tertiary
const EVENING_TEXT = '#9fb4f0'; // --color-evening-accent
const PRIMARY_TEXT = '#ffc5b7'; // --color-primary (neutral fallback)

describe('PreparationCountdown.jsx — real, computed 4.5:1 AA contrast for the countdown number against the new dark card', () => {
  it('every journey tone (and the neutral fallback) clears 4.5:1 for large bold text on bg-surface-container', () => {
    for (const hex of [MORNING_TEXT, ANYTIME_TEXT, EVENING_TEXT, PRIMARY_TEXT]) {
      expect(contrast(hex, SURFACE_CONTAINER)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('PreparationCountdown.jsx — strengthened card structure, reusing existing named tokens (never new colours)', () => {
  it('uses the existing dark bg-surface-container card, not the old plain glass-panel ring', () => {
    expect(source).toMatch(/bg-surface-container/);
  });

  it('applies the existing named glow shadow tokens per journey - morning-glow/mint-glow/evening-glow/welcome-glow, never a hand-typed box-shadow', () => {
    expect(source).toMatch(/shadow-morning-glow/);
    expect(source).toMatch(/shadow-mint-glow/);
    expect(source).toMatch(/shadow-evening-glow/);
    expect(source).toMatch(/shadow-welcome-glow/);
    expect(source).not.toMatch(/boxShadow:|style=\{\{[^}]*shadow/);
  });

  it('shows a "Seconds" support label alongside the number, only while genuinely counting down (never "0 Seconds")', () => {
    expect(source).toMatch(/\{secondsRemaining > 0 && \(\s*\n\s*<span className="[^"]*">Seconds<\/span>/);
  });

  it('"Starting in N…"/"Starting now…" text is unchanged', () => {
    expect(source).toMatch(/\{secondsRemaining > 0 \? `Starting in \$\{secondsRemaining\}…` : 'Starting now…'\}/);
  });
});

describe('PreparationCountdown.jsx — no animation added, so nothing needs gating behind Reduced Motion; the number stays clear either way', () => {
  it('carries no pulse/ping/animation classes on the new card or glow - a static shadow only, per the explicit "no distracting glow animation" requirement', () => {
    expect(source).not.toMatch(/animate-pulse|animate-ping|animate-bounce|@keyframes/);
  });
});

describe('PreparationCountdown.jsx — functional contract (timing/skip/audio-unlock) is completely untouched by the restyle', () => {
  it('still accepts exactly the same props: secondsRemaining, cue, onSkip, accent', () => {
    expect(source).toMatch(/export const PreparationCountdown = \(\{ secondsRemaining, cue, onSkip, accent = 'primary' \}\) => \{/);
  });

  it('onSkip is still the one and only action wired to the "Start now" button - no new handler, no navigation of its own', () => {
    expect(source).toMatch(/onClick=\{onSkip\}/);
    expect(source).not.toMatch(/navigate\(/);
  });

  it('role="status" aria-live="polite" is preserved for assistive tech', () => {
    expect(source).toMatch(/role="status" aria-live="polite"/);
  });
});
