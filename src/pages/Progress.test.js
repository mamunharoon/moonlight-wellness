// WakeWise — Progress.jsx (PRG-05).
//
// TWO evidence tiers in this file, labelled accurately, not conflated:
//   1. REAL EXECUTION — the describe block below marked as such actually
//      calls the real, unmodified runProgressFetch (exported from
//      Progress.jsx) with controllable fake timing (a manually-resolved
//      promise) and a recording setState spy. This is the only way to
//      genuinely prove the account-switch/sign-out/stale-response
//      ordering claims — a source-text match could not catch a reordering
//      bug here.
//   2. SOURCE-ONLY — every other describe block below. This repo's Vitest
//      runs in a plain Node environment with no DOM/component-renderer
//      available (no React Testing Library/jsdom dependency exists), so
//      the actual rendered JSX (guest/loading/error/empty markup, the new
//      Profile row, the new route) cannot be executed or clicked through
//      here — these assertions verify the source text instead, same
//      convention as Subscription.test.js's own established pattern.
//      They are NOT a substitute for a physical-device check.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runProgressFetch } from './Progress.jsx';

const source = readFileSync(fileURLToPath(new URL('./Progress.jsx', import.meta.url)), 'utf-8');
const appSource = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf-8');
const profileSource = readFileSync(fileURLToPath(new URL('./Profile.jsx', import.meta.url)), 'utf-8');

// A controllable fake: fetchTotals() returns a promise this test can
// resolve on demand, so the exact ordering of "state cleared" vs "fetch
// resolved" can be observed directly, not assumed from reading the code.
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

describe('Progress.jsx — runProgressFetch: REAL EXECUTION (not source-matched)', () => {
  it('clears state to loading/null SYNCHRONOUSLY - before the fetch resolves, not after - so a previous account\'s totals are never still on screen while the next request is in flight', async () => {
    const setState = vi.fn();
    const requestIdRef = { current: 0 };
    const { promise, resolve } = deferred();

    const runPromise = runProgressFetch({ isGuest: false, userId: 'account-a', requestIdRef, setState, fetchTotals: () => promise });

    // Before the fetch has resolved at all, state must already be cleared.
    expect(setState).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith({ status: 'loading', totals: null });

    resolve({ ok: true, totals: { totalPractices: 3 } });
    await runPromise;

    expect(setState).toHaveBeenCalledTimes(2);
    expect(setState).toHaveBeenLastCalledWith({ status: 'success', totals: { totalPractices: 3 } });
  });

  it('sign-out (isGuest becomes true) clears to the guest state IMMEDIATELY, with no fetch at all - never waits for anything to resolve first', async () => {
    const setState = vi.fn();
    const requestIdRef = { current: 2 };

    await runProgressFetch({ isGuest: true, userId: null, requestIdRef, setState });

    expect(setState).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith({ status: 'guest', totals: null });
  });

  it('switching to a DIFFERENT account while the previous account\'s fetch is still in flight: the stale response is discarded, and the LAST state applied is the new account\'s own result - the old account\'s totals are never the final state', async () => {
    const setState = vi.fn();
    const requestIdRef = { current: 0 };
    const accountA = deferred();
    const accountB = deferred();

    // Account A's fetch starts, but never resolves yet.
    const promiseA = runProgressFetch({ isGuest: false, userId: 'account-a', requestIdRef, setState, fetchTotals: () => accountA.promise });

    // Before A resolves, the user switches to account B - a second call,
    // exactly like the effect re-running with a new userId.
    const promiseB = runProgressFetch({ isGuest: false, userId: 'account-b', requestIdRef, setState, fetchTotals: () => accountB.promise });

    // B's own "loading" clear must already have happened, synchronously,
    // even though neither fetch has resolved yet.
    expect(setState).toHaveBeenCalledWith({ status: 'loading', totals: null });

    // Now resolve A's stale fetch FIRST (out of order) with data that must
    // never be allowed to win.
    accountA.resolve({ ok: true, totals: { totalPractices: 999 } });
    await promiseA;
    expect(setState).not.toHaveBeenCalledWith({ status: 'success', totals: { totalPractices: 999 } });

    // Then resolve B's own fetch - this one must win.
    accountB.resolve({ ok: true, totals: { totalPractices: 5 } });
    await promiseB;
    expect(setState).toHaveBeenLastCalledWith({ status: 'success', totals: { totalPractices: 5 } });
  });

  it('signing out WHILE a fetch is still in flight: the stale response is discarded, and the final state is guest, never the old account\'s totals', async () => {
    const setState = vi.fn();
    const requestIdRef = { current: 0 };
    const account = deferred();

    const fetchPromise = runProgressFetch({ isGuest: false, userId: 'account-a', requestIdRef, setState, fetchTotals: () => account.promise });

    // Sign-out happens before the in-flight fetch resolves.
    await runProgressFetch({ isGuest: true, userId: null, requestIdRef, setState });
    expect(setState).toHaveBeenLastCalledWith({ status: 'guest', totals: null });

    // The stale fetch now resolves - it must not override the guest state.
    account.resolve({ ok: true, totals: { totalPractices: 999 } });
    await fetchPromise;
    expect(setState).toHaveBeenLastCalledWith({ status: 'guest', totals: null });
    expect(setState).not.toHaveBeenCalledWith({ status: 'success', totals: { totalPractices: 999 } });
  });

  it('a query failure clears to the error state, never leaving the previous totals rendered', async () => {
    const setState = vi.fn();
    const requestIdRef = { current: 0 };

    await runProgressFetch({ isGuest: false, userId: 'account-a', requestIdRef, setState, fetchTotals: async () => ({ ok: false, reason: 'not-authenticated' }) });

    expect(setState).toHaveBeenLastCalledWith({ status: 'error', totals: null });
  });
});

