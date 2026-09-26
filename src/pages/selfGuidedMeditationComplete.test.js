// Source-level regression guard for SelfGuidedMeditationComplete.jsx - same
// "no rendering engine" constraint as every comparable existing test in
// this repo (see selfGuidedMeditationSetup.test.js's own header comment).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./SelfGuidedMeditationComplete.jsx', import.meta.url)), 'utf-8');

describe('SelfGuidedMeditationComplete.jsx — approved heading and copy, exact text', () => {
  it('heading and supporting copy match exactly', () => {
    expect(source).toMatch(/Meditation complete/);
    expect(source).toMatch(/Take this steadiness with you\./);
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

  it('backDestination resolves to the preserved Anytime Reset recommendation via the explicit anytimeOrigin marker (never journeyTone/browser history), falling back to context.fallback (Home) only when not genuinely reached from Anytime Reset', () => {
    expect(source).toMatch(/const anytimeOrigin = Boolean\(session\?\.anytimeNeed && session\?\.anytimeDuration\);/);
    expect(source).toMatch(/const backDestination = anytimeOrigin \? anytimeResetDestination : context\.fallback;/);
  });
});

describe('SelfGuidedMeditationComplete.jsx — touch targets', () => {
  it('all three action buttons carry the 44px minimum', () => {
    const minHeightMatches = source.match(/min-h-\[44px\]/g) ?? [];
    expect(minHeightMatches.length).toBeGreaterThanOrEqual(3);
  });
});

// WakeWise DEV — Anytime completion correction: a Meditate practice
// reached through Anytime Reset's own "Or choose another quick reset"
// gets the same two Anytime-specific actions QuietBreathing.jsx's own
// completion screen already shows (journeyTone === 'anytime'), instead of
// the generic Done/Meditate Again/Choose Another Meditation trio above -
// reached any other way (Home/Library's Meditate tiles), journeyTone
// isn't 'anytime' and the trio above is completely unchanged.
describe('SelfGuidedMeditationComplete.jsx — Anytime-only completion gating', () => {
  it('renders "Choose another quick reset" / "Return to Home" only when journeyTone === \'anytime\', the generic trio only otherwise', () => {
    expect(source).toMatch(/\{journeyTone === 'anytime' \? \(/);
    expect(source).toMatch(/<span>Choose another quick reset<\/span>/);
    expect(source).toMatch(/>\s*Return to Home\s*</);
  });

  it('"Choose another quick reset" restores the exact need/duration this practice was entered with, via the same allowlisted ?need=&duration= restore AnytimeReset.jsx already uses after sign-in - never a bare navigate that would restart the wizard from step 1', () => {
    expect(source).toMatch(
      /const anytimeResetDestination = anytimeOrigin\s*\n\s*\? `\/anytime-reset\?need=\$\{encodeURIComponent\(session\.anytimeNeed\)\}&duration=\$\{encodeURIComponent\(session\.anytimeDuration\)\}`\s*\n\s*: '\/anytime-reset';/
    );
    expect(source).toMatch(/const handleChooseAnotherQuickReset = \(\) => \{\s*\n\s*exitPracticeToHome\(navigate, anytimeResetDestination\);\s*\n\s*\};/);
  });

  it('"Return to Home" is a plain exitPracticeToHome to \'/\', clearing the temporary practice context exactly like Done always has', () => {
    expect(source).toMatch(/const handleReturnToHome = \(\) => \{\s*\n\s*exitPracticeToHome\(navigate, '\/'\);\s*\n\s*\};/);
  });

  it('the generic Done/Meditate Again/Choose Another Meditation trio is unreachable while journeyTone === \'anytime\' - it sits in the else branch of the same conditional', () => {
    const buttonsBlock = source.slice(source.indexOf('<div className="space-y-3">'), source.indexOf('</div>\n    </div>\n  );'));
    const ifIndex = buttonsBlock.indexOf("journeyTone === 'anytime' ? (");
    const elseIndex = buttonsBlock.indexOf(') : (');
    const doneIndex = buttonsBlock.indexOf('<span>Done</span>');
    expect(ifIndex).toBeGreaterThanOrEqual(0);
    expect(elseIndex).toBeGreaterThan(ifIndex);
    expect(doneIndex).toBeGreaterThan(elseIndex);
  });
});
