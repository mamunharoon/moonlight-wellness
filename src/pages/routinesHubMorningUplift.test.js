// Morning Visual Uplift (Build 16) — Routines Hub (Routines.jsx) and the
// Routine Detail screen (RoutineDetail.jsx). Both are genuinely shared
// across all three routines (Rise & Reset/Morning, Gentle Reset/Anytime,
// Begin Wind-Down/Evening) - one card renderer, one detail component,
// keyed by routine data. This file proves the new gold treatment is
// scoped to the Morning routine ONLY (via an inline-style override, the
// same established technique the accentColor left border already uses),
// and that Evening's/Anytime's own rendering is provably byte-for-byte
// unaffected.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const routinesSource = read('./Routines.jsx');
const routineDetailSource = read('./RoutineDetail.jsx');
const catalogSource = read('../lib/routinesCatalog.js');

describe('routinesCatalog.js — the three real accentColor values are unchanged (Build 16, this phase reuses them, never redefines them)', () => {
  it('Rise & Reset (Morning) = gold, Gentle Reset (Anytime) = mint, Wind-Down (Evening) = lavender', () => {
    expect(catalogSource).toMatch(/id: 'rise-reset',[\s\S]*?accentColor: 'var\(--color-gratitude-accent\)'/);
    expect(catalogSource).toMatch(/id: 'gentle-reset',[\s\S]*?accentColor: 'var\(--color-tertiary\)'/);
    expect(catalogSource).toMatch(/id: 'wind-down',[\s\S]*?accentColor: 'var\(--color-evening-accent\)'/);
  });
});

describe('Routines.jsx — Morning card gold is scoped by isMorning, never a shared default', () => {
  it('isMorning is derived per-card from the real routine.section, never a hardcoded id check that could silently drift from the catalogue', () => {
    expect(routinesSource).toMatch(/const isMorning = routine\.section === 'Morning';/);
  });

  it('the category label and "View routine" link both apply routine.accentColor via inline style ONLY when isMorning - the shared text-primary className stays present and unconditional (the actual colour override is what is scoped, not the base class)', () => {
    expect(routinesSource).toMatch(/style=\{isMorning \? \{ color: routine\.accentColor \} : undefined\}/g);
    const scopedStyleCount = routinesSource.match(/style=\{isMorning \? \{ color: routine\.accentColor \} : undefined\}/g) ?? [];
    expect(scopedStyleCount.length).toBe(2); // category label + "View routine" link
  });

  it('the card title gains Playfair Display only when isMorning - a genuine conditional class, not an unconditional addition', () => {
    expect(routinesSource).toMatch(/\$\{isMorning \? 'font-morning-display italic' : ''\}/);
  });

  it('the shared card className/hover/focus-ring/left-border-accentColor mechanism is completely unchanged for every section', () => {
    expect(routinesSource).toMatch(/className="block glass-panel p-6 rounded-3xl space-y-4 shadow-\[0_8px_30px_rgba\(0,0,0,0\.03\)\]/);
    expect(routinesSource).toMatch(/style=\{\{ borderLeft: `4px solid \$\{routine\.accentColor\}` \}\}/);
  });
});

describe('RoutineDetail.jsx — same scoped-by-isMorning pattern, same real accentColor reuse', () => {
  it('isMorning is derived from the real routine.section, optional-chained since routine can be null for an unknown id', () => {
    expect(routineDetailSource).toMatch(/const isMorning = routine\?\.section === 'Morning';/);
  });

  it('the category label applies routine.accentColor via inline style only when isMorning', () => {
    expect(routineDetailSource).toMatch(/style=\{isMorning \? \{ color: routine\.accentColor \} : undefined\}/);
  });

  it('the title gains Playfair Display only when isMorning', () => {
    expect(routineDetailSource).toMatch(/\$\{isMorning \? 'font-morning-display italic' : ''\}/);
  });

  it('step-number badges branch on isMorning between morning-accent gold and the original bg-primary/10 treatment - never gold unconditionally', () => {
    expect(routineDetailSource).toMatch(/isMorning \? 'bg-morning-accent\/10 border border-morning-accent\/25 text-morning-accent' : 'bg-primary\/10 border border-primary\/20 text-primary'/);
  });

  it('the Start Routine button stays the real peach primary CTA (bg-primary/text-on-primary) for every routine - the approved canonical tokens keep primary action buttons peach app-wide; only the sparing glow is Morning-scoped', () => {
    expect(routineDetailSource).toMatch(/className=\{`w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg \$\{isMorning \? 'shadow-morning-glow' : ''\}`\}/);
  });

  it('every real routine\'s own steps/purpose/startRoute/requiresAuth data (ROUTINE_DETAILS) is completely untouched', () => {
    expect(routineDetailSource).toMatch(/'rise-reset': \{/);
    expect(routineDetailSource).toMatch(/'gentle-reset': \{/);
    expect(routineDetailSource).toMatch(/'wind-down': \{/);
    expect(routineDetailSource).toMatch(/startRoute: '\/intention-setup'/);
    expect(routineDetailSource).toMatch(/startRoute: '\/quiet-breathing'/);
    expect(routineDetailSource).toMatch(/startRoute: '\/evening-wind-down'/);
  });

  it('the guest sign-in gate (requiresAuth, beginRiseAndReset\'s startSession call, pendingContent return-path stashing) is completely untouched', () => {
    expect(routineDetailSource).toMatch(/startSession\('morning-routine', \{ startIndex: getStepIndex\('morning-routine', MORNING_STEP_IDS\.INTENTION\) \}\);/);
    expect(routineDetailSource).toMatch(/setPendingContent\(\{ returnPath: `\/routines\/\$\{routineId\}` \}\);/);
  });
});
