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
    expect(source).toMatch(/const handleDone = \(\) => navigate\(context\.fallback\);/);
  });
});

describe('SelfGuidedMeditationComplete.jsx — Meditate Again / Choose Another Meditation preserve style+duration and require a new Begin', () => {
  it('both navigate back to setup with the finished session\'s styleId/durationId/musicOn in router state', () => {
    const meditateAgainBody = source.match(/const handleMeditateAgain = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const chooseAnotherBody = source.match(/const handleChooseAnotherMeditation = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    for (const body of [meditateAgainBody, chooseAnotherBody]) {
      expect(body).toMatch(/navigate\(`\/self-guided-meditation/);
      expect(body).toMatch(/styleId: style\.id, durationId: duration\.id, musicOn: session\?\.musicOn/);
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
  it('uses the shared BackButton with the resolved context\'s fallback/label', () => {
    expect(source).toMatch(/import \{ BackButton \} from '\.\.\/components\/BackButton';/);
    expect(source).toMatch(/<BackButton fallback=\{context\.fallback\} label=\{context\.label\} guardActiveRoute=\{false\} \/>/);
  });
});

describe('SelfGuidedMeditationComplete.jsx — touch targets', () => {
  it('all three action buttons carry the 44px minimum', () => {
    const minHeightMatches = source.match(/min-h-\[44px\]/g) ?? [];
    expect(minHeightMatches.length).toBeGreaterThanOrEqual(3);
  });
});
