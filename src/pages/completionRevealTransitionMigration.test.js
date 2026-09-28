// "Your Momentum" foundation, Phase 3 — the shared CompletionReveal
// transition (src/components/CompletionReveal.jsx) is applied consistently
// across every reachable natural-completion surface this pass migrates:
// MorningFlow.jsx, Breathe.jsx, EveningBreathing.jsx, QuietBreathing.jsx
// (standalone branch), MorningMeditate.jsx, EveningMeditate.jsx, and
// SelfGuidedMeditationComplete.jsx. SessionComplete.jsx/EveningComplete.jsx/
// BetaVideoModal.jsx have their own dedicated regression files already
// (sessionCompleteRingAnimation.test.js-adjacent coverage,
// betaVideoModalSharedCompletion.test.js) - this file covers the remaining
// seven.
//
// No DOM rendering is available in this repo's Vitest - source-level
// checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('MorningFlow.jsx — showCompletionPanel drives the shared CompletionReveal transition, fed by useCompletionHandoff', () => {
  const source = read('./MorningFlow.jsx');

  it('imports CompletionReveal and useCompletionHandoff', () => {
    expect(source).toMatch(/import \{ CompletionReveal \} from '\.\.\/components\/CompletionReveal';/);
    expect(source).toMatch(/import \{ useCompletionHandoff \} from '\.\.\/hooks\/useCompletionHandoff';/);
  });

  it('useCompletionHandoff is fed the raw, unchanged isCompleted state - every other isCompleted consumer (suspension, toggles, the CTA) keeps its exact original immediate timing', () => {
    expect(source).toMatch(/const \{ activeViewExiting, showCompletionPanel \} = useCompletionHandoff\(isCompleted\);/);
  });

  it('the completed branch renders <CompletionReveal active={showCompletionPanel} journeyTone="morning" ...> - auto-freshness detection applies (no explicit isFresh), since showCompletionPanel itself starts false and flips true exactly once', () => {
    expect(source).toMatch(/\) : showCompletionPanel \? \(\s*\n(\s*\/\/[^\n]*\n)*\s*<CompletionReveal\s*\n\s*active=\{showCompletionPanel\}\s*\n\s*journeyTone="morning"/);
    expect(source).not.toMatch(/<CompletionReveal[\s\S]{0,80}isFresh/);
  });

  it('the outgoing active-exercise branch fades via activeViewExiting rather than being unmounted instantly', () => {
    expect(source).toMatch(/style=\{isCompleted \? \{ pointerEvents: 'none', \.\.\.\(activeViewExiting \? \{ opacity: 0, transition: 'opacity 350ms ease-out' \} : null\) \} : undefined\}/);
  });

  it('never shows a factual insight/milestone here (Morning Stretch alone is not one of the three Phase 2 tracked activities) - no MomentumPanel import', () => {
    expect(source).not.toMatch(/MomentumPanel/);
  });
});

describe('Breathe.jsx — showCompletionPanel drives the shared CompletionReveal transition, fed by useCompletionHandoff', () => {
  const source = read('./Breathe.jsx');

  it('imports CompletionReveal and useCompletionHandoff', () => {
    expect(source).toMatch(/import \{ CompletionReveal \} from '\.\.\/components\/CompletionReveal';/);
    expect(source).toMatch(/import \{ useCompletionHandoff \} from '\.\.\/hooks\/useCompletionHandoff';/);
  });

  it('useCompletionHandoff is fed the raw, unchanged isCompleted state', () => {
    expect(source).toMatch(/const \{ activeViewExiting, showCompletionPanel \} = useCompletionHandoff\(isCompleted\);/);
  });

  it('the completed branch renders <CompletionReveal active={showCompletionPanel} journeyTone="morning" ...> - auto-freshness detection applies', () => {
    expect(source).toMatch(/\) : showCompletionPanel \? \(\s*\n(\s*\/\/[^\n]*\n)*\s*<CompletionReveal\s*\n\s*active=\{showCompletionPanel\}\s*\n\s*journeyTone="morning"/);
    expect(source).not.toMatch(/<CompletionReveal[\s\S]{0,80}isFresh/);
  });

  it('the outgoing active-exercise branch fades via activeViewExiting rather than being unmounted instantly', () => {
    expect(source).toMatch(/style=\{isCompleted \? \{ pointerEvents: 'none', \.\.\.\(activeViewExiting \? \{ opacity: 0, transition: 'opacity 350ms ease-out' \} : null\) \} : undefined\}/);
  });

  it('never shows a factual insight/milestone here (Morning Breathing alone is not one of the three Phase 2 tracked activities) - no MomentumPanel import', () => {
    expect(source).not.toMatch(/MomentumPanel/);
  });
});

