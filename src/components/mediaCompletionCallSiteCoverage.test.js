// WakeWise guided-media completion phase — call-site coverage.
//
// BetaVideoModal.jsx, mediaCompletionPresentation.js and
// outcomeMessages.js's shuffled-bag rotation (the shared implementation
// itself) are covered by betaVideoModalSharedCompletion.test.js,
// mediaCompletionPresentation.test.js and outcomeMessages.test.js
// respectively. This file is the one place that checks every one of the
// 10 real call sites this phase migrated, in one pass: each one's
// completionContext (journey + primary/secondary action wiring), the
// "already-completed exercise panel" structural guarantee, that
// BetaVideoModal never trusts an unvalidated journey string directly, and
// that no onboarding/QA content gained a completionContext it shouldn't
// have. No DOM/component rendering is available in this repo's Vitest -
// source-level checks, matching every other regression guard in this
// codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('Every migrated call site passes a real, allowlisted completionContext.journey - never guessed from time-of-day or route history', () => {
  const cases = [
    // [file, expected completionContext substring]
    ['../pages/Breathe.jsx', "completionContext={{ journey: 'morning', onPrimaryAction: closeVideo, onSecondaryAction: closeVideo }}"],
    ['../pages/MorningFlow.jsx', "completionContext={{ journey: 'morning', onPrimaryAction: closeVideo, onSecondaryAction: closeVideo }}"],
    ['../pages/PrepareForRest.jsx', "completionContext={{ journey: 'evening', onPrimaryAction: closeVideo, onSecondaryAction: closeVideo }}"],
    ['../pages/Library.jsx', "completionContext={{ journey: 'library', onPrimaryAction: closeVideo, onSecondaryAction: closeVideo }}"],
    ['./evening/PromptStepper.jsx', "completionContext={{ journey: journeyTone, onPrimaryAction: closeVideo, onSecondaryAction: closeVideo }}"],
    ['../pages/QuietBreathing.jsx', "completionContext={{ journey: 'direct', onPrimaryAction: closeVideo }}"],
    ['../pages/Grounding.jsx', "completionContext={{ journey: 'direct', onPrimaryAction: closeVideo }}"]
  ];

  it.each(cases)('%s carries the expected completionContext', (path, expected) => {
    const source = read(path);
    expect(source).toContain(expected);
  });

  // These three migrated their own pre-existing, separate completion
  // architecture (an inline panel, or a dedicated /*-complete route) onto
  // the shared overlay, so their completionContext is a multi-line object
  // rather than a one-line literal - checked individually below.

  it('AnytimeReset.jsx: journey "anytime" - primary "Choose Another Session" un-completes this screen, secondary "Return Home" navigates Home, both real, reachable destinations', () => {
    const source = read('../pages/AnytimeReset.jsx');
    const block = source.match(/completionContext=\{\{[\s\S]*?\n {10}\}\}/)?.[0] ?? '';
    expect(block).toMatch(/journey: 'anytime',/);
    expect(block).toMatch(/onPrimaryAction: \(\) => \{\s*\n\s*setIsComplete\(false\);\s*\n\s*setOpenVideoId\(null\);\s*\n\s*\},/);
    expect(block).toMatch(/onSecondaryAction: \(\) => \{\s*\n\s*setIsComplete\(false\);\s*\n\s*setOpenVideoId\(null\);\s*\n\s*navigate\('\/'\);\s*\n\s*\}/);
  });

  it('Meditate.jsx: journey "direct" (no explicit journey/journeyTone marker exists anywhere on this page, so the honest fallback is used, never a guessed "anytime") - primary just closes, secondary "Explore Another Session" only offered when a genuinely different session exists', () => {
    const source = read('../pages/Meditate.jsx');
    expect(source).not.toMatch(/journeyTone|journey="/);
    const block = source.match(/completionContext=\{\{[\s\S]*?\n\s*\}\}/)?.[0] ?? '';
    expect(block).toMatch(/journey: 'direct',/);
    expect(block).toMatch(/onPrimaryAction: \(\) => setOpenVideoId\(null\),/);
    expect(block).toMatch(/onSecondaryAction: items\.length > 1/);
  });

  it('Support.jsx: journey "anytime" (this page\'s own already-explicit tone, EveningSceneShell journey="anytime") - primary "Choose Another Session" only cycles when a second option genuinely exists, secondary "Return Home" navigates Home', () => {
    const source = read('../pages/Support.jsx');
    expect(source).toMatch(/journey="anytime"/);
    const block = source.match(/completionContext=\{\{[\s\S]*?\n {10}\}\}/)?.[0] ?? '';
    expect(block).toMatch(/journey: 'anytime',/);
    expect(block).toMatch(/onPrimaryAction: \(\) => \{\s*\n\s*if \(mapping\.options\.length > 1\) handleChooseAnother\(\);\s*\n\s*setOpenVideoId\(null\);\s*\n\s*\},/);
    expect(block).toMatch(/onSecondaryAction: \(\) => \{\s*\n\s*setOpenVideoId\(null\);\s*\n\s*navigate\('\/'\);\s*\n\s*\}/);
  });
});

