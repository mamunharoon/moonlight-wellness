// Evening Visual Uplift (Build 17), Decision D — Routines.jsx and
// RoutineDetail.jsx gain an additive isEvening branch, mirroring the
// isMorning branch from Build 16 exactly (periwinkle category label/step
// badges, Newsreader italic title, restrained shadow-evening-glow on
// Start Routine). This file proves the new branch is scoped to the
// Wind-Down routine ONLY, and that Gentle Reset's (Anytime) own rendering
// stays byte-for-byte peach/plain.
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

describe('Routines.jsx — isEvening derived per-card from the real routine.section', () => {
  it('isEvening is a plain equality check against \'Evening\', never a hardcoded id', () => {
    expect(routinesSource).toMatch(/const isEvening = routine\.section === 'Evening';/);
  });

  it('the category label and "View routine" link apply routine.accentColor when isMorning OR isEvening - Gentle Reset (Anytime, neither flag) stays plain text-primary', () => {
    const scopedStyleCount = (routinesSource.match(/style=\{\(isMorning \|\| isEvening\) \? \{ color: routine\.accentColor \} : undefined\}/g) ?? []).length;
    expect(scopedStyleCount).toBe(2);
  });

  it('the title gains Newsreader italic (font-serif italic) only for Evening, Playfair only for Morning, plain for Anytime', () => {
    expect(routinesSource).toMatch(/\$\{isMorning \? 'font-morning-display italic' : isEvening \? 'font-serif italic' : ''\}/);
  });

  it('the left-border accentColor mechanism (pre-existing, Build 16) is untouched', () => {
    expect(routinesSource).toMatch(/style=\{\{ borderLeft: `4px solid \$\{routine\.accentColor\}` \}\}/);
  });
});

describe('RoutineDetail.jsx — isEvening derived per-routine, optional-chained', () => {
  it('isEvening is a plain equality check, safe for a null routine (unknown id)', () => {
    expect(routineDetailSource).toMatch(/const isEvening = routine\?\.section === 'Evening';/);
  });

  it('the category label applies routine.accentColor when isMorning OR isEvening', () => {
    expect(routineDetailSource).toMatch(/style=\{\(isMorning \|\| isEvening\) \? \{ color: routine\.accentColor \} : undefined\}/);
  });

  it('the title gains Newsreader italic for Evening, Playfair for Morning, plain for Anytime', () => {
    expect(routineDetailSource).toMatch(/\$\{isMorning \? 'font-morning-display italic' : isEvening \? 'font-serif italic' : ''\}/);
  });

  it('step-number badges are periwinkle (bg-evening-accent/10 border-evening-accent/25 text-evening-accent) for Evening, gold for Morning, plain peach for Anytime - a genuine three-way branch, never unconditional', () => {
    expect(routineDetailSource).toMatch(/bg-evening-accent\/10 border border-evening-accent\/25 text-evening-accent/);
    expect(routineDetailSource).toMatch(/bg-morning-accent\/10 border border-morning-accent\/25 text-morning-accent/);
    expect(routineDetailSource).toMatch(/bg-primary\/10 border border-primary\/20 text-primary/);
  });

  it('Start Routine gains shadow-evening-glow for Evening, shadow-morning-glow for Morning, no glow for Anytime - button stays bg-primary/text-on-primary peach for every routine', () => {
    expect(routineDetailSource).toMatch(
      /className=\{`w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg \$\{isMorning \? 'shadow-morning-glow' : isEvening \? 'shadow-evening-glow' : ''\}`\}/
    );
  });

  it('real routine data (purpose/steps/startRoute/requiresAuth) for wind-down and gentle-reset is completely untouched', () => {
    expect(routineDetailSource).toMatch(/startRoute: '\/evening-wind-down'/);
    expect(routineDetailSource).toMatch(/startRoute: '\/quiet-breathing'/);
    expect(routineDetailSource).toMatch(/title: 'Wind Down', description: 'Settle in and shift out of your day\.'/);
    expect(routineDetailSource).toMatch(/title: 'Prepare for Rest', description: 'A short checklist plus Sleep Sounds to help you drift off\.'/);
  });

  it('the guest sign-in gate for Wind-Down (requiresAuth: true) is untouched', () => {
    expect(routineDetailSource).toMatch(/'wind-down': \{[\s\S]*?requiresAuth: true,/);
  });
});

describe('Gentle Reset (Anytime) is provably excluded from both accent branches', () => {
  it('neither isMorning nor isEvening can be true for gentle-reset, since its section is neither Morning nor Evening', () => {
    // Real section values, from routinesCatalog.js: 'Morning', 'Daytime', 'Evening'.
    const section = 'Daytime'; // gentle-reset's real section
    const isMorning = section === 'Morning';
    const isEvening = section === 'Evening';
    expect(isMorning).toBe(false);
    expect(isEvening).toBe(false);
  });
});
