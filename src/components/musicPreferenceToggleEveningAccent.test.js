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

describe('MusicPreferenceToggle — no page passes accent="evening" any more', () => {
  // Evening Visual Uplift (Phase 7) — EveningBreathing.jsx no longer
  // renders MusicPreferenceToggle at all, mirroring Breathe.jsx/
  // MorningFlow.jsx's own earlier Phase 6 switch to the compact
  // CompactSoundControl (journeyTone="evening") - see
  // musicPreferenceToggleSharedConsumers.test.js's own updated coverage
  // and CompactSoundControl.test.js. The 'evening' token itself stays
  // defined in MusicPreferenceToggle.jsx (kept, just no longer consumed
  // by any real page today) - see the describe block above.
  it('EveningBreathing.jsx no longer imports or renders MusicPreferenceToggle - replaced by CompactSoundControl journeyTone="evening"', () => {
    expect(eveningBreathingSource).not.toMatch(/import \{ MusicPreferenceToggle \} from '\.\.\/components\/MusicPreferenceToggle';/);
    expect(eveningBreathingSource).not.toMatch(/<MusicPreferenceToggle/);
    expect(eveningBreathingSource).toMatch(/import \{ CompactSoundControl \} from '\.\.\/components\/CompactSoundControl';/);
    expect(eveningBreathingSource).toMatch(/<CompactSoundControl isOn=\{musicPreferenceOn\} onToggle=\{handleToggleMusicPreference\} journeyTone="evening" \/>/);
  });

  // Anytime Visual Flow and Closing Handoff uplift (Part 7) —
  // QuietBreathing.jsx's standalone branch now also renders
  // CompactSoundControl (with the dynamic journeyTone={journeyTone}, never
  // a hardcoded literal) instead of MusicPreferenceToggle, mirroring
  // Breathe.jsx's/MorningFlow.jsx's/EveningBreathing.jsx's own equivalent
  // switch. MusicPreferenceToggle is no longer rendered anywhere in this
  // file at all (its own non-standalone/Support-embedded branch has never
  // used it directly - that gate is MusicEntryChoice.jsx).
  it('QuietBreathing.jsx no longer renders MusicPreferenceToggle at all - replaced by CompactSoundControl journeyTone={journeyTone}, never a hardcoded "evening"/"anytime" literal', () => {
    const callSite = quietBreathingSource.match(/<MusicPreferenceToggle[\s\S]{0,400}\/>/)?.[0] ?? '';
    expect(callSite).toBe('');
    expect(quietBreathingSource).toMatch(/<CompactSoundControl isOn=\{musicPreferenceOn\} onToggle=\{handleToggleMusicPreference\} journeyTone=\{journeyTone\} \/>/);
  });

  it('Breathe.jsx and MorningFlow.jsx (Morning) no longer render MusicPreferenceToggle at all (Morning Visual Uplift, Phase 6: replaced by CompactSoundControl journeyTone="morning") - never "evening" either way', () => {
    for (const source of [breatheSource, morningFlowSource]) {
      const callSite = source.match(/<MusicPreferenceToggle[\s\S]{0,400}\/>/)?.[0] ?? '';
      expect(callSite).toBe('');
      expect(source).toMatch(/<CompactSoundControl isOn=\{musicPreferenceOn\} onToggle=\{handleToggleMusicPreference\} journeyTone="morning" \/>/);
    }
  });
});