describe('Embedded/optional-guidance call sites deliberately never expose the table\'s literal "Return Home"/journey-tinted secondary action while mid-exercise', () => {
  // Safety reasoning: Breathe.jsx/MorningFlow.jsx/QuietBreathing.jsx's own
  // standalone branch/Grounding.jsx open guided media WHILE a real timed
  // exercise (breathing/stretching/5-4-3-2-1) is still active underneath.
  // The morning/anytime table rows' own secondary action ("Choose Another
  // Session"/"Return Home") would silently eject the user from that still-
  // running exercise with no confirmation - exactly the class of defect
  // this whole engagement has repeatedly found and fixed elsewhere. Both
  // actions on these four call sites are therefore just closeVideo (stay
  // right here, exercise keeps running) - Breathe.jsx/MorningFlow.jsx keep
  // the morning tone/copy (closing IS "continuing" the still-active
  // routine), QuietBreathing.jsx/Grounding.jsx use the safe 'direct'
  // fallback with no secondary at all, matching the Direct/unknown row's
  // own "only when a valid destination exists" allowance.
  it('QuietBreathing.jsx and Grounding.jsx omit onSecondaryAction entirely - never a bare "undefined" destination offered', () => {
    for (const path of ['../pages/QuietBreathing.jsx', '../pages/Grounding.jsx']) {
      const source = read(path);
      const block = source.match(/completionContext=\{\{[^}]*\}\}/)?.[0] ?? '';
      expect(block).not.toMatch(/onSecondaryAction/);
    }
  });

  it('Breathe.jsx and MorningFlow.jsx point both actions at the existing closeVideo handler (no navigation away from the still-running exercise)', () => {
    for (const path of ['../pages/Breathe.jsx', '../pages/MorningFlow.jsx']) {
      const source = read(path);
      const block = source.match(/completionContext=\{\{[^}]*\}\}/)?.[0] ?? '';
      expect(block).toMatch(/onPrimaryAction: closeVideo/);
      expect(block).toMatch(/onSecondaryAction: closeVideo/);
    }
  });
});