describe('Progress.jsx — reuses the existing, already-proven momentum read path (source-only)', () => {
  it('imports queryMomentumData from momentumQueries.js, never a reimplemented query or a new table', () => {
    expect(source).toMatch(/import \{ queryMomentumData \} from '\.\.\/lib\/momentumQueries';/);
  });

  it('never references any table name directly - all reads go through the shared query module', () => {
    expect(source).not.toMatch(/\.from\(['"]/);
  });

  it('runProgressFetch defaults fetchTotals to the real queryMomentumData, so the deployed component always uses the real query, never a mock', () => {
    expect(source).toMatch(/fetchTotals = queryMomentumData/);
  });
});

describe('Progress.jsx — guest, loading, error/retry, and empty states (source-only - no DOM renderer available to actually render these)', () => {
  it('shows a sign-in prompt for guests, never a silently empty or broken page', () => {
    expect(source).toMatch(/state\.status === 'guest'/);
    expect(source).toMatch(/Sign in to see your progress\./);
    expect(source).toMatch(/to="\/auth"/);
  });

  it('shows a loading state distinct from the success/error/guest states', () => {
    expect(source).toMatch(/state\.status === 'loading'/);
  });

  it('shows an error state with a retry action that re-runs the same fetch effect, never a dead end', () => {
    expect(source).toMatch(/state\.status === 'error'/);
    expect(source).toMatch(/const handleRetry = \(\) => setRetryToken/);
    expect(source).toMatch(/onClick=\{handleRetry\}/);
    expect(source).toMatch(/retryToken/);
  });

  it('shows a distinct empty-state message when totalPractices is 0, never the all-zero stat list alongside it', () => {
    expect(source).toMatch(/state\.totals\.totalPractices === 0 \?/);
    expect(source).toMatch(/No completed sessions yet\./);
  });
});

describe('Progress.jsx — labels are literal restatements, never streaks or unsupported statistics (source-only)', () => {
  it('labels activeDateCount as "Active days", never streak language in the rendered output', () => {
    expect(source).toMatch(/label="Active days" value=\{state\.totals\.activeDateCount\}/);
    const renderedBody = source.match(/return \(\s*\n[\s\S]*$/)?.[0] ?? '';
    expect(renderedBody).not.toBe('');
    expect(renderedBody).not.toMatch(/streak/i);
  });

  it('labels meditationMinutes exactly "Guided meditation minutes", matching momentumInsights.js\'s own scoped wording', () => {
    expect(source).toMatch(/label="Guided meditation minutes" value=\{state\.totals\.meditationMinutes\}/);
  });

  it('captions "Total practices" to make clear it counts every recorded event and the categories below are not mutually exclusive with it', () => {
    const body = source.match(/label="Total practices"[\s\S]*?\/>/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/caption="Every recorded completion\. The categories below overlap with this total, not with each other/);
  });

  it('never claims this page proves or extends any duplicate-prevention guarantee beyond what the write path already establishes', () => {
    expect(source).not.toMatch(/prevents duplicate|deduplicat(e|es|ion) (completions|rows|entries)/i);
  });
});

describe('App.jsx / Profile.jsx — route and navigation wiring (source-only)', () => {
  it('registers the /progress route as its own lazy-loaded page, never bundled into the main chunk', () => {
    expect(appSource).toMatch(/const Progress = lazy\(\(\) => import\('\.\/pages\/Progress'\)\.then\(\(m\) => \(\{ default: m\.Progress \}\)\)\);/);
    expect(appSource).toMatch(/<Route path="progress" element=\{withFallback\(<Progress \/>\)\} \/>/);
  });

  it('Profile.jsx adds a distinct "My Progress" row without altering the existing Journey row/link', () => {
    expect(profileSource).toMatch(/<Link to="\/journey" className=\{rowClass\}>/);
    expect(profileSource).toMatch(/<Link to="\/progress" className=\{rowClass\}>/);
    expect(profileSource).toMatch(/My Progress/);
    expect(profileSource).toMatch(/Journey and progress/);
  });
});
