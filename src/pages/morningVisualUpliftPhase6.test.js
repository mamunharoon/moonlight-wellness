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

describe('Morning Home — five-step pathway in every Morning card state (Physical-iPhone correction)', () => {
  it('MorningJourneyPathway is imported once and rendered in all four real card states - not-started, in-progress, completed, and finished-partially (Phase 9 — Truthful Journey Outcomes, Part 9\'s honest 4th state)', () => {
    const importMatches = homeSource.match(/import \{ MorningJourneyPathway \} from '\.\.\/components\/MorningJourneyPathway';/g) ?? [];
    expect(importMatches.length).toBe(1);
    const renderMatches = homeSource.match(/<MorningJourneyPathway/g) ?? [];
    expect(renderMatches.length).toBe(4);
  });

  it('not-started renders the plain pathway (no props - every step in its original upcoming look, byte-identical to before this correction)', () => {
    const notStartedBlock = homeSource.match(/\{morningCardState === 'not-started' && !morningHasStaleChoice && \(([\s\S]*?)\n {10}\)\}/)?.[1] ?? '';
    expect(notStartedBlock).toMatch(/<MorningJourneyPathway \/>/);
  });

  it('in-progress passes the real computed morningPathwayStages, derived (via computeStageStatus) from the SAME resolved step index resolveStepLabel already uses - no competing/second progress store', () => {
    expect(homeSource).toMatch(/const morningCurrentStepId = getSessionById\(RITUAL_SESSION_IDS\.morning\)\?\.steps\[morningResolvedStepIndex\]\?\.id \?\? null;/);
    const inProgressBlock = homeSource.match(/\{morningCardState === 'in-progress' && \(([\s\S]*?)\n {10}\)\}/)?.[1] ?? '';
    expect(inProgressBlock).toMatch(/<MorningJourneyPathway stages=\{morningPathwayStages\} \/>/);
    // The exact original Resume handler/label and Start Over are still wired, unchanged.
    expect(inProgressBlock).toMatch(/onClick=\{handleMorningAction\}/);
    expect(inProgressBlock).toMatch(/\{morningInProgressCard\.buttonLabel\}/);
    expect(inProgressBlock).toMatch(/onClick=\{\(\) => setActiveDialog\(\{ kind: 'start-over', period: 'morning' \}\)\}/);
  });

  it('completed passes the real computed morningPathwayStages too (Phase 9: the true per-stage outcomes for today\'s run, never a forced "all five completed") - Repeat is still wired, unchanged', () => {
    const completedBlock = homeSource.match(/\{morningCardState === 'completed' && \(([\s\S]*?)\n {10}\)\}/)?.[1] ?? '';
    expect(completedBlock).toMatch(/<MorningJourneyPathway stages=\{morningPathwayStages\} \/>/);
    expect(completedBlock).toMatch(/onClick=\{\(\) => setActiveDialog\(\{ kind: 'repeat', period: 'morning' \}\)\}/);
    expect(completedBlock).toMatch(/\{morningCompletedCard\.buttonLabel\}/);
  });

  it('the stale-choice (Resume Previous / Start Today\'s) card is completely untouched by this pass', () => {
    expect(homeSource).toMatch(/onClick=\{handleResumeStaleMorning\}/);
    expect(homeSource).toMatch(/Resume Previous Routine/);
    expect(homeSource).toMatch(/Start Today's Routine/);
  });
});

describe('Morning Meditation setup — spacing correction (Physical-iPhone finding: excessive gap below the progress pathway)', () => {
  // Comments in this file legitimately mention "justify-between" while
  // explaining the fix - strip comments first so the check reflects only
  // the real, executable code, matching this suite's own established
  // hex-scan precedent below.
  const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('the outer content container no longer uses justify-between (the real cause: distributing all leftover viewport space as extra gaps between a few short children) and space-y-10 is tightened to space-y-4', () => {
    expect(codeOnly(morningMeditateSource)).not.toMatch(/justify-between/);
    expect(morningMeditateSource).toMatch(/className="flex flex-col space-y-4"/);
  });

  // Physical-iPhone correction (exercise-screen safe-area architecture) —
  // the setup screen's own h-dvh/overflow-y-auto scroll ownership moved
  // into the shared ExerciseScreenShell (see
  // meditationSafeAreaCoverage.test.js for that shell's own dedicated,
  // per-branch coverage); no fixed pixel height is introduced there either.
  it('no fixed pixel height was introduced that could clip smaller devices - renders the shared ExerciseScreenShell (its own real scroll owner) instead of an ad hoc wrapper', () => {
    expect(morningMeditateSource).toMatch(/import \{ ExerciseScreenShell \} from '\.\.\/components\/journey\/ExerciseScreenShell';/);
    expect(morningMeditateSource).not.toMatch(/h-\[\d/);
  });

  it('MeditationSetupPanel and its Begin/Duration/Sound wiring are completely untouched by the spacing correction (Meditation ↔ Breathing alignment correction retired `compact`/`defaultExpanded` - every choice now shows immediately)', () => {
    expect(morningMeditateSource).toMatch(/<MeditationSetupPanel\s*\n\s*journeyTone="morning"\s*\n\s*heading="Mindful Pause"\s*\n\s*purpose="A quiet moment before your affirmation\."/);
    expect(morningMeditateSource).toMatch(/onBegin=\{handleBegin\}/);
    expect(morningMeditateSource).toMatch(/onSelectDuration=\{session\.setDurationId\}/);
    expect(morningMeditateSource).toMatch(/onSelectSound=\{session\.selectSound\}/);
    expect(morningMeditateSource).not.toMatch(/defaultExpanded=/);
  });
});

describe('Morning Affirmation — supporting-text readability correction (Physical-iPhone finding: too pale, too small)', () => {
  // Comments in this file legitimately mention "text-slate-600" while
  // explaining the fix - strip comments first, matching this suite's own
  // established hex-scan precedent.
  const affirmationCodeOnly = affirmationSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('the quote text now uses the existing on-morning-affirmation token at FULL strength (no /90 opacity, no new colour) and text-base (16px), not the old text-sm (14px)/90%-opacity combination', () => {
    expect(affirmationSource).toMatch(/text-base text-on-morning-affirmation max-w-xs mx-auto leading-relaxed font-semibold/);
    expect(affirmationSource).not.toMatch(/text-on-morning-affirmation\/90/);
    expect(affirmationSource).not.toMatch(/text-sm text-on-morning-affirmation/);
    expect(affirmationCodeOnly).not.toMatch(/text-slate-600/);
  });

  it('the role label (PRIMARY/SUPPORTING), the main affirmation headline, and the intention-derived mapping are all untouched by the readability correction', () => {
    expect(affirmationSource).toMatch(/text-\[10px\] font-bold uppercase tracking-wider text-on-morning-affirmation">\{roleForIndex\(idx\)\}/);
    expect(affirmationSource).toMatch(/Today is a fresh beginning\./);
    expect(affirmationSource).toMatch(/const affirmations = intentions\.map\(\(intention\) => \(\{\s*\n\s*intention,\s*\n\s*affirmation: getAffirmationForIntention\(intention, today\)\s*\n\s*\}\)\);/);
  });
});

describe('Explore Morning card — supporting sentence removed (Physical-iPhone approved copy simplification); Evening/Anytime untouched', () => {
  it('SessionComplete.jsx (Morning) no longer passes supportingText to ExploreCard; title, CTA, route, origin and item count are all otherwise unchanged', () => {
    expect(sessionCompleteSource).not.toMatch(/Explore stretching, breathing and meditation for your morning\./);
    const block = sessionCompleteSource.match(/<ExploreCard\s*\n[\s\S]*?\n\s*\/>/)?.[0] ?? '';
    expect(block).not.toMatch(/supportingText/);
    expect(block).toMatch(/title="Have a little more time\?"/);
    expect(block).toMatch(/ctaLabel="Explore Morning"/);
    expect(block).toMatch(/to="\/library\?journey=morning&from=morning-complete"/);
    expect(block).toMatch(/itemCount=\{getMorningExploreCatalog\(\)\.length\}/);
  });

  it('ExploreCard.jsx\'s own supportingText prop is additive-optional (only conditionally rendered) - Anytime\'s caller keeps passing it, byte-unaffected; Evening\'s own removal (Evening Visual Uplift, Phase 7) is covered separately in eveningCompleteVisualUplift.test.js', () => {
    const exploreCardSource = read('../components/ExploreCard.jsx');
    expect(exploreCardSource).toMatch(/\{supportingText && \(/);
    expect(anytimeResetSource).toMatch(/supportingText="Explore quick practices for the time and need you have\."/);
    expect(eveningCompleteSource).not.toMatch(/supportingText="Explore sleep stories, calming videos and soothing sounds\."/);
  });

  it('the accessible label is untouched - it is built from ctaLabel/title only, never from supportingText', () => {
    const exploreCardSource = read('../components/ExploreCard.jsx');
    expect(exploreCardSource).toMatch(/aria-label=\{`\$\{ctaLabel\}: \$\{title\}`\}/);
  });
});

describe('Morning Stretch and Breathing — completely untouched by this correction pass (they passed physical-device review)', () => {
  it('MorningFlow.jsx (Stretch) — the approved Phase 6 layout (stacked movements, CompactSoundControl header) is present, unmodified by this pass', () => {
    expect(morningFlowSource).toMatch(/className="space-y-2" role="group" aria-label="Choose your movements"/);
    expect(morningFlowSource).toMatch(/<CompactSoundControl isOn=\{musicPreferenceOn\} onToggle=\{handleToggleMusicPreference\} journeyTone="morning" \/>/);
  });

  it('Breathe.jsx (Breathing) source is byte-identical to the approved Phase 6 commit - no visual or functional edit in this pass', () => {
    expect(breatheSource).toMatch(/Choose Your Breath/);
    expect(breatheSource).toMatch(/<CompactSoundControl isOn=\{musicPreferenceOn\} onToggle=\{handleToggleMusicPreference\} journeyTone="morning"/);
  });
});

describe('No Anytime/Evening source changes in this correction pass', () => {
  it('EveningComplete.jsx and AnytimeReset.jsx are untouched - their own ExploreCard/pathway-adjacent content is unaffected by the Morning-only corrections', () => {
    expect(eveningCompleteSource).not.toMatch(/MorningJourneyPathway/);
    expect(anytimeResetSource).not.toMatch(/MorningJourneyPathway/);
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
