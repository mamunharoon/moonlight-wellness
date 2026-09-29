// Source-level regression guard for SelfGuidedMeditationComplete.jsx - same
// "no rendering engine" constraint as every comparable existing test in
// this repo (see selfGuidedMeditationSetup.test.js's own header comment).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./SelfGuidedMeditationComplete.jsx', import.meta.url)), 'utf-8');

describe('SelfGuidedMeditationComplete.jsx — outcome-aware messaging correction: reuses the shared Phase 2 model instead of a fixed hand-written string', () => {
  it('derives heading/body from getOutcomeMessage(OUTCOME.COMPLETED, journeyTone, today) - no hardcoded "Meditation complete" string remains', () => {
    expect(source).toMatch(/getOutcomeMessage\(OUTCOME\.COMPLETED, journeyTone, today\)/);
    expect(source).not.toMatch(/>Meditation complete</);
    expect(source).not.toMatch(/>Take this steadiness with you\.</);
  });

  it('renders the derived headline/body directly for a non-anytimeOrigin visit (Anytime Visual Flow and Closing Handoff uplift, Part 11: the shared AnytimeClosingHandoff instead renders the new rotating completionGreeting, gated on the explicit anytimeOrigin marker - see the dedicated Anytime-only describe block below)', () => {
    expect(source).toMatch(/<h1 className="font-serif italic text-3xl text-on-surface" role="status">\{completionHeadline\}<\/h1>/);
    expect(source).toMatch(/\{completionBody\}/);
  });
});

describe('SelfGuidedMeditationComplete.jsx — exactly the three approved actions', () => {
  it('renders Done, Meditate Again, and Choose Another Meditation', () => {
    expect(source).toMatch(/<span>Done<\/span>/);
    expect(source).toMatch(/>\s*Meditate Again\s*</);
    expect(source).toMatch(/>\s*Choose Another Meditation\s*</);
  });
});

describe('SelfGuidedMeditationComplete.jsx — Done routes via the allowlisted context, never a raw value', () => {
  it('resolves context from session.from through the shared allowlist resolver', () => {
    expect(source).toMatch(/const context = resolveSelfGuidedMeditationContext\(session\?\.from\);/);
    // Context-aware Breathing/Meditation theming — handleDone now routes
    // through the centralized exitPracticeToHome helper (clears the
    // captured practice journey tone, then navigates) rather than a bare
    // clear+navigate pair - a real exit-to-Home should never leak into a
    // later, unrelated practice - see practiceJourneyContext.js.
    const handleDoneBody = source.match(/const handleDone = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handleDoneBody).toMatch(/exitPracticeToHome\(navigate, context\.fallback\);/);
  });
});

