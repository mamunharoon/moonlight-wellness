// Routines Hub — Circadian Colors accent regression guard (Build 16).
// No DOM/component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks, matching
// every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROUTINES } from '../lib/routinesCatalog';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const routinesSource = read('./Routines.jsx');

describe('Routines Hub — Circadian Colors accent border applied via inline style, not a border-l-* Tailwind class', () => {
  it('routinesCatalog.js exposes accentColor as a raw CSS custom-property reference, never a Tailwind class string', () => {
    for (const routine of ROUTINES) {
      expect(routine.accentColor).toMatch(/^var\(--color-[a-z-]+\)$/);
    }
    expect(ROUTINES.find((r) => r.id === 'rise-reset').accentColor).toBe('var(--color-gratitude-accent)');
    expect(ROUTINES.find((r) => r.id === 'gentle-reset').accentColor).toBe('var(--color-tertiary)');
    expect(ROUTINES.find((r) => r.id === 'wind-down').accentColor).toBe('var(--color-evening-accent)');
  });

  it('Routines.jsx applies it via an inline style, not a border-l-* class - a border-l-* class is silently overridden by .glass-panel\'s own plain-CSS border shorthand (found live: both width and color reverted to the neutral 1px default)', () => {
    expect(routinesSource).toMatch(/style=\{\{ borderLeft: `4px solid \$\{routine\.accentColor\}` \}\}/);
    expect(routinesSource).not.toMatch(/border-l-4 \$\{routine\.accent\}/);
    expect(routinesSource).not.toMatch(/border-l-morning-accent|border-l-tertiary|border-l-evening-accent/);
  });

  it('the className itself no longer carries a border-l-4 utility (the inline style owns the full border-left shorthand instead)', () => {
    const classNameMatch = routinesSource.match(/className="block glass-panel[^"]*"/);
    expect(classNameMatch).not.toBeNull();
    expect(classNameMatch[0]).not.toMatch(/border-l-/);
  });
});
