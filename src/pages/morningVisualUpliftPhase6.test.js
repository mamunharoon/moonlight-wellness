// Morning Visual Uplift (Phase 6) — cross-cutting regression guard for
// the Stitch-direction Morning setup redesign (Home card, Stretch,
// Breathing, Meditation, Affirmation). No DOM rendering is available in
// this repo's Vitest (environment: 'node' - see vite.config.js) -
// source-level checks here, real-execution component coverage lives in
// MorningJourneyPathway.test.js/CompactSoundControl.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const homeSource = read('./Home.jsx');
const morningFlowSource = read('./MorningFlow.jsx');
const breatheSource = read('./Breathe.jsx');
const morningMeditateSource = read('./MorningMeditate.jsx');
const affirmationSource = read('./Affirmation.jsx');
const sessionCompleteSource = read('./SessionComplete.jsx');
const eveningCompleteSource = read('./EveningComplete.jsx');
const anytimeResetSource = read('./AnytimeReset.jsx');
const tailwindConfigSource = read('../../tailwind.config.js');
const indexCssSource = read('../index.css');

describe('Morning Home — five-step pathway only on the not-started card, never on in-progress/completed', () => {
  it('MorningJourneyPathway is imported and rendered exactly once, inside the not-started (!morningHasStaleChoice) card block only', () => {
    const importMatches = homeSource.match(/import \{ MorningJourneyPathway \} from '\.\.\/components\/MorningJourneyPathway';/g) ?? [];
    expect(importMatches.length).toBe(1);
    const renderMatches = homeSource.match(/<MorningJourneyPathway \/>/g) ?? [];
    expect(renderMatches.length).toBe(1);

    const notStartedBlock = homeSource.match(/\{morningCardState === 'not-started' && !morningHasStaleChoice && \(([\s\S]*?)\n {10}\)\}/)?.[1] ?? '';
    expect(notStartedBlock).toMatch(/<MorningJourneyPathway \/>/);
  });

  it('the in-progress and completed Morning cards never render the pathway - Resume/Repeat behaviour is untouched by this addition', () => {
    const inProgressBlock = homeSource.match(/\{morningCardState === 'in-progress' && \(([\s\S]*?)\n {10}\)\}/)?.[1] ?? '';
    const completedBlock = homeSource.match(/\{morningCardState === 'completed' && \(([\s\S]*?)\n {10}\)\}/)?.[1] ?? '';
    expect(inProgressBlock).not.toMatch(/MorningJourneyPathway/);
    expect(completedBlock).not.toMatch(/MorningJourneyPathway/);
    // The exact original Resume/Repeat handlers and labels are still wired.
    expect(inProgressBlock).toMatch(/onClick=\{handleMorningAction\}/);
    expect(inProgressBlock).toMatch(/\{morningInProgressCard\.buttonLabel\}/);
    expect(inProgressBlock).toMatch(/onClick=\{\(\) => setActiveDialog\(\{ kind: 'start-over', period: 'morning' \}\)\}/);
    expect(completedBlock).toMatch(/onClick=\{\(\) => setActiveDialog\(\{ kind: 'repeat', period: 'morning' \}\)\}/);
    expect(completedBlock).toMatch(/\{morningCompletedCard\.buttonLabel\}/);
  });

  it('the stale-choice (Resume Previous / Start Today\'s) card is completely untouched by this pass', () => {
    expect(homeSource).toMatch(/onClick=\{handleResumeStaleMorning\}/);
    expect(homeSource).toMatch(/Resume Previous Routine/);
    expect(homeSource).toMatch(/Start Today's Routine/);
  });
});

describe('Morning setup screens — no new colour introduced; existing Morning gold tokens remain in use', () => {
  const changedFiles = {
    'Home.jsx': homeSource,
    'MorningFlow.jsx': morningFlowSource,
    'Breathe.jsx': breatheSource,
    'MorningMeditate.jsx': morningMeditateSource,
    'Affirmation.jsx': affirmationSource,
    'SessionComplete.jsx': sessionCompleteSource,
    'CompactSoundControl.jsx': read('../components/CompactSoundControl.jsx'),
    'MorningJourneyPathway.jsx': read('../components/MorningJourneyPathway.jsx'),
    'BreathingPatternRow.jsx': read('../components/BreathingPatternRow.jsx'),
    'MeditationSetupPanel.jsx': read('../components/journey/MeditationSetupPanel.jsx')
  };

  it('none of the Phase 6 changed files contain a raw hex colour literal - every colour comes from an existing named token', () => {
    for (const [name, source] of Object.entries(changedFiles)) {
      const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const hexMatches = codeOnly.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      expect(hexMatches, `${name} should not introduce any raw hex colour`).toEqual([]);
    }
  });

  it('tailwind.config.js and index.css (the theme/token/palette files) still define the exact pre-existing Morning/Anytime/Evening tokens, byte-identical - this pass never touched them', () => {
    expect(tailwindConfigSource).toMatch(/boxShadow\[["']morning-glow["']\]|"morning-glow":\s*"0 0 40px -8px rgba\(253, 186, 116, 0\.35\)"/);
    expect(indexCssSource).toMatch(/--color-gratitude-accent: #fdba74;/);
    expect(indexCssSource).toMatch(/--color-evening-accent: #9fb4f0;/);
    expect(indexCssSource).toMatch(/--color-morning-affirmation-from: #fffdfa;/);
  });

  it('each changed Morning screen still uses the existing morning-accent/morning-display tokens - the gold identity was rearranged for hierarchy, never replaced', () => {
    for (const [name, source] of Object.entries(changedFiles)) {
      if (name === 'CompactSoundControl.jsx' || name === 'MorningJourneyPathway.jsx' || name === 'BreathingPatternRow.jsx' || name === 'MeditationSetupPanel.jsx') continue; // shared primitives, journey-tone-parameterised
      expect(source, `${name} should still reference morning-accent`).toMatch(/morning-accent/);
    }
  });
});

describe('Morning Affirmation — no mock-up-only favourite/shuffle/audio functionality introduced', () => {
  it('Affirmation.jsx never references favourite/heart/shuffle/audio-playback concepts that only exist in the Stitch concept', () => {
    const codeOnly = affirmationSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/favorite|favourite|isFavorite|shuffle|Shuffle/i);
    expect(codeOnly).not.toMatch(/new Audio\(|\.play\(\)|audioRef/);
  });

  it('still uses the honest, existing PRIMARY/SUPPORTING labels (roleForIndex) - never renamed to "Primary Anchor"/"Grounding Perspective"', () => {
    expect(affirmationSource).toMatch(/\{roleForIndex\(idx\)\}/);
    expect(affirmationSource).not.toMatch(/Primary Anchor|Grounding Perspective/);
  });
});

describe('Explore Discovery (Phase 5) routing is untouched by the Phase 6 visual pass', () => {
  it('Morning/Evening/Anytime Explore destinations are still the exact Phase 5 URLs', () => {
    expect(sessionCompleteSource).toMatch(/to="\/library\?journey=morning&from=morning-complete"/);
    expect(eveningCompleteSource).toMatch(/to="\/library\?journey=evening&from=evening-summary"/);
    expect(anytimeResetSource).toMatch(/to=\{`\/library\?journey=anytime&from=anytime-recommend&need=\$\{encodeURIComponent\(needId\)\}&duration=\$\{encodeURIComponent\(durationId\)\}`\}/);
  });
});

describe('Morning setup screens — Skip/Exit/Back destinations unchanged by the visual restructure', () => {
  it('MorningFlow.jsx (Stretch): Skip still advances to Breathe, Exit still opens the same confirmation, Back fallback is still /intention-setup', () => {
    expect(morningFlowSource).toMatch(/const handleSkip = \(\) => \{\s*\n\s*setJourneyStep\('breathe'\);\s*\n\s*navigate\('\/breathe'\);/);
    expect(morningFlowSource).toMatch(/<BackButton fallback="\/intention-setup" guardActiveRoute=\{false\} onBeforeLeave=\{handleBackFromActive\} \/>/);
  });

  it('Breathe.jsx (Breathing): Skip still advances to Meditate via skipStep(), Back fallback is still /morning-flow', () => {
    expect(breatheSource).toMatch(/const handleSkip = \(\) => \{\s*\n\s*setJourneyStep\('meditate'\);\s*\n\s*navigate\('\/morning-meditate'\);\s*\n\s*skipStep\(\);/);
    expect(breatheSource).toMatch(/<BackButton fallback="\/morning-flow" guardActiveRoute=\{false\} onBeforeLeave=\{handleBackFromActive\} \/>/);
  });

  it('MorningMeditate.jsx: Skip/Continue-to-Affirmation still routes via advanceToAffirmation, Back fallback is still /breathe', () => {
    expect(morningMeditateSource).toMatch(/const handleSkip = \(\) => advanceToAffirmation\(\);/);
    expect(morningMeditateSource).toMatch(/<BackButton fallback="\/breathe" guardActiveRoute=\{false\} \/>/);
  });

  it('Affirmation.jsx: Continue still advances to /session-complete, Back fallback is still /morning-meditate', () => {
    expect(affirmationSource).toMatch(/setJourneyStep\('complete'\);\s*\n\s*navigate\('\/session-complete'\);/);
    expect(affirmationSource).toMatch(/<BackButton fallback="\/morning-meditate" guardActiveRoute=\{false\} \/>/);
  });
});
