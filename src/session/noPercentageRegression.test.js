// Phase 9 — Truthful Journey Outcomes (Part 10, explicitly named):
// "Add a repository-wide regression test proving no user-facing Morning,
// Anytime or Evening completion surface contains percentage wording."
//
// Scope: every screen/component a user can reach as part of completing (or
// viewing the outcome of) a Morning, Anytime, or Evening journey. This is
// deliberately NOT a blind repo-wide `\d+%` grep - CSS percentages
// (width/opacity/gradient stops/Tailwind arbitrary values like
// `/[12%]`) are expected and harmless everywhere in this codebase; the
// requirement is about RENDERED, user-facing wording (a "100% Complete"/
// "84%"-style claim), not markup. This test strips comments and every
// className attribute (source of every CSS percentage) before checking,
// so only text genuinely reachable as visible copy can trip it.
//
// EXCLUDED, with reason: src/pages/SleepHub.jsx. Confirmed by direct
// inspection (Phase 9 Parts 6-9 fork) to be a separate, pre-existing
// sleep-ANALYTICS feature ("Average Score: 84%", sleep-stage percentage
// breakdowns) - not a Morning/Anytime/Evening journey-completion surface,
// and out of this phase's scope to redesign. Included here only as a
// deliberate, documented exclusion, never silently swept in or ignored.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

// Every Morning/Anytime/Evening completion-surface file: final screens,
// the shared pathway/connector components (rendered on those final
// screens and on Home), the Anytime closing handoff, and Home.jsx itself
// (renders all three journeys' cards, including their completed states).
const COMPLETION_SURFACE_FILES = [
  '../pages/SessionComplete.jsx',
  '../pages/EveningComplete.jsx',
  '../components/AnytimeClosingHandoff.jsx',
  '../components/MorningJourneyPathway.jsx',
  '../components/EveningJourneyPathway.jsx',
  '../components/AnytimePathway.jsx',
  '../pages/Home.jsx',
  '../components/journey/StageOutcomeBadge.jsx',
];

// Strips /* */ and // comments, then every className="..."/className={`...`}
// attribute value (the source of every legitimate CSS percentage in this
// codebase), then every inline style={{...}} object (e.g. a CSS
// mask-image/gradient's own "100%" stop position - MorningJourneyPathway's
// approved tile-redesign overflow-fade mask is the first real example of
// this), leaving only what could plausibly render as visible text.
const strippedUserFacingText = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/className=\{[^}]*\}/g, '')
    .replace(/className="[^"]*"/g, '')
    .replace(/className=\{`[^`]*`\}/g, '')
    .replace(/style=\{\{[\s\S]*?\}\}/g, '');

describe('Repository-wide regression: no Morning/Anytime/Evening completion surface shows percentage wording', () => {
  for (const path of COMPLETION_SURFACE_FILES) {
    it(`${path} — no rendered percentage/wellbeing-score text (comments and className CSS values excluded)`, () => {
      const text = strippedUserFacingText(read(path));
      expect(text).not.toMatch(/\d+%/);
      expect(text).not.toMatch(/\bpercent\b/i);
    });
  }

  it('SleepHub.jsx is deliberately excluded above - documented here so the exclusion is explicit, not silent: it genuinely does show percentages, confirmed to be its own separate sleep-analytics feature, not a journey-completion surface', () => {
    const sleepHubText = strippedUserFacingText(read('../pages/SleepHub.jsx'));
    expect(sleepHubText).toMatch(/\d+%/); // documents WHY it's excluded, rather than silently omitting the file
  });

  it('sanity check: the stripping helper itself does not over-strip and hide a real violation - a deliberately-injected percentage in plain JSX text is still caught', () => {
    const fakeSource = `
      export const Fake = () => (
        <div className="text-sm w-[50%]">
          <p>You are 100% done with this routine.</p>
        </div>
      );
    `;
    expect(strippedUserFacingText(fakeSource)).toMatch(/100%/);
  });
});