describe('SelfGuidedMeditationComplete.jsx — Meditate Again / Choose Another Meditation preserve style+duration and require a new Begin', () => {
  it('both navigate back to setup with the finished session\'s styleId/durationId/soundId in router state', () => {
    const meditateAgainBody = source.match(/const handleMeditateAgain = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const chooseAnotherBody = source.match(/const handleChooseAnotherMeditation = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    for (const body of [meditateAgainBody, chooseAnotherBody]) {
      expect(body).toMatch(/navigate\(`\/self-guided-meditation/);
      expect(body).toMatch(/styleId: style\.id, durationId: duration\.id, soundId: session\?\.soundId/);
    }
  });

  it('neither handler calls createMeditationSessionController or otherwise auto-starts a session - Begin still requires its own fresh tap on the setup screen', () => {
    expect(source).not.toMatch(/createMeditationSessionController/);
  });
});

describe('SelfGuidedMeditationComplete.jsx — no fabricated history, no completion-flag writes', () => {
  // Strips comments first (the doc comment above deliberately explains, in
  // prose, why getMeditationCompletionKey is NOT used here - matching
  // libraryHomeReturnContext.test.js's own established "strip comments
  // before checking real code" approach) so this checks actual imports/
  // calls, never the prose explaining their absence.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('never imports getMeditationCompletionKey/dailyCompletion.js - the existing guided-wizard "meditated today" pill must never be touched by this feature', () => {
    expect(code).not.toMatch(/dailyCompletion/);
    expect(code).not.toMatch(/getMeditationCompletionKey/);
  });

  it('never writes to localStorage at all', () => {
    expect(code).not.toMatch(/localStorage/);
  });

  it('never imports the Session Engine (Morning/Evening completion state is untouched)', () => {
    expect(source).not.toMatch(/from '\.\.\/context\/SessionContext'/);
    expect(source).not.toMatch(/useSession/);
  });
});

describe('SelfGuidedMeditationComplete.jsx — a visible accessible Back control, real shared BackButton', () => {
  it('uses the shared BackButton with backDestination (WakeWise DEV Anytime Back-navigation correction) and the resolved context\'s label, clearing the captured practice journey tone before it navigates away', () => {
    expect(source).toMatch(/import \{ BackButton \} from '\.\.\/components\/BackButton';/);
    expect(source).toMatch(
      /<BackButton\s*\n\s*fallback=\{backDestination\}\s*\n\s*label=\{context\.label\}\s*\n\s*guardActiveRoute=\{false\}\s*\n[\s\S]*?\s*alwaysFallback=\{anytimeOrigin\}\s*\n\s*onBeforeLeave=\{\(\) => \{\s*\n\s*clearPracticeJourneyTone\(\);\s*\n\s*\}\}\s*\n\s*\/>/
    );
  });

  it('the BackButton\'s alwaysFallback={anytimeOrigin} forces Back straight to backDestination, never goBack()\'s own real-navigate(-1)-preferring behaviour, when genuinely reached from Anytime Reset', () => {
    expect(source).toMatch(/alwaysFallback=\{anytimeOrigin\}/);
  });

  it('backDestination resolves to the preserved Anytime Reset recommendation via the explicit, allowlist-validated anytimeOrigin marker (resolveAnytimeOrigin - never journeyTone/browser history), falling back to context.fallback (Home) only when not genuinely reached from Anytime Reset', () => {
    expect(source).toMatch(/import \{ resolveAnytimeOrigin \} from '\.\.\/lib\/anytimeOrigin';/);
    expect(source).toMatch(/const \{ anytimeOrigin, anytimeResetDestination \} = resolveAnytimeOrigin\(session\);/);
    expect(source).toMatch(/const backDestination = anytimeOrigin \? anytimeResetDestination : context\.fallback;/);
  });
});

describe('SelfGuidedMeditationComplete.jsx — touch targets', () => {
  it('all three action buttons carry the 44px minimum', () => {
    const minHeightMatches = source.match(/min-h-\[44px\]/g) ?? [];
    expect(minHeightMatches.length).toBeGreaterThanOrEqual(3);
  });
});

// Anytime Visual Flow and Closing Handoff uplift (Part 9/Part 11) — a
// Meditate practice reached through Anytime Reset's own "Or choose
// another quick reset" gets the shared two-action AnytimeClosingHandoff
// (Continue My Day / Choose Another Reset), gated on the explicit,
// allowlist-validated anytimeOrigin marker - never the merely-cosmetic
// journeyTone - instead of the generic Done/Meditate Again/Choose Another
// Meditation trio. WakeWise DEV — simplified Anytime completion panel:
// "Explore More" was removed from this panel entirely; Library/Explore
// access elsewhere in the app is unaffected. Reached any other way (Home/
// Library's Meditate tiles), anytimeOrigin is false and the trio is
// completely unchanged.
describe('SelfGuidedMeditationComplete.jsx — Anytime-only completion gating', () => {
  it('renders the shared AnytimeClosingHandoff only when anytimeOrigin, the generic trio only otherwise', () => {
    expect(source).toMatch(/\{anytimeOrigin \? \(/);
    expect(source).toMatch(/<AnytimeClosingHandoff/);
    expect(source).toMatch(/onContinueMyDay=\{handleContinueMyDay\}/);
    expect(source).toMatch(/onChooseAnotherReset=\{handleChooseAnotherQuickReset\}/);
    expect(source).not.toMatch(/onExploreMore/);
  });

  it('"Choose another quick reset" restores the exact need/duration this practice was entered with, via the same allowlisted ?need=&duration= restore AnytimeReset.jsx already uses after sign-in - never a bare navigate that would restart the wizard from step 1', () => {
    expect(source).toMatch(/const handleChooseAnotherQuickReset = \(\) => \{\s*\n\s*exitPracticeToHome\(navigate, anytimeResetDestination\);\s*\n\s*\};/);
  });

  it('"Continue My Day" is a plain exitPracticeToHome to \'/\', clearing the temporary practice context exactly like Done always has', () => {
    expect(source).toMatch(/const handleContinueMyDay = \(\) => \{\s*\n\s*exitPracticeToHome\(navigate, '\/'\);\s*\n\s*\};/);
  });

  it('the generic Done/Meditate Again/Choose Another Meditation trio is unreachable while anytimeOrigin - it sits in the else branch of the same top-level conditional', () => {
    const ifIndex = source.indexOf('{anytimeOrigin ? (');
    const elseIndex = source.indexOf(') : (', ifIndex);
    const doneIndex = source.indexOf('<span>Done</span>');
    expect(ifIndex).toBeGreaterThanOrEqual(0);
    expect(elseIndex).toBeGreaterThan(ifIndex);
    expect(doneIndex).toBeGreaterThan(elseIndex);
  });
});
