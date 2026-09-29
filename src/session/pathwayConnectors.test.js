// Phase 9 — Truthful Journey Outcomes (Part 10): connector-count and
// Anytime decision-pathway/Home-preview-row regression coverage. Real
// execution against the actual stage-definition arrays plus source-level
// checks for the connector markup (this repo's established pattern - no
// DOM renderer available in this Vitest setup).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MORNING_PATHWAY_STAGES, EVENING_PATHWAY_STAGES } from './pathwayStages';
import { computeStageStatus } from './stageStatus';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('Connector counts — exactly N-1 connectors for N real stage icons', () => {
  it('Morning pathway: exactly 5 stage icons, exactly 4 connectors', () => {
    expect(MORNING_PATHWAY_STAGES).toHaveLength(5);
    const stages = computeStageStatus({ stages: MORNING_PATHWAY_STAGES, stepOutcomes: {}, currentStepId: null, sessionStatus: null });
    expect(stages).toHaveLength(5);
    const source = read('../components/MorningJourneyPathway.jsx');
    expect((source.match(/idx < stages\.length - 1/g) ?? []).length).toBe(1); // one connector-gate expression, rendered N-1 times at runtime
  });

  it('Evening pathway: exactly 5 stage icons, exactly 4 connectors', () => {
    expect(EVENING_PATHWAY_STAGES).toHaveLength(5);
    const stages = computeStageStatus({ stages: EVENING_PATHWAY_STAGES, stepOutcomes: {}, currentStepId: null, sessionStatus: null });
    expect(stages).toHaveLength(5);
    const source = read('../components/EveningJourneyPathway.jsx');
    expect((source.match(/idx < stages\.length - 1/g) ?? []).length).toBe(1);
  });

  it('Anytime decision pathway (Need/Time/Reset): exactly 3 stage icons, exactly 2 connectors', () => {
    const source = read('../components/AnytimePathway.jsx');
    const stagesMatch = source.match(/const STAGES = \[([\s\S]*?)\];/);
    expect(stagesMatch).toBeTruthy();
    const stageCount = (stagesMatch[1].match(/\{ id:/g) ?? []).length;
    expect(stageCount).toBe(3);
    expect(source).toMatch(/idx < STAGES\.length - 1/);
  });

  it('Anytime Home preview row (Breathe/Meditate/Instant Calm/Explore): exactly 4 icons, exactly 3 connectors', () => {
    const source = read('../pages/Home.jsx');
    const cueBlockMatch = source.match(/aria-label="Includes Breathe, Meditate, Instant Calm, and Explore">([\s\S]*?)<\/div>\s*\n\s*<Link/);
    expect(cueBlockMatch).toBeTruthy();
    const cueBlock = cueBlockMatch[1];
    const iconCount = (cueBlock.match(/label: '(Breathe|Meditate|Instant Calm|Explore)'/g) ?? []).length;
    expect(iconCount).toBe(4);
    expect(cueBlock).toMatch(/idx < cues\.length - 1/);
    expect(cueBlock).toMatch(/<JourneyConnector journeyTone="anytime"/);
  });
});

describe('Physical-iPhone correction — connectors are one shared line+arrowhead component, never an isolated chevron', () => {
  // WakeWise DEV — approved Morning pathway-tile redesign, extended to
  // Evening in Phase 13's own parity pass: both deliberately stopped
  // rendering JourneyConnector (a small standalone ">" direction marker
  // replaces it in each - see morningTilePathway.test.js/
  // eveningTilePathway.test.js's own dedicated coverage). AnytimePathway/
  // Home's Anytime preview row are unaffected and keep the exact
  // requirement below.
  it('AnytimePathway/Home\'s Anytime preview row still import and render the shared JourneyConnector, not independent implementations', () => {
    for (const path of ['../components/AnytimePathway.jsx', '../pages/Home.jsx']) {
      const source = read(path);
      expect(source).toMatch(/import \{ JourneyConnector \} from ['"].*journey\/JourneyConnector['"]/);
      expect(source).toMatch(/<JourneyConnector journeyTone=/);
    }
  });

  it('MorningJourneyPathway/EveningJourneyPathway no longer import JourneyConnector at all - the approved tile redesign uses its own small standalone direction marker instead', () => {
    for (const path of ['../components/MorningJourneyPathway.jsx', '../components/EveningJourneyPathway.jsx']) {
      const source = read(path);
      expect(source).not.toMatch(/import \{ JourneyConnector \}/);
      expect(source).not.toMatch(/<JourneyConnector/);
    }
  });

  it('no Anytime pathway component still contains the old isolated chevron_right/› treatment (Morning/Evening\'s approved tile redesigns deliberately reintroduce a small standalone ">" - covered separately in morningTilePathway.test.js/eveningTilePathway.test.js - so both are excluded from this specific check)', () => {
    expect(read('../components/AnytimePathway.jsx')).not.toMatch(/chevron_right/);
  });

  it('Home.jsx\'s Anytime preview-row connector block no longer uses chevron_right (Home.jsx itself still legitimately uses chevron_right elsewhere - e.g. the cross-routine "paused" banners - which are real navigation affordances, not pathway connectors, and are out of this correction\'s scope)', () => {
    const source = read('../pages/Home.jsx');
    const cueBlockMatch = source.match(/aria-label="Includes Breathe, Meditate, Instant Calm, and Explore">([\s\S]*?)<\/div>\s*\n\s*<Link/);
    expect(cueBlockMatch).toBeTruthy();
    expect(cueBlockMatch[1]).not.toMatch(/chevron_right/);
  });

  it('JourneyConnector itself renders a real horizontal line plus a filled arrowhead shape - not a single glyph', () => {
    const source = read('../components/journey/JourneyConnector.jsx');
    expect(source).toMatch(/<line[\s\S]*?stroke="currentColor"/);
    expect(source).toMatch(/<path[\s\S]*?fill="currentColor"/);
  });

  it('JourneyConnector is aria-hidden and not a focusable/tappable element', () => {
    const source = read('../components/journey/JourneyConnector.jsx');
    expect(source).toMatch(/aria-hidden="true"/);
    expect(source).not.toMatch(/tabIndex|onClick|role="button"/);
  });

  it('JourneyConnector resolves the correct existing colour token per journey tone - gold/periwinkle/mint, never a raw hex', () => {
    const source = read('../components/journey/JourneyConnector.jsx');
    expect(source).toMatch(/morning: 'text-morning-accent\/70'/);
    expect(source).toMatch(/evening: 'text-evening-accent\/70'/);
    expect(source).toMatch(/anytime: 'text-tertiary\/70'/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('every remaining JourneyConnector-based call site vertically centres the connector against its own icon-circle size, not the label row, via an explicit computed margin - never the old approximate negative-margin hack', () => {
    // Anytime/Home are untouched by the Morning/Evening tile redesigns and
    // keep their original 32/36px circles and margins exactly. Morning/
    // Evening's own direction markers each use their own separate
    // absolute-positioning treatment instead (no margin-based centring at
    // all) - see morningTilePathway.test.js/eveningTilePathway.test.js's
    // own dedicated coverage.
    expect(read('../components/AnytimePathway.jsx')).toMatch(/className="mt-\[10\.5px\]"/);
    expect(read('../pages/Home.jsx')).toMatch(/className="mt-\[12\.5px\]"/);
    expect(read('../components/AnytimePathway.jsx')).not.toMatch(/-mt-4|-mt-5/);
  });
});

describe('Connectors are never repurposed as status indicators', () => {
  // Morning/Evening's own direction markers (a plain, unconditional
  // `{idx < stages.length - 1 && <DirectionMarker />}`, no surrounding
  // parens) are covered separately in morningTilePathway.test.js/
  // eveningTilePathway.test.js - never conditioned on stage.status either.
  it('AnytimePathway connector slot carries no status-conditional class or content', () => {
    const source = read('../components/AnytimePathway.jsx');
    const connectorBlock = source.match(/\{idx < STAGES\.length - 1 && \(([\s\S]*?)\)\}/)?.[1] ?? '';
    expect(connectorBlock).not.toBe('');
    expect(connectorBlock).not.toMatch(/isCurrent|selected/);
    expect(connectorBlock).toMatch(/<JourneyConnector journeyTone=/);
  });

  it('Home\'s Anytime preview-row connector carries no badge/status logic and is not a tap target (no onClick, no <Link>/<button> inside the cue row)', () => {
    const source = read('../pages/Home.jsx');
    const cueBlockMatch = source.match(/aria-label="Includes Breathe, Meditate, Instant Calm, and Explore">([\s\S]*?)<\/div>\s*\n\s*<Link/);
    const cueBlock = cueBlockMatch[1];
    expect(cueBlock).not.toMatch(/onClick|<Link|<button/);
    expect(cueBlock).not.toMatch(/check_circle|check\b|StageOutcomeBadge/);
  });
});

describe('No whole-page horizontal overflow — the established overflow-x-auto scroll-hide 320px-safety wrapper is present everywhere a pathway still needs it', () => {
  // Approved Morning pathway-fit correction, extended to Evening in Phase
  // 13 — MorningJourneyPathway.jsx/EveningJourneyPathway.jsx no longer
  // need (or use) this scroll-safety wrapper at all: their own
  // `grid-cols-5` (Tailwind's `repeat(5, minmax(0, 1fr))`) fits all five
  // stages within the real 320-430px viewport width by construction, with
  // no scrolling. AnytimePathway is unaffected and keeps the requirement
  // below unchanged - see morningPathwayFit.test.js/eveningTilePathway.
  // test.js's own dedicated "no horizontal scroller" coverage for each.
  it('AnytimePathway still wraps its row in overflow-x-auto scroll-hide', () => {
    expect(read('../components/AnytimePathway.jsx')).toMatch(/overflow-x-auto scroll-hide/);
  });

  it('MorningJourneyPathway/EveningJourneyPathway no longer use overflow-x-auto/scroll-hide/scroll-snap/a fade mask - the grid itself is the fix, not a scroll container', () => {
    for (const path of ['../components/MorningJourneyPathway.jsx', '../components/EveningJourneyPathway.jsx']) {
      const source = read(path);
      expect(source).not.toMatch(/overflow-x-auto/);
      expect(source).not.toMatch(/scroll-hide/);
      expect(source).not.toMatch(/snap-x|snap-mandatory|snap-start/);
      expect(source).not.toMatch(/maskImage/);
    }
  });
});

describe('No raw hex colours introduced by Phase 9 pathway/connector files', () => {
  it('pathway components and stage/icon definitions use only existing design tokens, never a literal hex value', () => {
    for (const path of [
      '../components/MorningJourneyPathway.jsx',
      '../components/EveningJourneyPathway.jsx',
      '../components/AnytimePathway.jsx',
      './pathwayStages.js',
      './journeyIcons.js',
      './stageStatus.js',
      '../components/journey/StageOutcomeBadge.jsx',
      '../components/journey/JourneyConnector.jsx',
    ]) {
      expect(read(path)).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});
