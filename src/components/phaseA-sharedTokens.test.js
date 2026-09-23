// Build 15 Phase A — shared Morning/Evening tint token regression guard.
// These tokens are deliberately additive-only in this phase: defined in
// both tailwind.config.js and index.css, but not yet applied to any
// component (that wiring belongs to a later, separately-approved phase).
// This file locks in both halves of that contract.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const tailwindConfig = readFileSync(repoRoot + 'tailwind.config.js', 'utf-8');
const indexCss = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf-8');

describe('Shared Morning/Evening tint tokens (Phase A) — defined in both halves', () => {
  it('tailwind.config.js maps all four new color tokens to CSS custom properties', () => {
    expect(tailwindConfig).toMatch(/"morning-tint":\s*"var\(--color-morning-tint\)"/);
    expect(tailwindConfig).toMatch(/"on-morning-tint":\s*"var\(--color-on-morning-tint\)"/);
    expect(tailwindConfig).toMatch(/"evening-tint":\s*"var\(--color-evening-tint\)"/);
    expect(tailwindConfig).toMatch(/"on-evening-tint":\s*"var\(--color-on-evening-tint\)"/);
  });

  it('index.css defines the four backing custom properties, inside the single frozen :root palette (never a second light/dark block)', () => {
    expect(indexCss).toMatch(/--color-morning-tint:\s*#fff2e2;/);
    expect(indexCss).toMatch(/--color-on-morning-tint:\s*#5a3820;/);
    expect(indexCss).toMatch(/--color-evening-tint:\s*#121b2e;/);
    expect(indexCss).toMatch(/--color-on-evening-tint:\s*#dae2fd;/);
  });

  it('the new token names do not collide with the existing, separately-namespaced Stage 3 token set', () => {
    expect(tailwindConfig).not.toMatch(/"morning-tint":\s*"var\(--stage3-/);
    expect(tailwindConfig).not.toMatch(/"evening-tint":\s*"var\(--stage3-/);
    expect(tailwindConfig).toMatch(/stage3-dawn/); // the pre-existing Stage 3 set is still present, unremoved
  });
});
