// Evening Visual Uplift (Build 17) — MusicPreferenceToggle's new 'evening'
// accent, wired only into EveningBreathing.jsx's real call site. Extends
// (never duplicates) musicPreferenceToggleSharedConsumers.test.js's own
// Morning-focused coverage.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const componentSource = read('./MusicPreferenceToggle.jsx');
const eveningBreathingSource = read('../pages/EveningBreathing.jsx');
const quietBreathingSource = read('../pages/QuietBreathing.jsx');
const breatheSource = read('../pages/Breathe.jsx');
const morningFlowSource = read('../pages/MorningFlow.jsx');

describe('MusicPreferenceToggle — a genuinely new \'evening\' entry exists, reusing the already-verified evening-accent token', () => {
  it('the evening token reuses bg-evening-accent/border-evening-accent/focus-visible:ring-evening-accent, never a new colour', () => {
    expect(componentSource).toMatch(
      /evening: \{ track: 'bg-evening-accent', knobBorder: 'border-evening-accent', focusRing: 'focus-visible:ring-evening-accent' \}/
    );
  });

  it('the primary default and morning entry from Build 16 are completely untouched', () => {
    expect(componentSource).toMatch(
      /primary: \{ track: 'bg-primary', knobBorder: 'border-primary', focusRing: 'focus-visible:ring-primary' \}/
    );
    expect(componentSource).toMatch(
      /morning: \{ track: 'bg-morning-accent', knobBorder: 'border-morning-accent', focusRing: 'focus-visible:ring-morning-accent' \}/
    );
  });

  it('the On/Off text label and aria-checked still derive directly from the same real `isOn` boolean, regardless of accent', () => {
    expect(componentSource).toMatch(/\{isOn \? 'On' : 'Off'\}/);
    expect(componentSource).toMatch(/aria-checked=\{isOn\}/);
  });
});

describe('MusicPreferenceToggle — only EveningBreathing.jsx passes accent="evening"', () => {
  it('EveningBreathing.jsx\'s own call site passes accent="evening"', () => {
    const callSite = eveningBreathingSource.match(/<MusicPreferenceToggle[\s\S]{0,400}\/>/)?.[0] ?? '';
    expect(callSite).toMatch(/accent="evening"/);
  });

  // WakeWise DEV — journey-aware primary action colour: QuietBreathing.jsx's
  // standalone branch now explicitly passes accent="anytime" instead of
  // omitting the prop and silently getting the generic peach.
  it('QuietBreathing.jsx (Anytime) passes accent="anytime", never "evening"', () => {
    const callSite = quietBreathingSource.match(/<MusicPreferenceToggle[\s\S]{0,400}\/>/)?.[0] ?? '';
    expect(callSite).not.toMatch(/accent="evening"/);
    expect(callSite).toMatch(/accent="anytime"/);
  });

  it('Breathe.jsx and MorningFlow.jsx (Morning) still pass accent="morning", never "evening"', () => {
    for (const source of [breatheSource, morningFlowSource]) {
      const callSite = source.match(/<MusicPreferenceToggle[\s\S]{0,400}\/>/)?.[0] ?? '';
      expect(callSite).toMatch(/accent="morning"/);
      expect(callSite).not.toMatch(/accent="evening"/);
    }
  });
});
