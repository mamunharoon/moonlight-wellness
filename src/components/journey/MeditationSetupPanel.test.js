// Source-level regression guard for MeditationSetupPanel.jsx - the shared
// setup screen extracted from SelfGuidedMeditation.jsx (Journey Embedding,
// Phase 2). Meditation ↔ Breathing alignment correction — the former
// compact/expandable two-state model (a "Recommended for you" summary card
// behind a "Choose style, time & sound" disclosure) is gone: every journey
// (Morning/Evening/Anytime) now shows the same always-full structure,
// matching Breathe.jsx/EveningBreathing.jsx's own setup screens.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./MeditationSetupPanel.jsx', import.meta.url)), 'utf-8');

describe('MeditationSetupPanel — five styles and three durations via the real data modules', () => {
  it('imports MEDITATION_STYLES/MEDITATION_DURATIONS - no second copy of the data', () => {
    expect(source).toMatch(/from '\.\.\/\.\.\/lib\/meditationStyles';/);
    expect(source).toMatch(/from '\.\.\/\.\.\/lib\/meditationDurations';/);
  });

  it('styles/durations each render via a single map (never a hand-duplicated list)', () => {
    expect(source).toMatch(/\{MEDITATION_STYLES\.map\(\(s\) => \(/);
    expect(source).toMatch(/\{MEDITATION_DURATIONS\.map\(\(d\) => \(/);
  });

  it('reuses the shared MeditationOptionRow/MeditationDurationChip controls, never a second radio implementation, and never imports/renders the retired two-column MeditationStyleCard (doc comments may still discuss it in prose)', () => {
    expect(source).toMatch(/import \{ MeditationOptionRow, MeditationDurationChip \} from '\.\/MeditationControls';/);
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/MeditationStyleCard/);
  });

  it('sound selection is delegated to the compact MeditationSoundControl, never a second/duplicate sound implementation in this file', () => {
    expect(source).toMatch(/import \{ MeditationSoundControl \} from '\.\/MeditationSoundControl';/);
    expect(source).not.toMatch(/MEDITATION_SOUNDS/);
  });
});

describe('MeditationSetupPanel — accessible radiogroups', () => {
  it('both remaining groups use role="radiogroup" with a real native <input type="radio"> (inside MeditationControls.jsx)', () => {
    expect(source).toMatch(/role="radiogroup" aria-label="Meditation style"/);
    expect(source).toMatch(/role="radiogroup" aria-label="Duration"/);
  });

  it('no full three-row "Choose your sound" radiogroup lives in this file any more - that section moved to the compact MeditationSoundControl', () => {
    expect(source).not.toMatch(/role="radiogroup" aria-label="Choose your sound"/);
  });
});

describe('MeditationSetupPanel — Recommended badge is context-driven, never the shared registry\'s own fixed flag', () => {
  it('the duration chip sublabel compares against the recommendedDurationId PROP, never MEDITATION_DURATIONS\' own `recommended` field', () => {
    expect(source).toMatch(/sublabel=\{d\.id === recommendedDurationId \? 'Recommended' : null\}/);
    expect(source).not.toMatch(/d\.recommended/);
  });
});

describe('MeditationSetupPanel — every choice always renders immediately, matching Breathing\'s own setup screens', () => {
  it('holds no expand/collapse state at all - no compact prop, no disclosure, no "Recommended for you" summary card (checked against real code, since the doc comment legitimately discusses the retired `compact` model in prose)', () => {
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/\bcompact\b/);
    expect(codeOnly).not.toMatch(/defaultExpanded|onExpandedConsumed|showOptions|useState|useEffect/);
    expect(codeOnly).not.toMatch(/Recommended for you/i);
    expect(codeOnly).not.toMatch(/Choose style, time &amp; sound/);
  });

  it('Skip only renders when the caller supplies onSkip (embedded callers only - standalone never passes it)', () => {
    expect(source).toMatch(/\{onSkip && \(/);
    expect(source).toMatch(/Skip meditation/);
  });

  it('Explore Guided Meditations only renders when the caller supplies onExploreGuided, positioned before the primary Begin action', () => {
    const exploreIdx = source.indexOf('{onExploreGuided && (');
    const beginIdx = source.indexOf('onClick={onBegin}');
    expect(exploreIdx).toBeGreaterThan(-1);
    expect(beginIdx).toBeGreaterThan(exploreIdx);
    expect(source).toMatch(/Explore Guided Meditations/);
  });

  it('the Begin button label defaults to null (an optional override) and is resolved from the live duration prop, never a hardcoded string', () => {
    expect(source).toMatch(/beginLabel = null/);
    expect(source).toMatch(/import \{ MEDITATION_DURATIONS, formatMeditationBeginLabel \} from '\.\.\/\.\.\/lib\/meditationDurations';/);
    expect(source).toMatch(/const resolvedBeginLabel = beginLabel \|\| formatMeditationBeginLabel\(duration\);/);
    expect(source).toMatch(/<span>\{resolvedBeginLabel\}<\/span>/);
  });
});

describe('MeditationSetupPanel — vertically stacked, full-width style rows with a genuine icon (Meditation ↔ Breathing alignment)', () => {
  it('the style radiogroup is stacked full-width rows (space-y-2), not the former 2-column grid', () => {
    const block = source.match(/<div className="space-y-2" role="radiogroup" aria-label="Meditation style">[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(/<MeditationOptionRow/);
    expect(block).toMatch(/icon=\{s\.icon\}/);
  });

  it('duration section is untouched - still MeditationDurationChip in a 3-column grid', () => {
    expect(source).toMatch(/<MeditationDurationChip/);
    expect(source).toMatch(/grid grid-cols-3 gap-2" role="radiogroup" aria-label="Duration"/);
  });
});

describe('MeditationSetupPanel — compact Sound control, upper-right', () => {
  it('renders MeditationSoundControl right-aligned as the panel\'s first element, wired to the live soundId/onSelectSound props', () => {
    const idx = source.indexOf('<MeditationSoundControl');
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(source.indexOf('Meditation style'));
    const block = source.match(/<div className="flex justify-end">[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(block).toMatch(/<MeditationSoundControl soundId=\{soundId\} onSelectSound=\{onSelectSound\} journeyTone=\{journeyTone\} \/>/);
  });
});

describe('MeditationSetupPanel — journey-specific wording defaults', () => {
  it('heading defaults to "Take a Mindful Pause" (Evening\'s own copy); Morning/Anytime callers pass their own', () => {
    expect(source).toMatch(/heading = 'Take a Mindful Pause'/);
  });
});

describe('MeditationSetupPanel — touch targets and no fixed-width overflow at 320px', () => {
  it('every button this file owns directly carries the 44px minimum', () => {
    // Begin, Explore Guided Meditations, and Skip - each behind its own
    // conditional render.
    const minHeightMatches = source.match(/min-h-\[44px\]/g) ?? [];
    expect(minHeightMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('no element uses a fixed pixel width wider than a 320px viewport (w-[###px]) - only relative/max-w utilities', () => {
    expect(source).not.toMatch(/w-\[\d{3,}px\]/);
  });
});
