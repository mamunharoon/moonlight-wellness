/* eslint-disable react-refresh/only-export-components -- runProgressFetch is exported alongside the component so it can be executed directly in a real test (see Progress.test.js); same established convention as every Context file in this repo (e.g. AlarmContext.jsx) that exports both a component and a plain function. */
import { useEffect, useRef, useState } from 'react';
// eslint-disable-next-line no-unused-vars -- component referenced only via JSX below reads as unused to the base no-unused-vars rule (no React-aware eslint plugin in this project, same as FastStartPilot.jsx's own identical comment)
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlarm } from '../context/AlarmContext';
// eslint-disable-next-line no-unused-vars -- component referenced only via JSX below reads as unused to the base no-unused-vars rule
import { BackButton } from '../components/BackButton';
import { queryMomentumData } from '../lib/momentumQueries';

// WakeWise — Profile → My Progress (PRG-05).
//
// Reuses the SAME, already-proven read path every completion screen uses
// (momentumQueries.js's queryMomentumData -> fetchCompletionRows +
// computeMomentumTotals, verified exact against a hand-counted fixture —
// see PRG-01). No new query, no new counting rule, no new table, no new
// deduplication logic of its own: this page only reads already-written
// rows, so whatever duplicate-prevention guarantee exists at the write
// path (recordPracticeCompletion's own idempotency key, and the
// Welcome-back-card fix — see PRG-04, including that PRG-04's own
// device-level verification of the original bypass remains unconfirmed)
// is inherited exactly as-is here, never re-verified, re-claimed, or
// extended by this page.
//
// Isolation: RLS (practice_completion_events_select_own: auth.uid() =
// user_id) plus momentumQueries.js's own .eq('user_id', userId) defence-
// in-depth already restrict reads server-side. This page's only added
// responsibility is never applying a STALE response after the signed-in
// identity changes — the requestIdRef guard below mirrors
// useMomentumCompletion.js's own established race-free pattern exactly:
// a response that resolves after a newer request has already started
// (e.g. sign-out followed quickly by a different sign-in) is discarded,
// never applied.
//
// Labels are literal restatements of each field, not interpretations —
// no streaks, no "mindful minutes" beyond meditationMinutes as already
// defined, no comparisons, matching momentumInsights.js's own documented
// policy. "Total practices" is explicitly captioned as counting every
// recorded completion event — the categories below it overlap with that
// total, not with each other, and are never implied to sum to it.

