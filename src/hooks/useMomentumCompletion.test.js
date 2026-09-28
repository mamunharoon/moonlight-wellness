// "Your Momentum" foundation, Phase 3 — source-level regression guard for
// useMomentumCompletion.js, matching this repo's established convention
// for React hooks (no DOM rendering available - see
// usePracticeJourneyTone.test.js's own identical note). The real
// query/calculation/acknowledgement logic this hook orchestrates is
// covered with full real-execution tests in momentumQueries.test.js and
// momentumInsights.test.js - this file proves the hook's own wiring calls
// through to them correctly, in the right order, under the right gates.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./useMomentumCompletion.js', import.meta.url)), 'utf-8');

describe('useMomentumCompletion — race-free gating', () => {
  it('does nothing at all until both ready and sessionId are present', () => {
    expect(source).toMatch(/if \(!ready \|\| !sessionId\) return;/);
  });

  it('guests never reach the network - isGuest/no-userId is checked and short-circuits before any fetch call', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[ready, userId, isGuest, sessionId, journey, practiceType\]\);/)?.[0] ?? '';
    expect(effectBody).not.toBe('');
    const guestCheckIdx = effectBody.indexOf('isGuest || !userId');
    const fetchIdx = effectBody.indexOf('fetchCompletionRows(');
    expect(guestCheckIdx).toBeGreaterThan(-1);
    expect(fetchIdx).toBeGreaterThan(guestCheckIdx);
  });

  it('a stale response (superseded by a newer request) is discarded via a request-id ref before touching state', () => {
    expect(source).toMatch(/const requestId = requestIdRef\.current \+ 1;/);
    expect(source).toMatch(/requestIdRef\.current = requestId;/);
    expect(source).toMatch(/if \(requestIdRef\.current !== requestId\) return;/);
  });
});

describe('useMomentumCompletion — honest failure handling', () => {
  it('a query failure sets status "error" with null insight/milestone, and logs via console.warn - never throws, never fabricates data', () => {
    expect(source).toMatch(/if \(!result\.ok\) \{/);
    expect(source).toMatch(/console\.warn\('Momentum insight unavailable:', result\.error\?\.message \?\? result\.reason\);/);
    expect(source).toMatch(/setState\(\{ status: 'error', insight: null, milestone: null \}\);/);
  });
});

describe('useMomentumCompletion — milestone acknowledgement happens exactly once, at genuine display time', () => {
  it('acknowledgeMilestone is called only after a milestone is genuinely computed for this exact request, immediately before the success state is set', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[ready, userId, isGuest, sessionId, journey, practiceType\]\);/)?.[0] ?? '';
    expect(effectBody).toMatch(/if \(milestone\) acknowledgeMilestone\(userId, milestone\.id\);/);
    const ackIdx = effectBody.indexOf('acknowledgeMilestone(userId, milestone.id)');
    const successIdx = effectBody.indexOf("status: 'success'");
    expect(ackIdx).toBeGreaterThan(-1);
    expect(successIdx).toBeGreaterThan(ackIdx);
  });
});

describe('useMomentumCompletion — never blocks navigation, never mutates completion events', () => {
  it('imports only fetchCompletionRows (a read) and computeMomentumForCompletion/acknowledgeMilestone - no write-path import anywhere', () => {
    expect(source).toMatch(/import \{ fetchCompletionRows \} from '\.\.\/lib\/momentumQueries';/);
    expect(source).toMatch(/import \{ computeMomentumForCompletion, acknowledgeMilestone \} from '\.\.\/lib\/momentumInsights';/);
    const importLines = source.split('\n').filter((line) => line.trim().startsWith('import '));
    expect(importLines.join('\n')).not.toMatch(/recordPracticeCompletion|practiceCompletions/);
  });
});
