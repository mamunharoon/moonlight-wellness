// WakeWise DEV — full Morning routine completion correction:
// SessionComplete.jsx now sources its rotating completion message from the
// same shared getCompletionGreeting({journey, practice}) architecture as
// Morning Breathing/Stretch/Meditation (outcomeMessages.js), instead of
// its own separate headline/body pair keyed to the calendar day
// (getOutcomeMessage). Source-level regression guard (no DOM rendering is
// available in this repo's Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./SessionComplete.jsx', import.meta.url)), 'utf-8');

describe('SessionComplete.jsx — rotating completion message wiring', () => {
  it('imports the shared getCompletionGreeting API - never the old per-day getOutcomeMessage model', () => {
    expect(source).toMatch(/import \{ getCompletionGreeting \} from '\.\.\/lib\/outcomeMessages';/);
    expect(source).not.toMatch(/getOutcomeMessage|OUTCOME\.COMPLETED|JOURNEY\.MORNING/);
  });

  it('resolves the completion greeting via getCompletionGreeting({journey: \'morning\', practice: \'routine\'}) - a dedicated, non-repeating pool of its own, never borrowed from Breathing/Stretch/Meditation', () => {
    expect(source).toMatch(/const \[completionGreeting\] = useState\(\(\) => getCompletionGreeting\(\{ journey: 'morning', practice: 'routine' \}\)\);/);
  });

  it('the greeting is picked exactly once (lazy useState initializer), held stable, never re-picked on re-render', () => {
    const setterCalls = source.match(/getCompletionGreeting\(/g) ?? [];
    expect(setterCalls.length).toBe(1);
  });

  it('renders {completionGreeting} directly as the headline - not a hardcoded string, and no separate {body} paragraph any more', () => {
    expect(source).toMatch(/<h2 className="text-2xl font-morning-display italic font-semibold text-on-surface leading-tight">\{completionGreeting\}<\/h2>/);
    expect(source).not.toMatch(/\{body\}/);
  });

  it('shows the required "Morning Complete" eyebrow label, reusing the same warm-gold token as Breathe.jsx/MorningFlow.jsx/MorningMeditate.jsx\'s own completion panels - never a new colour', () => {
    expect(source).toMatch(/<span className="font-label-sm text-xs text-morning-accent uppercase tracking-widest font-bold">Morning Complete<\/span>/);
  });
});
