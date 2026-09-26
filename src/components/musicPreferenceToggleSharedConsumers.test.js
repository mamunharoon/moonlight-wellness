// Morning Visual Uplift (Build 16) — MusicPreferenceToggle shared-component
// safety guard. This phase adds an additive `accent` prop (default
// 'primary', byte-identical to before), consumed with `accent="morning"`
// ONLY by Breathe.jsx and MorningFlow.jsx (the two real Morning pre-start
// screens). This file proves Anytime's own caller is byte-for-byte
// unaffected.
//
// Evening Visual Uplift (Build 17) — EveningBreathing.jsx now legitimately
// passes accent="evening" (see musicPreferenceToggleEveningAccent.test.js
// for that arm's own dedicated coverage); the assertion below was updated
// to match, since the old "no accent prop at all" expectation is no
// longer this file's real behaviour.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const componentSource = read('./MusicPreferenceToggle.jsx');
const breatheSource = read('../pages/Breathe.jsx');
const morningFlowSource = read('../pages/MorningFlow.jsx');
const eveningBreathingSource = read('../pages/EveningBreathing.jsx');
const quietBreathingSource = read('../pages/QuietBreathing.jsx');

describe('MusicPreferenceToggle — default behaviour is genuinely unchanged', () => {
  it('accent still defaults to \'primary\' when omitted, and the primary token set reproduces the exact original bg-primary/border-primary/focus-visible:ring-primary values', () => {
    expect(componentSource).toMatch(/accent = 'primary'/);
    expect(componentSource).toMatch(
      /primary: \{ track: 'bg-primary', knobBorder: 'border-primary', focusRing: 'focus-visible:ring-primary' \}/
    );
  });

  it('a genuinely new \'morning\' entry exists, reusing the already-verified morning-accent token - never a new colour', () => {
    expect(componentSource).toMatch(
      /morning: \{ track: 'bg-morning-accent', knobBorder: 'border-morning-accent', focusRing: 'focus-visible:ring-morning-accent' \}/
    );
  });

  it('the OFF track (bg-outline) is completely independent of accent - both tokens only ever affect the ON state', () => {
    expect(componentSource).toMatch(/isOn \? tokens\.track : 'bg-outline'/);
  });

  it('the On/Off text label and aria-checked still derive directly from the same real `isOn` boolean, regardless of accent - the switch can never visually disagree with its own label', () => {
    expect(componentSource).toMatch(/\{isOn \? 'On' : 'Off'\}/);
    expect(componentSource).toMatch(/aria-checked=\{isOn\}/);
    expect(componentSource).toMatch(/isOn \? tokens\.track : 'bg-outline'/);
    expect(componentSource).toMatch(/isOn \? 'translate-x-5' : 'translate-x-0'/);
  });
});

describe('MusicPreferenceToggle — real consumer inventory', () => {
  it('Breathe.jsx, MorningFlow.jsx (Morning), EveningBreathing.jsx, and QuietBreathing.jsx (Anytime) all import and render MusicPreferenceToggle', () => {
    for (const source of [breatheSource, morningFlowSource, eveningBreathingSource, quietBreathingSource]) {
      expect(source).toMatch(/import \{ MusicPreferenceToggle \} from '\.\.\/components\/MusicPreferenceToggle';/);
      expect(source).toMatch(/<MusicPreferenceToggle/);
    }
  });
});

describe('MusicPreferenceToggle — only Breathe.jsx and MorningFlow.jsx (Morning) pass accent="morning"', () => {
  it('Breathe.jsx\'s own call site passes accent="morning"', () => {
    const callSite = breatheSource.match(/<MusicPreferenceToggle[\s\S]{0,400}\/>/)?.[0] ?? '';
    expect(callSite).toMatch(/accent="morning"/);
  });

  it('MorningFlow.jsx\'s own call site passes accent="morning"', () => {
    const callSite = morningFlowSource.match(/<MusicPreferenceToggle[\s\S]{0,400}\/>/)?.[0] ?? '';
    expect(callSite).toMatch(/accent="morning"/);
  });

  it('EveningBreathing.jsx passes accent="evening" (Build 17), never "morning"', () => {
    const callSite = eveningBreathingSource.match(/<MusicPreferenceToggle[\s\S]{0,400}\/>/)?.[0] ?? '';
    expect(callSite).not.toMatch(/accent="morning"/);
    expect(callSite).toMatch(/accent="evening"/);
  });

  // WakeWise DEV — journey-aware primary action colour: QuietBreathing.jsx's
  // standalone branch now explicitly passes accent="anytime" instead of
  // omitting the prop and silently getting the generic peach.
  it('QuietBreathing.jsx (Anytime) passes accent="anytime" to MusicPreferenceToggle, never "morning"', () => {
    const callSite = quietBreathingSource.match(/<MusicPreferenceToggle[\s\S]{0,400}\/>/)?.[0] ?? '';
    expect(callSite).not.toMatch(/accent="morning"/);
    expect(callSite).toMatch(/accent="anytime"/);
  });
});
