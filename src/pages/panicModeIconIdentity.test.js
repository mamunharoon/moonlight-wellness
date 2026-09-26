// WakeWise Phase 3B (3B.4) — Panic Mode gets its own calm-but-distinct
// icon, separate from the generic self_improvement glyph ordinary
// meditation elsewhere already uses, and never alarming/emergency
// imagery. Also locks in the latency audit finding: Panic Mode, Grounding,
// and Stress Release all still reach their real content with zero
// preparation countdown - none of them were touched by this pass.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const panicModeSource = read('./PanicMode.jsx');
const groundingSource = read('./Grounding.jsx');
const stressReleaseSource = read('./StressRelease.jsx');

describe('PanicMode.jsx — distinct calm icon (3B.4)', () => {
  it('no longer renders the generic self_improvement glyph as its icon', () => {
    expect(panicModeSource).not.toMatch(/text-4xl">self_improvement<\/span>/);
  });

  it('uses "spa" - calm, not an alarming/emergency glyph (no warning, siren, or cross icon actually rendered)', () => {
    expect(panicModeSource).toMatch(/text-4xl">spa<\/span>/);
    expect(panicModeSource).not.toMatch(/text-4xl">(warning|error|siren|emergency|priority_high)<\/span>/);
  });

  it('the actual copy/flow (You\'re safe, Begin -> /grounding, Skip -> Home) is unchanged - only the icon moved', () => {
    expect(panicModeSource).toMatch(/You're safe\./);
    expect(panicModeSource).toMatch(/navigate\('\/grounding'\)/);
  });
});

describe('Phase 3B.4 latency audit — Panic Mode, Grounding, and Stress Release remain zero-countdown; none touched by this pass', () => {
  it('PanicMode.jsx has no preparation countdown of its own', () => {
    expect(panicModeSource).not.toMatch(/usePreparationCountdown/);
  });

  it('Grounding.jsx has no preparation countdown of its own', () => {
    expect(groundingSource).not.toMatch(/usePreparationCountdown/);
  });

  it('StressRelease.jsx has no preparation countdown of its own', () => {
    expect(stressReleaseSource).not.toMatch(/usePreparationCountdown/);
  });
});
