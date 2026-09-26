// WakeWise Phase 2 (B6) — SessionComplete.jsx sources its rotating
// headline/body from the shared outcomeMessages.js model instead of one
// fixed string. Source-level regression guard (no DOM rendering is
// available in this repo's Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./SessionComplete.jsx', import.meta.url)), 'utf-8');

describe('SessionComplete.jsx — rotating completion message wiring', () => {
  it('imports the shared outcome-message model', () => {
    expect(source).toMatch(/import \{ OUTCOME, JOURNEY, getOutcomeMessage \} from '\.\.\/lib\/outcomeMessages';/);
  });

  it('resolves headline/body via getOutcomeMessage(OUTCOME.COMPLETED, JOURNEY.MORNING, today) - this screen is only ever reached on a genuine completion (see the unchanged mount-effect guard)', () => {
    expect(source).toMatch(/const \{ headline, body \} = getOutcomeMessage\(OUTCOME\.COMPLETED, JOURNEY\.MORNING, today\);/);
  });

  it('today is the caller\'s own local dateKey (getZonedParts(effectiveTimezone, devNow())), the same technique every other daily-completion flag in this file already uses - never UTC, never a fixed offset', () => {
    expect(source).toMatch(/const today = getZonedParts\(effectiveTimezone, devNow\(\)\)\.dateKey;/);
  });

  it('renders {headline} and {body} directly, not a hardcoded string', () => {
    expect(source).toMatch(/<h2 className="text-2xl font-morning-display italic font-semibold text-on-surface leading-tight">\{headline\}<\/h2>/);
    expect(source).toMatch(/<p className="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">\s*\n\s*\{body\}\s*\n\s*<\/p>/);
  });
});