describe('EveningBreathing.jsx — showCompletionPanel drives the shared CompletionReveal transition, fed by useCompletionHandoff', () => {
  const source = read('./EveningBreathing.jsx');

  it('imports CompletionReveal and useCompletionHandoff (and carries the repo-wide no-unused-vars disable directive every JSX-usage file needs, since this eslint config has no react plugin providing JSX-scope usage tracking)', () => {
    expect(source).toMatch(/^\/\* eslint-disable no-unused-vars \*\//);
    expect(source).toMatch(/import \{ CompletionReveal \} from '\.\.\/components\/CompletionReveal';/);
    expect(source).toMatch(/import \{ useCompletionHandoff \} from '\.\.\/hooks\/useCompletionHandoff';/);
  });

  it('useCompletionHandoff is fed the raw, unchanged isCompleted state', () => {
    expect(source).toMatch(/const \{ activeViewExiting, showCompletionPanel \} = useCompletionHandoff\(isCompleted\);/);
  });

  it('the completed branch renders <CompletionReveal active={showCompletionPanel} journeyTone="evening" ...> - auto-freshness detection applies', () => {
    expect(source).toMatch(/\) : showCompletionPanel \? \(\s*\n(\s*\/\/[^\n]*\n)*\s*<CompletionReveal\s*\n\s*active=\{showCompletionPanel\}\s*\n\s*journeyTone="evening"/);
    expect(source).not.toMatch(/<CompletionReveal[\s\S]{0,80}isFresh/);
  });

  it('the outgoing active-exercise branch (single top-level child, no space-y class needed) fades via activeViewExiting', () => {
    expect(source).toMatch(/style=\{isCompleted \? \{ pointerEvents: 'none', \.\.\.\(activeViewExiting \? \{ opacity: 0, transition: 'opacity 350ms ease-out' \} : null\) \} : undefined\}/);
  });

  it('never shows a factual insight/milestone here (Evening Breathing alone is not one of the three Phase 2 tracked activities) - no MomentumPanel import', () => {
    expect(source).not.toMatch(/MomentumPanel/);
  });
});

describe('QuietBreathing.jsx (standalone) — the combined isCompleted/earlyEnded block shares one CompletionReveal, celebratory gated on isCompleted alone, fed by useCompletionHandoff', () => {
  const source = read('./QuietBreathing.jsx');
  const standaloneBlockStart = source.indexOf('if (standalone) {');
  const standaloneBlock = standaloneBlockStart === -1 ? '' : source.slice(standaloneBlockStart, source.indexOf('countdown.isActive ? (', standaloneBlockStart));

  it('imports CompletionReveal and useCompletionHandoff (and carries the repo-wide no-unused-vars disable directive)', () => {
    expect(source).toMatch(/^\/\* eslint-disable no-unused-vars \*\//);
    expect(source).toMatch(/import \{ CompletionReveal \} from '\.\.\/components\/CompletionReveal';/);
    expect(source).toMatch(/import \{ useCompletionHandoff \} from '\.\.\/hooks\/useCompletionHandoff';/);
  });

  it('useCompletionHandoff is fed the combined isCompleted || earlyEnded flag - either genuinely ends the active exercise the same way', () => {
    expect(source).toMatch(/const \{ activeViewExiting, showCompletionPanel \} = useCompletionHandoff\(isCompleted \|\| earlyEnded\);/);
  });

  it('the standalone branch renders exactly one CompletionReveal, active on showCompletionPanel, celebratory ONLY on isCompleted - a genuine early exit gets a plain cross-fade, never the completed-check scale/glow treatment', () => {
    expect(standaloneBlock).not.toBe('');
    expect(standaloneBlock).toMatch(/<CompletionReveal\s*\n\s*active=\{showCompletionPanel\}\s*\n\s*journeyTone=\{journeyTone\}\s*\n\s*celebratory=\{isCompleted\}/);
  });

  it('never passes an explicit isFresh here - showCompletionPanel itself starts false and flips true exactly once, so auto-detection applies exactly like every other embedded ternary-swap screen', () => {
    expect(standaloneBlock).not.toMatch(/isFresh/);
  });

  it('the mint completed badge (Anytime tone only) is still gated on isCompleted && journeyTone === \'anytime\' - never shown for a genuine early exit', () => {
    expect(standaloneBlock).toMatch(/isCompleted && journeyTone === 'anytime' \? \(\s*\n\s*<div key="badge"/);
  });

  it('the outgoing active-exercise branch (further down the same ternary chain, outside standaloneBlock\'s own deliberately-narrow slice) fades via activeViewExiting, replicating EveningSceneShell\'s own content-container flex/justify-between class', () => {
    expect(source).toMatch(/className="flex-1 flex flex-col justify-between"\s*\n\s*style=\{\(isCompleted \|\| earlyEnded\) \? \{ pointerEvents: 'none', \.\.\.\(activeViewExiting \? \{ opacity: 0, transition: 'opacity 350ms ease-out' \} : null\) \} : undefined\}/);
    expect(source).toMatch(/pointerEvents: 'none'/);
  });

  it('the non-standalone (Support.jsx embedded) branch is completely untouched - no CompletionReveal reference anywhere outside the standalone block', () => {
    const outsideStandalone = standaloneBlockStart === -1 ? source : source.slice(0, standaloneBlockStart) + source.slice(source.indexOf('countdown.isActive ? (', standaloneBlockStart));
    expect(outsideStandalone).not.toMatch(/<CompletionReveal/);
  });
});

describe('useCompletionHandoff is wired into exactly the six screens with a genuine "active exercise" view to hold+fade - never into the always-rendered completion pages, BetaVideoModal (video DOM stays mounted, no blank-frame issue), or the two early-return meditation screens (documented limitation)', () => {
  it('MorningFlow/Breathe/EveningBreathing/QuietBreathing all import it', () => {
    for (const file of ['./MorningFlow.jsx', './Breathe.jsx', './EveningBreathing.jsx', './QuietBreathing.jsx']) {
      expect(read(file)).toMatch(/import \{ useCompletionHandoff \} from '\.\.\/hooks\/useCompletionHandoff';/);
    }
  });

  it('MorningMeditate.jsx/EveningMeditate.jsx do NOT import it - session.snapshot/session.phase are already reset to \'setup\' by the time onComplete fires (see useMeditationSession.js\'s own doc comment), so holding/fading the real MeditationActiveSession view would require freezing a stale snapshot of a component with live audio/pause state - out of scope for "smallest reusable", a documented limitation', () => {
    for (const file of ['./MorningMeditate.jsx', './EveningMeditate.jsx']) {
      expect(read(file)).not.toMatch(/useCompletionHandoff/);
    }
  });

  it('SessionComplete.jsx/EveningComplete.jsx/SelfGuidedMeditationComplete.jsx do NOT import it - these are always-rendered completion pages reached via real route navigation from a genuinely separate prior screen, not an in-place DOM swap within the same mounted component', () => {
    for (const file of ['./SessionComplete.jsx', './EveningComplete.jsx', './SelfGuidedMeditationComplete.jsx']) {
      expect(read(file)).not.toMatch(/useCompletionHandoff/);
    }
  });
});

describe('No stale active exercise remains interactive behind the completion panel - pointerEvents is disabled from the instant completion is detected, not merely once the fade begins', () => {
  it('MorningFlow.jsx/Breathe.jsx/EveningBreathing.jsx all gate pointerEvents: \'none\' on the raw, unchanged isCompleted (not merely activeViewExiting) - the exercise has already genuinely finished the moment isCompleted flips, so its own Skip/Exit/video-row controls must never remain tappable during the hold, not just during the later exit-fade', () => {
    for (const file of ['./MorningFlow.jsx', './Breathe.jsx', './EveningBreathing.jsx']) {
      const source = read(file);
      expect(source).toMatch(/style=\{isCompleted \? \{ pointerEvents: 'none', \.\.\.\(activeViewExiting \? \{ opacity: 0, transition: 'opacity 350ms ease-out' \} : null\) \} : undefined\}/);
    }
  });

  it('QuietBreathing.jsx (standalone) gates pointerEvents: \'none\' on isCompleted || earlyEnded - either genuinely ends the exercise the same way', () => {
    const source = read('./QuietBreathing.jsx');
    expect(source).toMatch(/style=\{\(isCompleted \|\| earlyEnded\) \? \{ pointerEvents: 'none', \.\.\.\(activeViewExiting \? \{ opacity: 0, transition: 'opacity 350ms ease-out' \} : null\) \} : undefined\}/);
  });
});

describe('MorningMeditate.jsx — early-return isCompleted panel uses CompletionReveal with an EXPLICIT isFresh (auto-detection cannot apply here)', () => {
  const source = read('./MorningMeditate.jsx');

  it('imports CompletionReveal', () => {
    expect(source).toMatch(/import \{ CompletionReveal \} from '\.\.\/components\/CompletionReveal';/);
  });

  it('CompletionReveal is only ever reached via an early `if (isCompleted) { return (...); }` - it would only ever mount with active already true, so isFresh must be passed explicitly rather than relying on auto-detection', () => {
    const body = source.match(/if \(isCompleted\) \{\s*\n\s*return \([\s\S]*?\n {4}\);\s*\n {2}\}/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/<CompletionReveal\s*\n\s*active\s*\n\s*isFresh\s*\n\s*journeyTone="morning"/);
  });

  it('isCompleted\'s own useState initializer is a hardcoded false, never restored from persisted/session state - the precondition that makes a constant isFresh safe', () => {
    expect(source).toMatch(/const \[isCompleted, setIsCompleted\] = useState\(false\);/);
  });
});

describe('EveningMeditate.jsx — early-return isCompleted panel uses CompletionReveal with an EXPLICIT isFresh', () => {
  const source = read('./EveningMeditate.jsx');

  it('imports CompletionReveal', () => {
    expect(source).toMatch(/import \{ CompletionReveal \} from '\.\.\/components\/CompletionReveal';/);
  });

  it('CompletionReveal is only ever reached via an early `if (isCompleted) { return (...); }` - isFresh is passed explicitly', () => {
    const body = source.match(/if \(isCompleted\) \{\s*\n\s*return \([\s\S]*?\n {4}\);\s*\n {2}\}/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/<CompletionReveal\s*\n\s*active\s*\n\s*isFresh\s*\n\s*journeyTone="evening"/);
  });

  it('isCompleted\'s own useState initializer is a hardcoded false, never restored from persisted/session state', () => {
    expect(source).toMatch(/const \[isCompleted, setIsCompleted\] = useState\(false\);/);
  });
});

describe('SelfGuidedMeditationComplete.jsx — always-rendered completion page, isFresh derived from location.state', () => {
  const source = read('./SelfGuidedMeditationComplete.jsx');

  it('imports CompletionReveal', () => {
    expect(source).toMatch(/import \{ CompletionReveal \} from '\.\.\/components\/CompletionReveal';/);
  });

  it('is always-rendered (active is an unconditional literal, never a ternary flag) - isFresh is derived from Boolean(session), the exact same one-shot router-state signal this file\'s own pre-existing `session && (...)` detail-card guard already uses', () => {
    expect(source).toMatch(/<CompletionReveal\s*\n\s*active\s*\n\s*isFresh=\{Boolean\(session\)\}\s*\n\s*journeyTone=\{journeyTone\}/);
  });

  it('session is derived from location.state, matching this screen\'s own doc comment ("Reached only via SelfGuidedMeditation.jsx\'s own natural-completion path (router state, one-shot, not deep-linkable")', () => {
    expect(source).toMatch(/const session = location\.state \|\| null;/);
  });

  it('a direct/stale visit (no router state) still renders without crashing - session-detail card and isFresh both simply fall back to falsy, never throwing on a missing session', () => {
    expect(source).toMatch(/session \? \(\s*\n\s*<div key="session-detail"/);
  });
});

describe('Every migrated screen keeps its pre-existing journey-tone visual tokens unchanged - CompletionReveal only adds the shared timing/opacity/scale/glow behaviour, never new colours', () => {
  it('MorningFlow.jsx/Breathe.jsx/MorningMeditate.jsx completed panels still use only morning-accent tokens', () => {
    for (const file of ['./MorningFlow.jsx', './Breathe.jsx', './MorningMeditate.jsx']) {
      const source = read(file);
      expect(source).toMatch(/morning-accent/);
      expect(source).not.toMatch(/evening-accent|shadow-mint-glow/);
    }
  });

  it('EveningBreathing.jsx/EveningMeditate.jsx completed panels still use only evening-accent tokens', () => {
    for (const file of ['./EveningBreathing.jsx', './EveningMeditate.jsx']) {
      const source = read(file);
      expect(source).toMatch(/evening-accent/);
      expect(source).not.toMatch(/morning-accent|shadow-mint-glow/);
    }
  });
});
