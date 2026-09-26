// Context-aware Meditation/Breathing theming — usePracticeJourneyTone.js.
// Source-level regression guard, matching this repo's established
// convention for React hooks (no DOM rendering available - see
// usePreparationCountdown.test.js's own identical note). The real
// capture/precedence/clear logic this hook drives is covered with real
// execution in practiceJourneyContext.test.js/dayPartJourneyTone.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./usePracticeJourneyTone.js', import.meta.url)), 'utf-8');

describe('usePracticeJourneyTone — captures exactly once, via a lazy useState initializer', () => {
  it('uses useState\'s lazy-initializer form, never a useEffect (which would recalculate after mount, or on every dependency change)', () => {
    expect(source).toMatch(/const \[journeyTone\] = useState\(\(\) => \{/);
    expect(source).not.toMatch(/useEffect/);
  });

  it('resolves via the shared precedence resolver, feeding it router state and a daypart fallback derived from this app\'s own timezone/devClock', () => {
    expect(source).toMatch(/import \{ resolvePracticeJourneyTone, capturePracticeJourneyTone \} from '\.\.\/lib\/practiceJourneyContext';/);
    expect(source).toMatch(/import \{ currentDaypartJourneyTone \} from '\.\.\/lib\/dayPartJourneyTone';/);
    expect(source).toMatch(/explicitTone: explicitTone \?\? location\.state\?\.journeyTone,/);
    expect(source).toMatch(/daypartFallback: currentDaypartJourneyTone\(effectiveTimezone\)/);
  });

  it('writes the resolved value straight back via capturePracticeJourneyTone, so a later screen on a different route reads the same value rather than re-resolving', () => {
    const body = source.match(/const \[journeyTone\] = useState\(\(\) => \{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(body).toMatch(/capturePracticeJourneyTone\(resolved\);/);
    expect(body).toMatch(/return resolved;/);
  });
});

describe('usePracticeJourneyTone — enabled flag lets a component with both a standalone and non-standalone branch call this unconditionally (Rules of Hooks) while genuinely skipping capture for the branch that must never touch this key', () => {
  it('enabled defaults to true; disabled skips resolution/capture and returns null', () => {
    expect(source).toMatch(/export const usePracticeJourneyTone = \(explicitTone, enabled = true\) => \{/);
    const body = source.match(/const \[journeyTone\] = useState\(\(\) => \{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(body).toMatch(/if \(!enabled\) return null;/);
  });
});
