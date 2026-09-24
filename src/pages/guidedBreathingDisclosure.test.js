// Build 15 release-quality pass — "Explore guided breathing sessions"
// disclosure on Morning Breathe and standalone Breathe. No DOM rendering
// available in this repo's Vitest - source-level checks, matching this
// codebase's own established precedent.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const breatheSource = read('./Breathe.jsx');
const quietBreathingSource = read('./QuietBreathing.jsx');
const eveningBreathingSource = read('./EveningBreathing.jsx');

describe('Breathe.jsx (Morning) - guided-breathing disclosure', () => {
  it('imports the shared catalogue, never a local duplicate array', () => {
    expect(breatheSource).toMatch(/import \{ BREATHE_VIDEOS, BREATHING_SESSION_VIDEOS, GUIDED_BREATHING_VIDEO_COUNT \} from '\.\.\/lib\/guidedBreathingVideos';/);
    expect(breatheSource).not.toMatch(/const BREATHE_VIDEOS = \[/);
    expect(breatheSource).not.toMatch(/const BREATHING_SESSION_VIDEOS = \[/);
  });

  it('collapses by default (useState(false))', () => {
    expect(breatheSource).toMatch(/const \[guidedSessionsOpen, setGuidedSessionsOpen\] = useState\(false\);/);
  });

  it('the header shows the real calculated count (7), never a hand-typed number', () => {
    const matches = breatheSource.match(/Explore guided breathing sessions — \{GUIDED_BREATHING_VIDEO_COUNT\} available/g) ?? [];
    // Once in the pre-start branch, once in the active-state block.
    expect(matches.length).toBe(2);
  });

  it('both video collections are genuinely conditionally rendered (unmounted when collapsed), never merely hidden', () => {
    expect(breatheSource).toMatch(/\{guidedSessionsOpen && \(\s*\n\s*<div id="breathe-guided-sessions"/);
    expect(breatheSource).toMatch(/\{guidedSessionsOpen && \(\s*\n\s*<div id="breathe-guided-sessions-active"/);
  });

  it('correct aria-expanded/aria-controls, real toggle buttons, never a link/navigation', () => {
    expect(breatheSource).toMatch(/onClick=\{\(\) => setGuidedSessionsOpen\(\(v\) => !v\)\}\s*\n\s*aria-expanded=\{guidedSessionsOpen\}\s*\n\s*aria-controls="breathe-guided-sessions"/);
    expect(breatheSource).toMatch(/onClick=\{\(\) => setGuidedSessionsOpen\(\(v\) => !v\)\}\s*\n\s*aria-expanded=\{guidedSessionsOpen\}\s*\n\s*aria-controls="breathe-guided-sessions-active"/);
  });

  it('handleBeginBreathing never touches guidedSessionsOpen - Begin never forces it open (or closed)', () => {
    const body = breatheSource.match(/const handleBeginBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/setGuidedSessionsOpen/);
  });

  it('the disclosure sits after Skip this step/Exit routine in the pre-start branch', () => {
    const preStartBranch = breatheSource.slice(breatheSource.indexOf(': !hasBegun ? ('), breatheSource.indexOf(') : (\n        <>\n          <div className="text-center space-y-2">\n            <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Grounding Exercise'));
    const iSkip = preStartBranch.indexOf('Skip this step');
    const iExit = preStartBranch.indexOf('Exit routine');
    const iDisclosure = preStartBranch.indexOf('Explore guided breathing sessions');
    expect(iSkip).toBeGreaterThanOrEqual(0);
    expect(iExit).toBeGreaterThan(iSkip);
    expect(iDisclosure).toBeGreaterThan(iExit);
  });

  it('selecting a video from either collection uses the existing handleSelectVideo wrapper (interrupt-to-watch), never the raw handleSelect', () => {
    const rowOnClicks = breatheSource.match(/onClick=\{\(\) => handle\w+\(id\)\}/g) ?? [];
    expect(rowOnClicks.length).toBeGreaterThan(0);
    for (const onClick of rowOnClicks) {
      expect(onClick).toMatch(/handleSelectVideo/);
    }
  });

  it('handleSelectVideo never advances or completes the routine - it only marks videoOpenedDuringExercise and opens the protected-video flow', () => {
    const body = breatheSource.match(/const handleSelectVideo = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setVideoOpenedDuringExercise\(true\);/);
    expect(body).toMatch(/handleSelect\(id\);/);
    expect(body).not.toMatch(/advanceStep|navigate\(|setJourneyStep/);
  });

  it('closing the video returns to this same Breathe screen - the existing closeVideo handler, no route change', () => {
    expect(breatheSource).toMatch(/<BetaVideoModal entry=\{openVideo\} onClose=\{closeVideo\} \/>/);
  });
});

describe('QuietBreathing.jsx - standalone-only guided-breathing disclosure', () => {
  const standaloneReturn = quietBreathingSource.slice(quietBreathingSource.indexOf('if (standalone) {'), quietBreathingSource.lastIndexOf('return (\n    <EveningSceneShell'));
  const nonStandaloneReturn = quietBreathingSource.slice(quietBreathingSource.lastIndexOf('return (\n    <EveningSceneShell'));

  it('imports the same shared catalogue as Breathe.jsx - one source of truth, never a duplicated array', () => {
    expect(quietBreathingSource).toMatch(/import \{ BREATHE_VIDEOS, BREATHING_SESSION_VIDEOS, GUIDED_BREATHING_VIDEO_COUNT \} from '\.\.\/lib\/guidedBreathingVideos';/);
  });

  it('the disclosure and every guided-video reference live only inside the standalone branch, never in the non-standalone (Support) return', () => {
    expect(standaloneReturn).toMatch(/Explore guided breathing sessions/);
    expect(nonStandaloneReturn).not.toMatch(/Explore guided breathing sessions/);
    expect(nonStandaloneReturn).not.toMatch(/BetaVideoRow|BetaVideoModal|guidedSessionsOpen/);
  });

  it('collapses by default, real toggle buttons with correct aria-expanded/aria-controls', () => {
    expect(quietBreathingSource).toMatch(/const \[guidedSessionsOpen, setGuidedSessionsOpen\] = useState\(false\);/);
    expect(standaloneReturn).toMatch(/onClick=\{\(\) => setGuidedSessionsOpen\(\(v\) => !v\)\}\s*\n\s*aria-expanded=\{guidedSessionsOpen\}\s*\n\s*aria-controls="standalone-breathe-guided-sessions"/);
    expect(standaloneReturn).toMatch(/onClick=\{\(\) => setGuidedSessionsOpen\(\(v\) => !v\)\}\s*\n\s*aria-expanded=\{guidedSessionsOpen\}\s*\n\s*aria-controls="standalone-breathe-guided-sessions-active"/);
  });

  it('the header shows the real calculated count (7), once pre-start and once active', () => {
    const matches = standaloneReturn.match(/Explore guided breathing sessions — \{GUIDED_BREATHING_VIDEO_COUNT\} available/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it('handleBeginBreathing never touches guidedSessionsOpen', () => {
    const body = quietBreathingSource.match(/const handleBeginBreathing = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/setGuidedSessionsOpen/);
  });

  it('opening a video never advances/completes the routine - handleSelectVideo is useProtectedVideo\'s own handleSelect, not a custom advancing wrapper', () => {
    expect(quietBreathingSource).toMatch(/handleSelect: handleSelectVideo,/);
    expect(quietBreathingSource).not.toMatch(/const handleSelectVideo = \(id\) => \{[\s\S]*?navigate\(/);
  });

  it('closing the video returns to this same screen via the existing closeVideo handler, no route change', () => {
    expect(standaloneReturn).toMatch(/<BetaVideoModal entry=\{openVideo\} onClose=\{closeVideo\} \/>/);
  });

  it('a guest tap opens the shared SignInPromptDialog, consistent with every other protected-video row in the app', () => {
    expect(standaloneReturn).toMatch(/<SignInPromptDialog\s*\n\s*open=\{promptOpen\}\s*\n\s*onSignIn=\{confirmSignInForVideo\}\s*\n\s*onCreateAccount=\{confirmCreateAccountForVideo\}\s*\n\s*onDismiss=\{dismissPrompt\}\s*\n\s*\/>/);
  });
});

describe('Regression - Support (non-standalone QuietBreathing) and Evening Breathing remain completely unchanged', () => {
  it('Support\'s own non-standalone return never gains a guided-video disclosure or any of its state', () => {
    const nonStandaloneReturn = quietBreathingSource.slice(quietBreathingSource.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(nonStandaloneReturn).not.toMatch(/guidedSessionsOpen|BetaVideoRow|BetaVideoModal|GUIDED_BREATHING_VIDEO_COUNT/);
  });

  it('EveningBreathing.jsx is untouched - no guided-video disclosure, no import of the new shared catalogue, per this subphase\'s own explicit scope', () => {
    expect(eveningBreathingSource).not.toMatch(/guidedBreathingVideos|GUIDED_BREATHING_VIDEO_COUNT|Explore guided breathing sessions/);
  });
});
