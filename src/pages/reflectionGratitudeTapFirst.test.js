// Phase 3 (Reflection/Gratitude tap-first redesign) — approved preset
// options, guidance-item mapping, layout, single-select persistence
// contract, and the fixed per-question back-navigation matrix. No DOM
// rendering is available in this repo's Vitest - source-level checks,
// matching every other regression guard in this codebase (real,
// importable/pure logic - parseActiveIndex - is covered instead by
// genuine execution in questionStepNavigation.test.js).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const reflectionSource = read('./Reflection.jsx');
const gratitudeSource = read('./Gratitude.jsx');
const promptStepperSource = read('../components/evening/PromptStepper.jsx');

const REFLECTION_OPTIONS = {
  'went-well': [
    'Reached a small milestone',
    'Had a peaceful moment',
    'Had a meaningful conversation',
    'Stayed calm in a difficult moment',
    'Got outside or moved',
    'Helped someone',
    'Handled a difficult task',
    'Simply got through the day'
  ],
  challenged: [
    'Too much to do',
    'Difficult conversation',
    'Low energy',
    'Worry or uncertainty',
    'Trouble staying focused',
    'Felt rushed',
    'Plans changed',
    'Something personal'
  ],
  release: [
    "Today's stress",
    "A worry I'm carrying",
    "What I can't control",
    'A mistake I made',
    'Comparing myself to others',
    'An unfinished task',
    "Tension I'm holding",
    'Not sure yet'
  ]
};

const GRATITUDE_OPTIONS = {
  'appreciated-moment': [
    'Morning stillness',
    'A comforting meal',
    'Kindness from someone',
    'A song that lifted me',
    'Feeling at home',
    'A moment of relief',
    'Fresh air or movement',
    'A quiet pause'
  ],
  'who-made-better': [
    'Partner or family',
    'Friend',
    'Colleague',
    'Someone who helped',
    'Someone who listened',
    'A kind stranger',
    'My community',
    'I supported myself'
  ],
  'grateful-now': [
    'This quiet moment',
    'Someone who cares about me',
    'A place where I feel safe',
    'Something that made me smile',
    'A small comfort',
    'A fresh start tomorrow',
    'My own effort today',
    'Simply being here'
  ]
};