// eslint-disable-next-line no-unused-vars -- component referenced only via JSX below reads as unused to the base no-unused-vars rule
const StatRow = ({ label, value, caption }) => (
  <div className="flex items-center justify-between p-4 min-h-[56px] gap-4">
    <div>
      <p className="text-sm font-semibold text-on-surface">{label}</p>
      {caption && <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">{caption}</p>}
    </div>
    <p className="text-lg font-bold text-on-surface shrink-0">{value}</p>
  </div>
);

/**
 * The actual request/clear logic, extracted so it can be executed for
 * real in a test (not just source-matched) — this is a plain function,
 * not a hook, so a test can call it directly with a fake requestIdRef and
 * a recording setState, with full control over WHEN the fetch resolves.
 *
 * The property this exists to prove: switching identity (sign-out,
 * account switch, or landing on guest) clears any previously rendered
 * totals IMMEDIATELY — via the synchronous setState calls below, before
 * the network call is even made — never waiting for the next fetch to
 * resolve first. A request-id guard alone (the `requestIdRef` check
 * inside the .then()) only stops a STALE RESPONSE from being applied; it
 * does nothing by itself to clear already-rendered state, which is why
 * both branches below call setState synchronously before doing anything
 * asynchronous.
 *
 * Unmount: if the calling component unmounts while the returned promise
 * is still pending, the stale `setState` callback it closed over still
 * gets called when the old fetch resolves — but this is React 18
 * (package.json pins ^18.3.1, confirmed, not assumed), where calling
 * setState on an unmounted function component is a documented no-op, not
 * a leak into whatever NEW instance may have mounted since (a fresh mount
 * owns its own requestIdRef/state closure entirely). No additional guard
 * is needed here for that reason specifically.
 */
export const runProgressFetch = async ({ isGuest, userId, requestIdRef, setState, fetchTotals = queryMomentumData }) => {
  if (isGuest || !userId) {
    // Bumping the request id here too, so a fetch already in flight for a
    // PREVIOUSLY signed-in user can never land after sign-out and be
    // mistaken for this (now guest) identity's data.
    requestIdRef.current += 1;
    setState({ status: 'guest', totals: null });
    return;
  }

  const requestId = requestIdRef.current + 1;
  requestIdRef.current = requestId;
  // Cleared SYNCHRONOUSLY, before the fetch below ever starts — this is
  // what actually hides a previous account's totals immediately, not the
  // requestId check further down (that only guards the LATER, async
  // response).
  setState({ status: 'loading', totals: null });

  const result = await fetchTotals({ userId });
  // A later request (sign-out/sign-in, account switch, or a retry) has
  // already started — never apply this now-stale response.
  if (requestIdRef.current !== requestId) return;

  if (!result.ok) {
    console.warn('Progress totals unavailable:', result.error?.message ?? result.reason);
    setState({ status: 'error', totals: null });
    return;
  }
  setState({ status: 'success', totals: result.totals });
};

export const Progress = () => {
  const { isGuest, loading: authLoading } = useAuth();
  const { userId } = useAlarm();
  const [state, setState] = useState({ status: 'idle', totals: null });
  const [retryToken, setRetryToken] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    runProgressFetch({ isGuest, userId, requestIdRef, setState });
  }, [authLoading, isGuest, userId, retryToken]);

  const handleRetry = () => setRetryToken((t) => t + 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Navigation audit: reached only from Profile's "My Progress" row,
          not a bottom-nav tab — same own-back-affordance-header pattern
          as Journey.jsx/Settings.jsx/Subscription.jsx. */}
      <div className="flex items-center gap-3">
        <BackButton fallback="/profile" label="Back to Profile" />
        <div>
          <h2 className="font-headline-lg text-2xl md:text-3xl text-on-surface font-bold tracking-tight">My Progress</h2>
          <p className="text-on-surface-variant font-body-md mt-1">
            Your completed sessions, from your own practice history.
          </p>
        </div>
      </div>

      {state.status === 'guest' && (
        <div className="glass-panel p-6 rounded-3xl space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)] text-center">
          <p className="text-sm text-on-surface-variant">Sign in to see your progress.</p>
          <Link
            to="/auth"
            className="inline-block bg-primary text-on-primary py-3 px-6 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all"
          >
            Sign in
          </Link>
        </div>
      )}

      {state.status === 'loading' && (
        <p className="text-xs text-on-surface-variant/40 italic text-center">Loading your progress…</p>
      )}

      {state.status === 'error' && (
        <div className="glass-panel p-6 rounded-3xl space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)] text-center">
          <p className="text-sm text-on-surface-variant">We couldn't load your progress right now.</p>
          <button
            onClick={handleRetry}
            className="bg-primary text-on-primary py-3 px-6 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === 'success' && state.totals && (
        state.totals.totalPractices === 0 ? (
          <p className="text-xs text-on-surface-variant/40 italic text-center">
            No completed sessions yet. Complete a Morning Reset, Evening Wind-Down, or guided meditation to see your progress here.
          </p>
        ) : (
          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            <StatRow
              label="Total practices"
              value={state.totals.totalPractices}
              caption="Every recorded completion. The categories below overlap with this total, not with each other — they're not meant to add up to it."
            />
            <StatRow label="Morning Resets completed" value={state.totals.morningTotal} />
            <StatRow label="Evening Wind-Downs completed" value={state.totals.eveningTotal} />
            <StatRow label="Guided meditations completed" value={state.totals.meditationCount} />
            <StatRow label="Guided meditation minutes" value={state.totals.meditationMinutes} />
            <StatRow label="Active days" value={state.totals.activeDateCount} />
          </div>
        )
      )}
    </div>
  );
};