describe('Already-completed exercise panel — guided media can never be opened from inside it (structural, not just a runtime guard)', () => {
  // Breathe.jsx/MorningFlow.jsx/QuietBreathing.jsx are the only three call
  // sites with their own in-place "isCompleted, same screen" panel (every
  // other call site either has no distinct completed state at all, or
  // navigates to a different route entirely on completion). Their guided-
  // video disclosure (BetaVideoRow) is proven here to render ONLY in the
  // pre-start/active branches, never inside that isCompleted branch - so
  // "guided media opened from an already-completed exercise panel" cannot
  // occur via any of these three, and there is therefore nothing that
  // could ever double-record the host exercise's own completion.
  const boundedIsCompletedBranch = (source) => {
    const start = source.indexOf(') : isCompleted ? (');
    const end = source.indexOf(') : (', start + 1);
    return source.slice(start, end);
  };

  it('Breathe.jsx: zero BetaVideoRow inside the isCompleted branch', () => {
    const source = read('../pages/Breathe.jsx');
    expect(boundedIsCompletedBranch(source)).not.toMatch(/BetaVideoRow/);
  });

  it('MorningFlow.jsx: zero BetaVideoRow inside the isCompleted branch', () => {
    const source = read('../pages/MorningFlow.jsx');
    expect(boundedIsCompletedBranch(source)).not.toMatch(/BetaVideoRow/);
  });

  it('QuietBreathing.jsx: zero BetaVideoRow inside the isCompleted||earlyEnded branch', () => {
    const source = read('../pages/QuietBreathing.jsx');
    const start = source.indexOf('{isCompleted || earlyEnded ? (');
    const end = source.indexOf(') : (', start + 1);
    expect(source.slice(start, end)).not.toMatch(/BetaVideoRow/);
  });

  it('AnytimeReset.jsx/Support.jsx/Meditate.jsx have no in-place "isCompleted, same screen, still offering a NEW video pick" panel any more - the recommend/recommendation view always falls straight to the one live RecommendationCard (or an option already tied to the current openVideo), so there is no separate completed state that could open a second, different video and double-record anything', () => {
    expect(read('../pages/AnytimeReset.jsx')).not.toMatch(/isComplete \? \(/);
    // Meditate.jsx/Support.jsx never had a page-level isComplete/isCompleted
    // state to begin with - confirmed by the absence of any such flag now.
    expect(read('../pages/Meditate.jsx')).not.toMatch(/isComplete/);
    expect(read('../pages/Support.jsx')).not.toMatch(/isComplete|videoEndedNaturally/);
  });
});

describe('BetaVideoModal.jsx never trusts an unvalidated journey string directly - the allowlist lives in one place', () => {
  it('completionContext.journey is only ever passed through getMediaCompletionPresentation, which itself falls back to \'direct\' for anything unrecognised (see mediaCompletionPresentation.test.js\'s own dedicated coverage)', () => {
    const source = read('./BetaVideoModal.jsx');
    expect(source).toMatch(/import \{ getMediaCompletionPresentation \} from '\.\.\/lib\/mediaCompletionPresentation';/);
    expect(source).toMatch(/getMediaCompletionPresentation\(completionContext\.journey\)/);
    // completionContext.journey is never interpolated into a className,
    // style, or any other rendered string directly - only ever handed to
    // the allowlisting helper above.
    expect(source).not.toMatch(/\$\{completionContext\.journey\}/);
  });
});

describe('No newly-exposed content - onboarding/QA/admin call sites remain completely untouched by this phase', () => {
  it('Introduction.jsx and Beta.jsx pass no completionContext at all - their BetaVideoModal usage (if any) is unaffected, matching every other caller\'s additive default', () => {
    for (const path of ['../pages/Introduction.jsx', '../pages/Beta.jsx']) {
      const source = read(path);
      expect(source).not.toMatch(/completionContext/);
    }
  });

  it('neither BetaVideoModal.jsx, mediaCompletionPresentation.js, nor outcomeMessages.js (the new shared implementation itself) ever reference INTERACTIVE_ONLY_IDS, betaVideoManifest, or mediaCatalog directly - this phase adds a completion experience for whatever the catalogue already exposes, it never re-implements or widens that catalogue\'s own filtering', () => {
    for (const path of ['./BetaVideoModal.jsx', '../lib/mediaCompletionPresentation.js', '../lib/outcomeMessages.js']) {
      const source = read(path);
      expect(source).not.toMatch(/INTERACTIVE_ONLY_IDS|betaVideoManifest|BETA_VIDEO_MANIFEST/);
    }
    // BetaVideoModal.jsx already imported getBetaVideoById from
    // mediaCatalog.js before this phase (pre-existing, for its own
    // duration-cache/music-toggle lookups) - unrelated to this phase, and
    // still the one, already-filtered catalogue (MEDIA_CATALOG, not the
    // raw manifest), so it carries no ability to reach an excluded id.
    expect(read('./BetaVideoModal.jsx')).toMatch(/import \{ getBetaVideoById \} from '\.\.\/lib\/mediaCatalog';/);
    expect(read('./BetaVideoModal.jsx')).not.toMatch(/from '\.\.\/lib\/betaVideoManifest'/);
  });
});
