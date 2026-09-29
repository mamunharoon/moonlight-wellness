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

  // Anytime visual-choice uplift (Part 2) — reverses Phase 9's own
  // "3 connectors" decision for this specific row: these four cues are
  // independent alternatives, never a required order, so implying a
  // sequence between them was always misleading. Zero connectors now,
  // matching this pass's own explicit "remove arrows between them"
  // instruction - never replaced with ">" direction markers either
  // (unlike AnytimePathway.jsx's own genuine Need -> Time -> Reset
  // sequence, which keeps its own markers - see the test just above).
  it('Anytime Home preview row (Breathe/Meditate/Instant Calm/Explore): exactly 4 tiles, zero connectors', () => {
    const source = read('../pages/Home.jsx');
    const cueBlockMatch = source.match(/aria-label="Includes Breathe, Meditate, Instant Calm, and Explore">([\s\S]*?)<\/div>\s*\n\s*<Link/);
    expect(cueBlockMatch).toBeTruthy();
    const cueBlock = cueBlockMatch[1];
    const iconCount = (cueBlock.match(/label: '(Breathe|Meditate|Instant Calm|Explore)'/g) ?? []).length;
    expect(iconCount).toBe(4);
    expect(cueBlock).not.toMatch(/idx < cues\.length - 1/);
    expect(cueBlock).not.toMatch(/<JourneyConnector/);
    expect(cueBlock).not.toMatch(/chevron_right/);
  });
});

describe('Physical-iPhone correction — connectors are one shared line+arrowhead component, never an isolated chevron', () => {
  // Anytime visual-choice uplift (Part 2/Part 3) — AnytimePathway.jsx now
  // joins Morning/Evening's own approved tile redesign (a small standalone
  // ">" direction marker, absolute-positioned against the icon, never the
  // line+arrowhead JourneyConnector) for its genuine Need -> Time -> Reset
  // sequence; Home's own Anytime preview row (four INDEPENDENT choices, not
  // a sequence) now renders no connector of any kind. JourneyConnector
  // itself is untouched and still used by every real sequential-pathway
  // caller that still needs it.
  it('AnytimePathway.jsx no longer imports or renders JourneyConnector at all - it uses its own small standalone ">" direction marker instead, mirroring MorningJourneyPathway.jsx/EveningJourneyPathway.jsx', () => {
    const source = read('../components/AnytimePathway.jsx');
    expect(source).not.toMatch(/import \{ JourneyConnector \}/);
    expect(source).not.toMatch(/<JourneyConnector/);
  });

  it('Home.jsx\'s Anytime preview row no longer imports or renders JourneyConnector - these four cues are independent alternatives, never a sequence', () => {
    const source = read('../pages/Home.jsx');
    expect(source).not.toMatch(/import \{ JourneyConnector \}/);
    expect(source).not.toMatch(/<JourneyConnector/);
  });

  it('MorningJourneyPathway/EveningJourneyPathway no longer import JourneyConnector at all - the approved tile redesign uses its own small standalone direction marker instead', () => {
    for (const path of ['../components/MorningJourneyPathway.jsx', '../components/EveningJourneyPathway.jsx']) {
      const source = read(path);
      expect(source).not.toMatch(/import \{ JourneyConnector \}/);
      expect(source).not.toMatch(/<JourneyConnector/);
    }
  });

  it('AnytimePathway.jsx now legitimately uses the same small standalone chevron_right direction marker Morning/Evening\'s own approved tile redesigns already use - never the old JourneyConnector line+arrowhead', () => {
    expect(read('../components/AnytimePathway.jsx')).toMatch(/chevron_right/);
  });

  it('Home.jsx\'s Anytime preview-row block uses no chevron_right/connector of any kind (Home.jsx itself still legitimately uses chevron_right elsewhere - e.g. the cross-routine "paused" banners - which are real navigation affordances, not pathway connectors, and are out of this correction\'s scope)', () => {
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

  it('AnytimePathway.jsx\'s own direction marker is absolute-positioned against its icon (never a margin-based hack), the same technique MorningJourneyPathway.jsx already established', () => {
    const source = read('../components/AnytimePathway.jsx');
    expect(source).toMatch(/absolute top-1\/2 -translate-y-1\/2 material-symbols-outlined/);
    expect(source).not.toMatch(/className="mt-\[10\.5px\]"/);
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
    expect(connectorBlock).toMatch(/chevron_right/);
  });

  it('Home\'s Anytime preview-row connector carries no badge/status logic and is not a tap target (no onClick, no <Link>/<button> inside the cue row)', () => {
    const source = read('../pages/Home.jsx');
    const cueBlockMatch = source.match(/aria-label="Includes Breathe, Meditate, Instant Calm, and Explore">([\s\S]*?)<\/div>\s*\n\s*<Link/);
    const cueBlock = cueBlockMatch[1];
    expect(cueBlock).not.toMatch(/onClick|<Link|<button/);
    expect(cueBlock).not.toMatch(/check_circle|check\b|StageOutcomeBadge/);
  });
});

describe('No whole-page horizontal overflow — a real CSS grid (minmax(0, 1fr) columns) fits every pathway within 320-430px, with no scroll container needed', () => {
  // Anytime visual-choice uplift (Part 3) — AnytimePathway.jsx now joins
  // MorningJourneyPathway.jsx/EveningJourneyPathway.jsx's own approved fix:
  // a real `grid-cols-3` (Tailwind's `repeat(3, minmax(0, 1fr))`) fits all
  // three stages within the real 320-430px viewport width by construction,
  // with no scrolling, scroll-snap, or fade mask needed.
  it('AnytimePathway/MorningJourneyPathway/EveningJourneyPathway no longer use overflow-x-auto/scroll-hide/scroll-snap/a fade mask - the grid itself is the fix, not a scroll container', () => {
    for (const path of ['../components/AnytimePathway.jsx', '../components/MorningJourneyPathway.jsx', '../components/EveningJourneyPathway.jsx']) {
      const source = read(path);
      expect(source).not.toMatch(/overflow-x-auto/);
      expect(source).not.toMatch(/scroll-hide/);
      expect(source).not.toMatch(/snap-x|snap-mandatory|snap-start/);
      expect(source).not.toMatch(/maskImage/);
    }
  });

  it('AnytimePathway uses a real grid-cols-3 (minmax(0,1fr) columns), matching MorningJourneyPathway.jsx\'s own grid-cols-5 fix exactly', () => {
    expect(read('../components/AnytimePathway.jsx')).toMatch(/grid grid-cols-3 gap-1/);
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
