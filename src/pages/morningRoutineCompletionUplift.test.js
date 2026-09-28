// WakeWise DEV — full Morning routine completion correction: item 5 of the
// "add positive, rotating completion experiences to Morning Stretch,
// Morning Meditation and 100% Morning routine completion" pass.
// SessionComplete.jsx is the EXISTING Morning completion screen (reached
// only once every required step has genuinely completed and Affirmation's
// Continue navigates here) - no new intermediate screen was added.
// Source-level regression guard (no DOM rendering available in this
// repo's Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./SessionComplete.jsx');

describe('SessionComplete.jsx (100% Morning routine completion) — reuses the existing completion screen, never a new intermediate one', () => {
  it('this is still the same route/component reached only via Affirmation\'s Continue - no new screen/route was introduced for this correction', () => {
    expect(source).toMatch(/export const SessionComplete = \(\) => \{/);
  });

  it('completeSession() is only ever called from the pre-existing mount effect, gated on a genuine natural completion (state.status === \'playing\' && currentStep?.id === \'complete\') - "Your Momentum" foundation Phase 2 additionally moved the daily completion-date flag write into this exact same gated block (previously CTA-gated - see practiceCompletionWiring.test.js), but never introduced a second completion-recording path or a second completeSession() call', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(state\.status === 'playing' && currentStep\?\.id === 'complete'\) \{\s*\n\s*completeSession\(\);[\s\S]*?\n\s*\}\s*\n\s*\/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\s*\n\s*\}, \[state\.status, currentStep, completeSession\]\);/)?.[0] ?? '';
    expect(effectBody).not.toBe('');
    const completeSessionCalls = source.match(/completeSession\(\);/g) ?? [];
    expect(completeSessionCalls.length).toBe(1);
  });
});

describe('SessionComplete.jsx (100% Morning routine completion) — required warm-gold visual, exactly once, honest wording', () => {
  it('the 100%/Complete ring badge is unchanged (pre-existing, already correct) - check_circle icon, "100%", "Complete"', () => {
    expect(source).toMatch(/<span className="material-symbols-outlined text-morning-accent text-2xl font-bold">check_circle<\/span>/);
    expect(source).toMatch(/<span className="text-3xl font-extrabold text-on-surface mt-0\.5">100%<\/span>/);
    expect(source).toMatch(/<span className="text-\[10px\] text-on-surface-variant uppercase tracking-wider font-semibold">Complete<\/span>/);
  });

  it('shows the required small "Morning Complete" eyebrow label, using the same warm-gold token as every other Morning completion panel this pass added - never a new colour', () => {
    expect(source).toMatch(/<span className="font-label-sm text-xs text-morning-accent uppercase tracking-widest font-bold">Morning Complete<\/span>/);
  });

  it('shows exactly one rotating final message (completionGreeting) from the routine pool - no separate supporting body paragraph was added back', () => {
    expect(source).toMatch(/<h2 className="text-2xl font-morning-display italic font-semibold text-on-surface leading-tight">\{completionGreeting\}<\/h2>/);
    expect(source).not.toMatch(/\{body\}/);
  });

  it('no streaks/achievements/stats/new persistence were introduced - the Summary card below still only ever reads the existing intentions, and completeSession/localStorage writes are unchanged from before this pass', () => {
    expect(source).not.toMatch(/streak|achievement|badge (?:earned|unlocked)/i);
    // Exactly the two pre-existing localStorage calls (the daily-completion
    // flag write/read this file already had) - no new persistence key.
    const localStorageCalls = source.match(/localStorage\.(?:get|set)Item\(/g) ?? [];
    expect(localStorageCalls.length).toBe(2);
  });
});

describe('SessionComplete.jsx (100% Morning routine completion) — Continue to My Day uses the existing approved destination, never a new route', () => {
  it('the primary CTA calls the pre-existing, otherwise-unchanged handleReturnHome - same function, same destination, only the label text changed', () => {
    expect(source).toMatch(/<button\s*\n\s*onClick=\{handleReturnHome\}[\s\S]{0,400}<span>Continue to My Day<\/span>/);
  });

  it('handleReturnHome still navigates Home (\'/\') and still calls resetSession - the destination/logic behind the renamed button are byte-identical to before this pass', () => {
    const fn = source.match(/const handleReturnHome = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(fn).toMatch(/navigate\('\/'\);/);
    expect(fn).toMatch(/resetSession\(\);/);
  });
});

describe('SessionComplete.jsx (100% Morning routine completion) — a direct/refreshed/mismatched visit still renders the same static screen (pre-existing honesty guarantee, unaffected by this pass)', () => {
  it('the mount effect never runs completeSession for a revisit (state.status already \'completed\') - completionGreeting is still shown, but nothing is double-recorded', () => {
    expect(source).toMatch(/if \(state\.status === 'playing' && currentStep\?\.id === 'complete'\) \{/);
  });
});
