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
const journeyToneSource = read('../lib/journeyTone.js');
const breatheSource = read('../pages/Breathe.jsx');
const eveningBreathingSource = read('../pages/EveningBreathing.jsx');
const quietBreathingSource = read('../pages/QuietBreathing.jsx');
const selfGuidedMeditationSource = read('../pages/SelfGuidedMeditation.jsx');

describe('BreathingPatternRow — default behaviour is genuinely unchanged', () => {
  // Context-aware Meditation/Breathing theming — the token object itself
  // moved to the shared journeyTone.js file (so Meditation's own controls
  // can reuse it too), leaving only `const ACCENT_TOKENS = JOURNEY_TONE_TOKENS;`
  // here - same values, same behaviour, verified against the new file.
  it('imports the shared token set rather than defining its own copy', () => {
    expect(componentSource).toMatch(/import \{ JOURNEY_TONE_TOKENS \} from '\.\.\/lib\/journeyTone';/);
    expect(componentSource).toMatch(/const ACCENT_TOKENS = JOURNEY_TONE_TOKENS;/);
  });

  it('accent still defaults to \'primary\' when omitted, and the primary token set is byte-identical to before this phase', () => {
    expect(componentSource).toMatch(/accent = 'primary'/);
    expect(journeyToneSource).toMatch(
      /primary: \{\s*\n\s*selectedRow: 'bg-primary\/10 border-primary',\s*\n\s*unselectedRow: 'bg-surface-container border-primary\/50 hover:bg-white\/10',\s*\n\s*selectedLabel: 'text-primary font-bold',\s*\n\s*selectedRing: 'border-primary bg-primary',\s*\n\s*unselectedRing: 'border-primary bg-surface-container-lowest',\s*\n\s*dot: 'bg-on-primary',\s*\n\s*focusRing: 'has-\[:focus-visible\]:ring-primary'/
    );
  });

  // WakeWise DEV — journey-aware primary action colour: `selectedRow` for
  // both 'evening' and 'morning' was later fixed to use the alpha-safe
  // `-tint` RGB-triplet tokens instead of a `/10` opacity modifier
  // directly on the plain-hex accent token - the original values this
  // test pinned had the exact same "resolves to fully transparent" bug
  // JourneyGlow.jsx's own doc comment documents, so this is a genuine
  // fix, not a regression. `primary`'s own identical `bg-primary/10` is
  // left untouched (a separately-scoped, pre-existing issue) - see the
  // 'primary' test above, still byte-identical.
  it('the \'evening\' token set uses the alpha-safe evening-accent-tint for its selectedRow background, fixing the same opacity-on-hex-var gap the primary token still has', () => {
    expect(journeyToneSource).toMatch(
      /evening: \{\s*\n\s*selectedRow: 'bg-evening-accent-tint\/10 border-evening-accent',\s*\n\s*unselectedRow: 'bg-surface-container border-evening-accent\/55 hover:bg-white\/10',\s*\n\s*selectedLabel: 'text-evening-accent font-bold',\s*\n\s*selectedRing: 'border-evening-accent bg-evening-accent',\s*\n\s*unselectedRing: 'border-evening-accent bg-surface-container-lowest',\s*\n\s*dot: 'bg-on-evening-accent',\s*\n\s*focusRing: 'has-\[:focus-visible\]:ring-evening-accent'/
    );
  });

  it('the \'morning\' entry reuses the already-verified morning-accent/on-morning-accent tokens (via the alpha-safe morning-accent-tint for selectedRow) - never a new colour', () => {
    expect(journeyToneSource).toMatch(/morning: \{/);
    expect(journeyToneSource).toMatch(/selectedRow: 'bg-morning-accent-tint\/10 border-morning-accent'/);
    expect(journeyToneSource).toMatch(/dot: 'bg-on-morning-accent'/);
  });

  it('a genuinely new \'anytime\' entry exists, reusing the already-verified tertiary/on-tertiary mint tokens (via the alpha-safe tertiary-tint for selectedRow) - never a new colour', () => {
    expect(journeyToneSource).toMatch(/anytime: \{/);
    expect(journeyToneSource).toMatch(/selectedRow: 'bg-tertiary-tint\/10 border-tertiary'/);
    expect(journeyToneSource).toMatch(/dot: 'bg-on-tertiary'/);
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
    const callSite = breatheSource.match(/<BreathingPatternRow[\s\S]*?\/>/)?.[0] ?? '';
    expect(callSite).toMatch(/accent="morning"/);
  });

  it('EveningBreathing.jsx never passes accent="morning" to BreathingPatternRow - its own call keeps its existing accent="evening"', () => {
    const callSite = eveningBreathingSource.match(/<BreathingPatternRow[\s\S]*?\/>/)?.[0] ?? '';
    expect(callSite).not.toMatch(/accent="morning"/);
    expect(callSite).toMatch(/accent="evening"/);
  });

  // Context-aware Meditation/Breathing theming — QuietBreathing.jsx's
  // standalone branch no longer passes a hardcoded accent="anytime"
  // literal; it now passes the dynamically-resolved journeyTone (see
  // usePracticeJourneyTone.js), which inherits Morning/Anytime/Evening
  // from whatever launched this standalone practice rather than always
  // being mint.
  it('QuietBreathing.jsx\'s standalone branch passes the dynamic accent={journeyTone}, never a hardcoded literal', () => {
    const callSite = quietBreathingSource.match(/<BreathingPatternRow[\s\S]*?\/>/)?.[0] ?? '';
    expect(callSite).not.toMatch(/accent="morning"/);
    expect(callSite).not.toMatch(/accent="anytime"/);
    expect(callSite).toMatch(/accent=\{journeyTone\}/);
  });
});
