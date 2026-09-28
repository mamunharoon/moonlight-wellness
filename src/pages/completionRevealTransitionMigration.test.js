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

describe('MorningFlow.jsx — isCompleted panel uses the shared CompletionReveal transition', () => {
  const source = read('./MorningFlow.jsx');

  it('imports CompletionReveal', () => {
    expect(source).toMatch(/import \{ CompletionReveal \} from '\.\.\/components\/CompletionReveal';/);
  });

  it('the completed branch renders <CompletionReveal active={isCompleted} journeyTone="morning" ...> - auto-freshness detection applies (no explicit isFresh), matching this file\'s own "flips isCompleted - zero renders/effects in between" invariant', () => {
    expect(source).toMatch(/\) : isCompleted \? \(\s*\n(\s*\/\/[^\n]*\n)*\s*<CompletionReveal\s*\n\s*active=\{isCompleted\}\s*\n\s*journeyTone="morning"/);
    expect(source).not.toMatch(/<CompletionReveal[\s\S]{0,80}isFresh/);
  });

  it('never shows a factual insight/milestone here (Morning Stretch alone is not one of the three Phase 2 tracked activities) - no MomentumPanel import', () => {
    expect(source).not.toMatch(/MomentumPanel/);
  });
});

describe('Breathe.jsx — isCompleted panel uses the shared CompletionReveal transition', () => {
  const source = read('./Breathe.jsx');

  it('imports CompletionReveal', () => {
    expect(source).toMatch(/import \{ CompletionReveal \} from '\.\.\/components\/CompletionReveal';/);
  });

  it('the completed branch renders <CompletionReveal active={isCompleted} journeyTone="morning" ...> - auto-freshness detection applies', () => {
    expect(source).toMatch(/\) : isCompleted \? \(\s*\n(\s*\/\/[^\n]*\n)*\s*<CompletionReveal\s*\n\s*active=\{isCompleted\}\s*\n\s*journeyTone="morning"/);
    expect(source).not.toMatch(/<CompletionReveal[\s\S]{0,80}isFresh/);
  });

  it('never shows a factual insight/milestone here (Morning Breathing alone is not one of the three Phase 2 tracked activities) - no MomentumPanel import', () => {
    expect(source).not.toMatch(/MomentumPanel/);
  });
});

describe('EveningBreathing.jsx — isCompleted panel uses the shared CompletionReveal transition', () => {
  const source = read('./EveningBreathing.jsx');

  it('imports CompletionReveal (and now carries the repo-wide no-unused-vars disable directive every JSX-usage file needs, since this eslint config has no react plugin providing JSX-scope usage tracking)', () => {
    expect(source).toMatch(/^\/\* eslint-disable no-unused-vars \*\//);
    expect(source).toMatch(/import \{ CompletionReveal \} from '\.\.\/components\/CompletionReveal';/);
  });

  it('the completed branch renders <CompletionReveal active={isCompleted} journeyTone="evening" ...> - auto-freshness detection applies', () => {
    expect(source).toMatch(/\) : isCompleted \? \(\s*\n(\s*\/\/[^\n]*\n)*\s*<CompletionReveal\s*\n\s*active=\{isCompleted\}\s*\n\s*journeyTone="evening"/);
    expect(source).not.toMatch(/<CompletionReveal[\s\S]{0,80}isFresh/);
  });

  it('never shows a factual insight/milestone here (Evening Breathing alone is not one of the three Phase 2 tracked activities) - no MomentumPanel import', () => {
    expect(source).not.toMatch(/MomentumPanel/);
  });
});

describe('QuietBreathing.jsx (standalone) — the combined isCompleted/earlyEnded block shares one CompletionReveal, celebratory gated on isCompleted alone', () => {
  const source = read('./QuietBreathing.jsx');
  const standaloneBlockStart = source.indexOf('if (standalone) {');
  const standaloneBlock = standaloneBlockStart === -1 ? '' : source.slice(standaloneBlockStart, source.indexOf('countdown.isActive ? (', standaloneBlockStart));

  it('imports CompletionReveal (and carries the repo-wide no-unused-vars disable directive)', () => {
    expect(source).toMatch(/^\/\* eslint-disable no-unused-vars \*\//);
    expect(source).toMatch(/import \{ CompletionReveal \} from '\.\.\/components\/CompletionReveal';/);
  });

  it('the standalone isCompleted||earlyEnded branch renders exactly one CompletionReveal, active on either flag, celebratory ONLY on isCompleted - a genuine early exit gets a plain cross-fade, never the completed-check scale/glow treatment', () => {
    expect(standaloneBlock).not.toBe('');
    expect(standaloneBlock).toMatch(/<CompletionReveal\s*\n\s*active=\{isCompleted \|\| earlyEnded\}\s*\n\s*journeyTone=\{journeyTone\}\s*\n\s*celebratory=\{isCompleted\}/);
  });

  it('never passes an explicit isFresh here - this is a ternary-swap-style flag flip (isCompleted/earlyEnded both start false), so auto-detection applies exactly like every other embedded ternary-swap screen', () => {
    expect(standaloneBlock).not.toMatch(/isFresh/);
  });

  it('the mint completed badge (Anytime tone only) is still gated on isCompleted && journeyTone === \'anytime\' - never shown for a genuine early exit', () => {
    expect(standaloneBlock).toMatch(/isCompleted && journeyTone === 'anytime' \? \(\s*\n\s*<div key="badge"/);
  });

  it('the non-standalone (Support.jsx embedded) branch is completely untouched - no CompletionReveal reference anywhere outside the standalone block', () => {
    const outsideStandalone = standaloneBlockStart === -1 ? source : source.slice(0, standaloneBlockStart) + source.slice(source.indexOf('countdown.isActive ? (', standaloneBlockStart));
    expect(outsideStandalone).not.toMatch(/<CompletionReveal/);
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
