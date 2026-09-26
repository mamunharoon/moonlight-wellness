// WakeWise Phase 2 (B6) — EveningComplete.jsx sources its rotating
// headline/body from the shared outcomeMessages.js model instead of one
// fixed string. Source-level regression guard.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./EveningComplete.jsx', import.meta.url)), 'utf-8');

describe('EveningComplete.jsx — rotating completion message wiring', () => {
  it('imports the shared outcome-message model', () => {
    expect(source).toMatch(/import \{ OUTCOME, JOURNEY, getOutcomeMessage \} from '\.\.\/lib\/outcomeMessages';/);
  });

  it('resolves headline/body via getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.EVENING, today) - this screen is only ever reached on a genuine completion (see the unchanged mount-effect guard)', () => {
    expect(source).toMatch(/const \{ headline, body \} = getOutcomeMessage\(OUTCOME\.COMPLETED, JOURNEY\.EVENING, today\);/);
    expect(source).toMatch(/const today = getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey;/);
  });

  it('renders {headline} and {body} directly, not a hardcoded string', () => {
    expect(source).toMatch(/<h1 className="font-serif italic text-3xl text-on-surface">\{headline\}<\/h1>/);
    expect(source).toMatch(/<p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">\s*\n\s*\{body\}\s*\n\s*<\/p>/);
  });

  it('the mount-effect completion-recording guard is completely unchanged - this cosmetic change never touches when the daily flag is written', () => {
    expect(source).toMatch(/if \(state\.status === 'playing' && currentStep\?\.id === 'completion'\) \{\s*\n\s*completeSession\(\);/);
  });
});
