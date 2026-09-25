// Source-level regression guard for MeditationSetupPanel.jsx - the shared
// setup screen extracted from SelfGuidedMeditation.jsx (Journey Embedding,
// Phase 2). Covers both standalone's unchanged non-compact rendering and
// the new compact/expandable embedded presentation.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./MeditationSetupPanel.jsx', import.meta.url)), 'utf-8');

describe('MeditationSetupPanel — five styles, three durations, three sounds via the real data modules', () => {
  it('imports MEDITATION_STYLES/MEDITATION_DURATIONS/MEDITATION_SOUNDS - no second copy of the data', () => {
    expect(source).toMatch(/from '\.\.\/\.\.\/lib\/meditationStyles';/);
    expect(source).toMatch(/from '\.\.\/\.\.\/lib\/meditationDurations';/);
    expect(source).toMatch(/from '\.\.\/\.\.\/lib\/meditationSounds';/);
  });

  it('styles/durations/sounds each render via a single map (never a hand-duplicated list)', () => {
    // F6 — styles now map with an index too (idx), for the compact grid's
    // last-item-spans-full-width logic (MeditationStyleCard's fullWidth).
    expect(source).toMatch(/\{MEDITATION_STYLES\.map\(\(s, idx\) => \(/);
    expect(source).toMatch(/\{MEDITATION_DURATIONS\.map\(\(d\) => \(/);
    expect(source).toMatch(/\{MEDITATION_SOUNDS\.map\(\(s\) => \(/);
  });

  it('reuses the shared MeditationOptionRow/MeditationDurationChip/MeditationStyleCard controls, never a second radio implementation', () => {
    expect(source).toMatch(/import \{ MeditationOptionRow, MeditationDurationChip, MeditationStyleCard \} from '\.\/MeditationControls';/);
  });
});

describe('MeditationSetupPanel — accessible radiogroups', () => {
  it('all three groups use role="radiogroup" with a real native <input type="radio"> (inside MeditationControls.jsx)', () => {
    expect(source).toMatch(/role="radiogroup" aria-label="Meditation style"/);
    expect(source).toMatch(/role="radiogroup" aria-label="Duration"/);
    expect(source).toMatch(/role="radiogroup" aria-label="Choose your sound"/);
  });
});

describe('MeditationSetupPanel — Recommended badge is context-driven, never the shared registry\'s own fixed flag', () => {
  it('the duration chip sublabel compares against the recommendedDurationId PROP, never MEDITATION_DURATIONS\' own `recommended` field', () => {
    expect(source).toMatch(/sublabel=\{d\.id === recommendedDurationId \? 'Recommended' : null\}/);
    expect(source).not.toMatch(/d\.recommended/);
  });
});

describe('MeditationSetupPanel — compact mode (embedded): recommended summary, disclosure, Skip', () => {
  it('compact mode shows a recommended-choice summary and hides the full option list until expanded', () => {
    // Morning/Evening journey meditation-selection fix: expanded now
    // defaults from the additive `defaultExpanded` prop (still false for
    // every existing caller that omits it) rather than a hardcoded
    // useState(false), so "Choose another meditation" can open this panel
    // already expanded - see this file's own updated doc comment.
    expect(source).toMatch(/const \[expanded, setExpanded\] = useState\(defaultExpanded\);/);
    expect(source).toMatch(/const showOptions = !compact \|\| expanded;/);
  });

  it('the disclosure control reads "Choose style, time & sound" and only renders in compact mode before expansion', () => {
    expect(source).toMatch(/\{compact && !expanded && \(/);
    expect(source).toMatch(/Choose style, time &amp; sound/);
  });

  it('Skip only renders when the caller supplies onSkip (embedded callers only - standalone never passes it)', () => {
    expect(source).toMatch(/\{onSkip && \(/);
    expect(source).toMatch(/Skip meditation/);
  });

  it('Explore Guided Meditations only renders when the caller supplies onExploreGuided (standalone only - embedded callers never pass it)', () => {
    expect(source).toMatch(/\{onExploreGuided && \(/);
    expect(source).toMatch(/Explore Guided Meditations/);
  });

  it('the Begin button label is a prop, not hardcoded - so Morning/Evening/standalone can each use their own exact required copy', () => {
    expect(source).toMatch(/beginLabel = 'Begin Meditation'/);
    expect(source).toMatch(/<span>\{beginLabel\}<\/span>/);
  });
});

describe('MeditationSetupPanel — non-compact mode (standalone, unchanged): every option renders immediately', () => {
  it('showOptions is true whenever compact is false, regardless of the expanded flag - the standalone caller never gets a collapsed view', () => {
    // showOptions = !compact || expanded - when compact is false, the
    // left operand of || is already true, so this is unconditionally true
    // for every non-compact caller, exactly like the original always-shown
    // SelfGuidedMeditation.jsx setup screen.
    expect(source).toMatch(/const showOptions = !compact \|\| expanded;/);
  });
});

// F6 (pre-Build-15 usability pass) — approved compact two-column layout
// for the 5 meditation styles, replacing 5 stacked full-width rows (each
// with its own inline description) to shorten the setup screen. Applies
// to this one shared component, so standalone/Morning/Evening all get it
// consistently (no per-caller variant).
describe('MeditationSetupPanel — F6 compact two-column Meditation Style grid', () => {
  it('the style radiogroup is a 2-column grid (grid-cols-2), not the stacked space-y-2 rows every other radiogroup here still uses', () => {
    const block = source.match(/<div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Meditation style">[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(/<MeditationStyleCard/);
    expect(block).not.toMatch(/<MeditationOptionRow/);
  });

  it('the last (odd-numbered) style spans both columns generically - never hardcoded to a literal index/count of 5', () => {
    expect(source).toMatch(/fullWidth=\{MEDITATION_STYLES\.length % 2 === 1 && idx === MEDITATION_STYLES\.length - 1\}/);
    expect(source).not.toMatch(/fullWidth=\{idx === 4\}/);
  });

  it('the selected style\'s description renders exactly once, below the grid, reading live from the current `style` prop (never a separate/stale copy)', () => {
    expect(source).toMatch(/<p className="text-xs text-on-surface-variant px-1" aria-live="polite">\{style\.description\}<\/p>/);
    // Only this one description paragraph for style - MeditationStyleCard
    // itself never renders a visible description inline (see that
    // component's own test for its accessible-name-only treatment).
    const styleBlock = source.slice(source.indexOf('Meditation style'), source.indexOf('Duration</h2>'));
    expect((styleBlock.match(/text-on-surface-variant px-1"/g) ?? []).length).toBe(1);
  });

  it('duration and sound sections are completely untouched - still their own original controls/layout', () => {
    expect(source).toMatch(/<MeditationDurationChip/);
    expect(source).toMatch(/<MeditationOptionRow/);
    expect(source).toMatch(/grid grid-cols-3 gap-2" role="radiogroup" aria-label="Duration"/);
  });
});

describe('MeditationSetupPanel — touch targets and no fixed-width overflow at 320px', () => {
  it('every button this file owns directly carries the 44px minimum - the radio ROW/CHIP targets now live in MeditationControls.jsx (see that file\'s own test)', () => {
    // Begin, the disclosure toggle, Explore Guided Meditations, and Skip -
    // four literal button occurrences in THIS file's own source (the
    // latter two are mutually-relevant-by-context but both still appear
    // as real markup here, each behind its own conditional render).
    const minHeightMatches = source.match(/min-h-\[44px\]/g) ?? [];
    expect(minHeightMatches.length).toBeGreaterThanOrEqual(4);
  });

  it('no element uses a fixed pixel width wider than a 320px viewport (w-[###px]) - only relative/max-w utilities', () => {
    expect(source).not.toMatch(/w-\[\d{3,}px\]/);
  });
});
