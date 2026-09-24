// Morning Visual Uplift (Build 16) — BreathingPatternRow shared-component
// safety guard. BreathingPatternRow already had an additive `accent` prop
// (default 'primary', an existing 'evening' value) before this phase;
// this phase adds a third value, 'morning', consumed ONLY by Breathe.jsx
// (the real Morning mindful-breathing screen). This file exists to prove
// Evening's and Anytime's own callers are byte-for-byte unaffected - the
// exact regression coverage requested for every shared component this
// uplift touches.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const componentSource = read('./BreathingPatternRow.jsx');
const breatheSource = read('../pages/Breathe.jsx');
const eveningBreathingSource = read('../pages/EveningBreathing.jsx');
const quietBreathingSource = read('../pages/QuietBreathing.jsx');
const selfGuidedMeditationSource = read('../pages/SelfGuidedMeditation.jsx');

describe('BreathingPatternRow — default behaviour is genuinely unchanged', () => {
  it('accent still defaults to \'primary\' when omitted, and the primary token set is byte-identical to before this phase', () => {
    expect(componentSource).toMatch(/accent = 'primary'/);
    expect(componentSource).toMatch(
      /primary: \{\s*\n\s*selectedRow: 'bg-primary\/10 border-primary',\s*\n\s*unselectedRow: 'bg-surface-container border-primary\/50 hover:bg-white\/10',\s*\n\s*selectedLabel: 'text-primary font-bold',\s*\n\s*selectedRing: 'border-primary bg-primary',\s*\n\s*unselectedRing: 'border-primary bg-surface-container-lowest',\s*\n\s*dot: 'bg-on-primary',\s*\n\s*focusRing: 'has-\[:focus-visible\]:ring-primary'\s*\n\s*\}/
    );
  });

  it('the pre-existing \'evening\' token set is also byte-identical to before this phase - the new \'morning\' entry was purely additive', () => {
    expect(componentSource).toMatch(
      /evening: \{\s*\n\s*selectedRow: 'bg-evening-accent\/10 border-evening-accent',\s*\n\s*unselectedRow: 'bg-surface-container border-evening-accent\/55 hover:bg-white\/10',\s*\n\s*selectedLabel: 'text-evening-accent font-bold',\s*\n\s*selectedRing: 'border-evening-accent bg-evening-accent',\s*\n\s*unselectedRing: 'border-evening-accent bg-surface-container-lowest',\s*\n\s*dot: 'bg-on-evening-accent',\s*\n\s*focusRing: 'has-\[:focus-visible\]:ring-evening-accent'\s*\n\s*\}/
    );
  });

  it('a genuinely new \'morning\' entry exists, reusing the already-verified morning-accent/on-morning-accent tokens - never a new colour', () => {
    expect(componentSource).toMatch(/morning: \{/);
    expect(componentSource).toMatch(/selectedRow: 'bg-morning-accent\/10 border-morning-accent'/);
    expect(componentSource).toMatch(/dot: 'bg-on-morning-accent'/);
  });
});

describe('BreathingPatternRow — real consumer inventory (verified by import + JSX render, not comment mentions)', () => {
  it('Breathe.jsx (Morning), EveningBreathing.jsx, and QuietBreathing.jsx (Anytime) all really import and render BreathingPatternRow', () => {
    for (const source of [breatheSource, eveningBreathingSource, quietBreathingSource]) {
      expect(source).toMatch(/import \{ BreathingPatternRow \} from '\.\.\/components\/BreathingPatternRow';/);
      expect(source).toMatch(/<BreathingPatternRow/);
    }
  });

  it('SelfGuidedMeditation.jsx only MENTIONS BreathingPatternRow in a doc comment (explaining why it deliberately does NOT reuse it) - it never imports or renders the real component, so this phase\'s change cannot affect it', () => {
    expect(selfGuidedMeditationSource).not.toMatch(/^import \{ BreathingPatternRow \}/m);
    expect(selfGuidedMeditationSource).not.toMatch(/<BreathingPatternRow/);
  });
});

describe('BreathingPatternRow — only Breathe.jsx (Morning) passes accent="morning"', () => {
  it('Breathe.jsx\'s own call site passes accent="morning"', () => {
    const callSite = breatheSource.match(/<BreathingPatternRow[\s\S]{0,300}\/>/)?.[0] ?? '';
    expect(callSite).toMatch(/accent="morning"/);
  });

  it('EveningBreathing.jsx never passes accent="morning" to BreathingPatternRow - its own call keeps its existing accent="evening"', () => {
    const callSite = eveningBreathingSource.match(/<BreathingPatternRow[\s\S]{0,300}\/>/)?.[0] ?? '';
    expect(callSite).not.toMatch(/accent="morning"/);
    expect(callSite).toMatch(/accent="evening"/);
  });

  it('QuietBreathing.jsx (Anytime) never passes an accent prop to BreathingPatternRow either - it keeps the default \'primary\' peach', () => {
    const callSite = quietBreathingSource.match(/<BreathingPatternRow[\s\S]{0,300}\/>/)?.[0] ?? '';
    expect(callSite).not.toMatch(/accent="morning"/);
    expect(callSite).not.toMatch(/accent=/);
  });
});