describe('Reflection.jsx - exact approved preset options, per question', () => {
  for (const [promptId, options] of Object.entries(REFLECTION_OPTIONS)) {
    it(`"${promptId}" has exactly its 8 approved options, in order, and no others`, () => {
      const block = reflectionSource.match(new RegExp(`id: '${promptId}',[\\s\\S]*?options: \\[([\\s\\S]*?)\\]`))?.[1] ?? '';
      const found = [...block.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map((m) => (m[1] ?? m[2]).replace(/\\'/g, "'"));
      expect(found).toEqual(options);
    });
  }

  it('no preset option string is reused across Reflection\'s three questions (each question\'s choices are its own, never a shared generic list)', () => {
    const all = Object.values(REFLECTION_OPTIONS).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('Gratitude.jsx - exact approved preset options, per question', () => {
  for (const [promptId, options] of Object.entries(GRATITUDE_OPTIONS)) {
    it(`"${promptId}" has exactly its 8 approved options, in order, and no others`, () => {
      const block = gratitudeSource.match(new RegExp(`id: '${promptId}',[\\s\\S]*?options: \\[([\\s\\S]*?)\\]`))?.[1] ?? '';
      const found = [...block.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)].map((m) => (m[1] ?? m[2]).replace(/\\'/g, "'"));
      expect(found).toEqual(options);
    });
  }

  it('no preset option string is reused across Gratitude\'s three questions', () => {
    const all = Object.values(GRATITUDE_OPTIONS).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('Approved real guidance catalogue mapping - real ids only, capped at 2 per question, never reused merely to pad a second card', () => {
  it('Reflection: went-well -> E10+M05, challenged -> E17+E16, release -> E19+E21', () => {
    expect(reflectionSource).toMatch(/id: 'went-well',[\s\S]*?guidance: \[\s*\n\s*\{ id: 'E10',[\s\S]*?\{ id: 'M05',/);
    expect(reflectionSource).toMatch(/id: 'challenged',[\s\S]*?guidance: \[\s*\n\s*\{ id: 'E17',[\s\S]*?\{ id: 'E16',/);
    expect(reflectionSource).toMatch(/id: 'release',[\s\S]*?guidance: \[\s*\n\s*\{ id: 'E19',[\s\S]*?\{ id: 'E21',/);
  });

  it('Gratitude: appreciated-moment -> E23+M04, who-made-better -> M03 only, grateful-now -> A05 only (not enough genuinely relevant items to pad the last two to 2 - approved as-is)', () => {
    expect(gratitudeSource).toMatch(/id: 'appreciated-moment',[\s\S]*?guidance: \[\s*\n\s*\{ id: 'E23',[\s\S]*?\{ id: 'M04',/);
    const whoBlock = gratitudeSource.match(/id: 'who-made-better',[\s\S]*?guidance: \[([\s\S]*?)\]/)?.[1] ?? '';
    expect([...whoBlock.matchAll(/id: '([A-Z0-9]+)'/g)].map((m) => m[1])).toEqual(['M03']);
    const gratefulBlock = gratitudeSource.match(/id: 'grateful-now',[\s\S]*?guidance: \[([\s\S]*?)\]/)?.[1] ?? '';
    expect([...gratefulBlock.matchAll(/id: '([A-Z0-9]+)'/g)].map((m) => m[1])).toEqual(['A05']);
  });

  it('E23/M04 (Gratitude Q1\'s own items) are not repeated under Q2 or Q3 merely to create a second card', () => {
    const q2q3 = gratitudeSource.match(/id: 'who-made-better'[\s\S]*$/)?.[0] ?? '';
    expect(q2q3).not.toMatch(/id: 'E23'/);
    expect(q2q3).not.toMatch(/id: 'M04'/);
  });

  it('no guidance item exceeds 2 entries for any question in either file', () => {
    const guidanceBlocks = [...reflectionSource.matchAll(/guidance: \[([\s\S]*?)\]/g), ...gratitudeSource.matchAll(/guidance: \[([\s\S]*?)\]/g)];
    for (const [, block] of guidanceBlocks) {
      const count = [...block.matchAll(/id: '[A-Z0-9]+'/g)].length;
      expect(count).toBeLessThanOrEqual(2);
    }
  });
});

describe('Layout: Reflection Q1 uses full-width rows (long labels), every other question uses the 2-column grid', () => {
  it('Reflection "went-well" declares layout: \'rows\' - its own approved labels run up to 34 characters, too long for a readable 2-up grid at 320px', () => {
    expect(reflectionSource).toMatch(/id: 'went-well',\s*\n\s*label: '[^']*',\s*\n\s*layout: 'rows',/);
  });

  it('every other Reflection/Gratitude question has no layout override (defaults to the 2-column grid in PromptStepper)', () => {
    const otherReflection = reflectionSource.replace(/id: 'went-well',[\s\S]*?\},\n {2}\{/, '{');
    expect(otherReflection).not.toMatch(/layout: 'rows'/);
    expect(gratitudeSource).not.toMatch(/layout: 'rows'/);
  });

  // Phase 3 UX correction: physical-device feedback that the shared
  // SelectionChip/SelectionRow controls (checkmark/chevron, subtle tint)
  // read as small tick controls, not clear buttons. Reflection/Gratitude
  // now use a dedicated AnswerOptionButton instead - SelectionChip/
  // SelectionRow are UNTOUCHED and still used exactly as before by
  // ChangeIntention.jsx/AnytimeReset.jsx/Meditate.jsx (see
  // answerOptionButton.test.js's own "does not touch" check).
  it('PromptStepper renders the same AnswerOptionButton for both layouts - full-width rows (space-y-3) when layout === \'rows\', a 2-column grid (centered) otherwise - never the old SelectionChip/SelectionRow', () => {
    expect(promptStepperSource).toMatch(/activePrompt\.layout === 'rows' \? \(/);
    expect(promptStepperSource).toMatch(/<AnswerOptionButton/);
    expect(promptStepperSource).toMatch(/grid grid-cols-2 gap-3/);
    expect(promptStepperSource).not.toMatch(/<SelectionRow/);
    expect(promptStepperSource).not.toMatch(/<SelectionChip/);
    expect(promptStepperSource).not.toMatch(/from '\.\.\/journey\/SelectionChip'/);
    expect(promptStepperSource).not.toMatch(/from '\.\.\/journey\/SelectionRow'/);
  });

  it('the grid layout passes centered (narrower tiles read better centered), rows does not (a wide rectangle reads better left-aligned) - and accent is passed straight through from the page, not decided in PromptStepper', () => {
    const gridBlock = promptStepperSource.match(/grid grid-cols-2 gap-3[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(gridBlock).toMatch(/<AnswerOptionButton[\s\S]{0,200}accent=\{accent\}[\s\S]{0,40}centered/);
    const rowsBlock = promptStepperSource.match(/space-y-3" role="group"[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(rowsBlock).toMatch(/<AnswerOptionButton[\s\S]{0,200}accent=\{accent\}/);
    expect(rowsBlock).not.toMatch(/centered/);
  });

  it('every approved option string across both pages is short enough to stay fully readable and unclipped even in the 2-column grid (<= 34 chars - the longest, Reflection Q1\'s own, is the one question routed to full-width rows instead)', () => {
    const allOptions = [...Object.values(REFLECTION_OPTIONS).flat(), ...Object.values(GRATITUDE_OPTIONS).flat()];
    for (const label of allOptions) {
      expect(label.length).toBeLessThanOrEqual(34);
    }
  });
});

describe('Copy: single-select supporting line replaces any "Tap all that apply" framing', () => {
  it('PromptStepper shows "Choose the option that feels closest, or add your own." under every question title', () => {
    expect(promptStepperSource).toMatch(/Choose the option that feels closest, or add your own\./);
  });

  it('no "Tap all that apply" (or equivalent multi-select) wording exists anywhere in the tap-first flow', () => {
    expect(promptStepperSource).not.toMatch(/Tap all that apply/i);
    expect(reflectionSource).not.toMatch(/Tap all that apply/i);
    expect(gratitudeSource).not.toMatch(/Tap all that apply/i);
  });
});

describe('Single-select persistence (Build 15): no schema change, no multi-select, no delimiters/JSON/opaque ids ever stored', () => {
  it('routine_responses.js is untouched by this phase - still a single plain-text `response` column, same conflict target', () => {
    const routineResponsesSource = read('../lib/routineResponses.js');
    expect(routineResponsesSource).toMatch(/const CONFLICT_TARGET = 'user_id,session_id,step_id,prompt_id,local_date';/);
  });

  it('no multi-select data structure (an array/Set of selected values) is ever introduced - PromptStepper\'s answers map is always { [promptId]: string }', () => {
    expect(promptStepperSource).not.toMatch(/new Set\(/);
    expect(promptStepperSource).not.toMatch(/selectedOptions/);
    expect(promptStepperSource).not.toMatch(/JSON\.stringify\(answers/);
  });

  it('every stored preset value is the option\'s own real display text, never an emoji or an opaque id - handleSelectPreset writes `value` (the tapped option string) directly, and no option list anywhere uses an id/emoji in place of real text', () => {
    expect(promptStepperSource).toMatch(/onChange\?\.\(activePrompt\.id, value\);/);
    const allOptions = [...Object.values(REFLECTION_OPTIONS).flat(), ...Object.values(GRATITUDE_OPTIONS).flat()];
    for (const label of allOptions) {
      expect(label).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('Historical custom-answer restoration and preset re-selection (derived, not separately stored)', () => {
  it('a saved response that does NOT match any of its question\'s options seeds the custom field already expanded, showing historical free text immediately', () => {
    expect(promptStepperSource).toMatch(/seed\[p\.id\] = Boolean\(value && !p\.options\?\.includes\(value\)\);/);
  });

  it('a saved response that DOES exactly match one of its question\'s options is read as that preset selected - a pure derived comparison, no separate "which preset" flag ever stored', () => {
    expect(promptStepperSource).toMatch(/const selectedOption = activePrompt\.options\?\.find\(\(opt\) => opt === currentValue\) \?\? null;/);
  });
});

describe('Fixed per-question back-navigation matrix (Decision 5)', () => {
  it('Reflection Q1 Back -> Evening Wind-Down; Q2 Back -> Reflection Q1; Q3 Back -> Reflection Q2', () => {
    expect(reflectionSource).toMatch(/const backFallbackForIndex = \(activeIndex\) => \(activeIndex === 0 \? '\/evening-wind-down' : `\/reflection\?q=\$\{activeIndex\}`\);/);
  });

  it('Gratitude Q1 Back -> Reflection Q3 (the fixed limitation - not Reflection Q1); Q2 Back -> Gratitude Q1; Q3 Back -> Gratitude Q2', () => {
    expect(gratitudeSource).toMatch(/const backFallbackForIndex = \(activeIndex\) => \(activeIndex === 0 \? '\/reflection\?q=3' : `\/gratitude\?q=\$\{activeIndex\}`\);/);
  });

  it('both pages pass the computed per-question fallback into EveningSceneShell\'s own showBack/backFallback - the shared circular BackButton is the only back control (PromptStepper itself renders none)', () => {
    expect(reflectionSource).toMatch(/showBack backFallback=\{backFallbackForIndex\(activeIndex\)\}/);
    expect(gratitudeSource).toMatch(/showBack backFallback=\{backFallbackForIndex\(activeIndex\)\}/);
    expect(promptStepperSource).not.toMatch(/<BackButton/);
  });

  it('forward navigation between questions within a page is a real navigate() (handleAdvance), not local setState - this is what makes the shared BackButton\'s own in-app-history check land correctly on the previous question when one was genuinely just visited', () => {
    expect(reflectionSource).toMatch(/const handleAdvance = \(nextIndex\) => navigate\(`\/reflection\?q=\$\{nextIndex \+ 1\}`\);/);
    expect(gratitudeSource).toMatch(/const handleAdvance = \(nextIndex\) => navigate\(`\/gratitude\?q=\$\{nextIndex \+ 1\}`\);/);
  });
});

describe('No duplicate completion when reviewing across the Reflection/Gratitude boundary', () => {
  it('the ONE real completion event (advanceStep, guarded on isReviewMode/isLiveStep) is unchanged by this phase - reviewing Reflection Q3 from Gratitude Q1 never replays it, since handleComplete only fires on an explicit Next/Skip tap at the true last question, never merely by loading a question via the back-navigation matrix above', () => {
    for (const source of [reflectionSource, gratitudeSource]) {
      const body = source.match(/const handleComplete = \(answers\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
      expect(body).toMatch(/if \(isReviewMode\) \{\s*\n\s*if \(currentStep\) navigate\(routeForStep\(currentStep\.id\)\);\s*\n\s*return;\s*\n\s*\}/);
      expect(body).toMatch(/if \(state\.status === 'playing' && currentStep\?\.id === STEP_ID\) \{\s*\n\s*advanceStep\(\);\s*\n\s*\}/);
    }
  });

  it('visiting a question (activeIndex changing) never itself calls onComplete/onAdvance - both are only invoked from the explicit Next/Skip click handlers', () => {
    const nextBody = promptStepperSource.match(/const handleNext = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const skipBody = promptStepperSource.match(/const handleSkip = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(nextBody).toMatch(/onComplete\?\.\(answers\)|onAdvance\?\.\(activeIndex \+ 1\)/);
    expect(skipBody).toMatch(/onComplete\?\.\(rest\)|onAdvance\?\.\(activeIndex \+ 1\)/);
    expect(promptStepperSource).not.toMatch(/if \(activeIndex !== prevActiveIndex\)[\s\S]{0,120}onComplete/);
    expect(promptStepperSource).not.toMatch(/if \(activeIndex !== prevActiveIndex\)[\s\S]{0,120}onAdvance/);
  });
});

describe('Guidance video Close restores the exact question and response', () => {
  it('BetaVideoModal is mounted once inside PromptStepper, layered on top - closing it (closeVideo) only clears openVideoId, never touches activeIndex or answers', () => {
    expect(promptStepperSource).toMatch(/\{openVideo && \(\s*\n\s*<BetaVideoModal entry=\{openVideo\} onClose=\{closeVideo\} \/>\s*\n\s*\)\}/);
    expect(promptStepperSource).not.toMatch(/onClose=\{closeVideo\}[\s\S]{0,200}(setAnswers|setActiveIndex|onAdvance|onComplete)/);
  });
});

describe('Real guidance content only - real titles/descriptions from betaVideoManifest.js, actual cached duration or the existing "Guided video" fallback, never a fabricated number', () => {
  it('duration is computed as entry.durationLabel || cached "~N min" || the existing plain "Guided video" fallback - the same established pattern already used by Library.jsx/Support.jsx/BetaVideoModal.jsx, never a made-up number', () => {
    expect(promptStepperSource).toMatch(/const duration = entry\.durationLabel \|\| \(cachedMinutes \? `~\$\{cachedMinutes\} min` : 'Guided video'\);/);
  });

  it('guidance rows use the manifest\'s own real entry.title, never a hand-typed display string', () => {
    expect(promptStepperSource).toMatch(/title=\{entry\.title\}/);
  });
});

describe('Phase 3 UX correction - each page passes its own section accent through to PromptStepper, unchanged otherwise', () => {
  it('Reflection.jsx passes accent="reflection"; Gratitude.jsx passes accent="gratitude"', () => {
    expect(reflectionSource).toMatch(/<PromptStepper[\s\S]*?accent="reflection"[\s\S]*?\/>/);
    expect(gratitudeSource).toMatch(/<PromptStepper[\s\S]*?accent="gratitude"[\s\S]*?\/>/);
  });

  it('PromptStepper declares accent as a prop and forwards it verbatim to every AnswerOptionButton - it never picks a colour itself', () => {
    expect(promptStepperSource).toMatch(/export const PromptStepper = \(\{ prompts, activeIndex, initialAnswers, onChange, onClear, onAdvance, onComplete, accent \}\) => \{/);
    const accentUsages = promptStepperSource.match(/accent=\{accent\}/g) ?? [];
    expect(accentUsages.length).toBe(2); // one per layout branch (rows, grid)
  });
});

describe('Phase 3 UX correction - "Add your own" disclosure: edit icon (not a chevron), no reused checkmark styling, accent tint only while expanded', () => {
  it('uses a static "edit" icon, never chevron_right/rotate (that directional treatment is reserved for the still-unchanged guidance disclosure)', () => {
    const customBlock = promptStepperSource.match(/onClick=\{handleToggleCustom\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(customBlock).toMatch(/material-symbols-outlined text-sm" aria-hidden="true">\s*\n\s*edit/);
    expect(customBlock).not.toMatch(/chevron_right/);
    expect(customBlock).not.toMatch(/rotate\(/);
    expect(customBlock).toMatch(/aria-expanded=\{isCustomOpen\}/);
  });

  it('expanded state tints icon+label with the section\'s own accent colour (text-only, never a filled/bordered button) - explicitly distinct from a selected preset answer', () => {
    const customBlock = promptStepperSource.match(/onClick=\{handleToggleCustom\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(customBlock).toMatch(/accent === 'gratitude' \? 'text-gratitude-accent' : 'text-primary'/);
    expect(customBlock).not.toMatch(/bg-primary|bg-gratitude-accent|border-primary|border-gratitude-accent/);
  });
});
