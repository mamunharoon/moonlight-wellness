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
    expect(cueBlock).toMatch(/chevron_right/);
  });
});

describe('Connectors are never repurposed as status indicators', () => {
  it('MorningJourneyPathway/EveningJourneyPathway connector spans carry no status-conditional class or content - they are the same static chevron regardless of stage.status', () => {
    for (const path of ['../components/MorningJourneyPathway.jsx', '../components/EveningJourneyPathway.jsx']) {
      const source = read(path);
      const connectorBlock = source.match(/\{idx < stages\.length - 1 && \(([\s\S]*?)\)\}/)?.[1] ?? '';
      expect(connectorBlock).not.toBe('');
      expect(connectorBlock).not.toMatch(/stage\.status/);
      expect(connectorBlock).not.toMatch(/isCurrent|selected|badgeClass/);
      expect(connectorBlock).toMatch(/aria-hidden="true"/);
    }
  });

  it('AnytimePathway connector span carries no status-conditional class or content', () => {
    const source = read('../components/AnytimePathway.jsx');
    const connectorBlock = source.match(/\{idx < STAGES\.length - 1 && \(([\s\S]*?)\)\}/)?.[1] ?? '';
    expect(connectorBlock).not.toBe('');
    expect(connectorBlock).not.toMatch(/isCurrent|selected/);
    expect(connectorBlock).toMatch(/aria-hidden="true"/);
  });

  it('Home\'s Anytime preview-row connector carries no badge/status logic and is not a tap target (no onClick, no <Link>/<button> inside the cue row)', () => {
    const source = read('../pages/Home.jsx');
    const cueBlockMatch = source.match(/aria-label="Includes Breathe, Meditate, Instant Calm, and Explore">([\s\S]*?)<\/div>\s*\n\s*<Link/);
    const cueBlock = cueBlockMatch[1];
    expect(cueBlock).not.toMatch(/onClick|<Link|<button/);
    expect(cueBlock).not.toMatch(/check_circle|check\b|StageOutcomeBadge/);
  });
});

describe('No whole-page horizontal overflow — the established overflow-x-auto scroll-hide 320px-safety wrapper is present everywhere a pathway renders', () => {
  it('MorningJourneyPathway/EveningJourneyPathway/AnytimePathway each wrap their row in overflow-x-auto scroll-hide', () => {
    for (const path of ['../components/MorningJourneyPathway.jsx', '../components/EveningJourneyPathway.jsx', '../components/AnytimePathway.jsx']) {
      expect(read(path)).toMatch(/overflow-x-auto scroll-hide/);
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
    ]) {
      expect(read(path)).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });
});
