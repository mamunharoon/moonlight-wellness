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

describe('MusicPreferenceToggle — real consumer inventory (Morning Visual Uplift Phase 6, Evening Visual Uplift Phase 7, then Anytime Visual Flow and Closing Handoff uplift: all four pre-start breathing screens now use the compact CompactSoundControl instead - see CompactSoundControl.test.js)', () => {
  it('Breathe.jsx, MorningFlow.jsx (Morning), EveningBreathing.jsx (Evening) and QuietBreathing.jsx\'s standalone branch (Anytime) no longer import or render MusicPreferenceToggle - each replaced by the compact CompactSoundControl in its own journeyTone', () => {
    for (const [source, tone] of [[breatheSource, 'morning'], [morningFlowSource, 'morning'], [eveningBreathingSource, 'evening'], [quietBreathingSource, '{journeyTone}']]) {
      expect(source).not.toMatch(/import \{ MusicPreferenceToggle \} from '\.\.\/components\/MusicPreferenceToggle';/);
      expect(source).not.toMatch(/<MusicPreferenceToggle/);
      expect(source).toMatch(/import \{ CompactSoundControl \} from '\.\.\/components\/CompactSoundControl';/);
      const toneAttr = tone === '{journeyTone}' ? 'journeyTone=\\{journeyTone\\}' : `journeyTone="${tone}"`;
      expect(source).toMatch(new RegExp(`<CompactSoundControl isOn=\\{musicPreferenceOn\\} onToggle=\\{handleToggleMusicPreference\\} ${toneAttr} \\/>`));
    }
  });
});

describe('MusicPreferenceToggle — no real caller remains in any of Morning/Evening/Anytime\'s standalone breathing screens', () => {
  it('QuietBreathing.jsx renders no MusicPreferenceToggle call site at all (its own non-standalone/Support-embedded branch has never used it directly - that gate is MusicEntryChoice.jsx)', () => {
    const callSite = quietBreathingSource.match(/<MusicPreferenceToggle[\s\S]{0,400}\/>/)?.[0] ?? '';
    expect(callSite).toBe('');
  });
});
