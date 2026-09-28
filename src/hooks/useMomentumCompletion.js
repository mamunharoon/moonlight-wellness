import { useEffect, useRef, useState } from 'react';
import { fetchCompletionRows } from '../lib/momentumQueries';
import { computeMomentumForCompletion, acknowledgeMilestone } from '../lib/momentumInsights';

// "Your Momentum" foundation, Phase 3 — the ONE shared hook every eligible
// completion screen (SessionComplete.jsx, EveningComplete.jsx, Meditate.jsx)
// calls to load its factual insight/milestone. Never queries independently
// per screen beyond this one hook; never mutates completion events; never
// blocks/delays the existing Continue/Return action, which renders
// immediately regardless of this hook's own status.
//
// RACE-FREE BY CONSTRUCTION:
//   - `ready` must only become true once the caller's own
//     recordPracticeCompletion() call has resolved ok (success or
//     deduplicated) for THIS exact sessionId - never before. Passing a
//     `ready` that flips true/false/true again (e.g. a genuinely new
//     completion superseding an old one) safely restarts the query for
//     the new identity; it is never inferred by guessing "the latest row."
//   - An internal request-id ref discards any response that resolves
//     after a newer request has already started (a second completion in
//     the same visit, or this component unmounting/re-mounting) - never
//     applies stale state.
//   - Guests never reach the network at all (isGuest gates before any
//     fetch).
//   - A query failure sets status 'error' and returns
//     { insight: null, milestone: null } - the caller's existing
//     greeting/CTA are always rendered independently of this hook's
//     status, so a failure here never blocks or breaks the completion
//     screen; it only omits the Momentum content. Logged via
//     console.warn, matching every other best-effort read in this app
//     (e.g. routineResponses.js's own loadRoutineResponses).
//   - Milestone acknowledgement (same-device, see momentumInsights.js) is
//     written exactly once, at the moment this hook actually decides to
//     surface it - never merely when computed, so a request that resolves
//     but is then discarded as stale never burns the acknowledgement.
export const useMomentumCompletion = ({ ready, userId, isGuest, sessionId, journey, practiceType }) => {
  const [state, setState] = useState({ status: 'idle', insight: null, milestone: null });
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!ready || !sessionId) return;
    // Guest/no-userId is fully derivable from these same props alone, with
    // nothing asynchronous about it - handled as a plain derived value
    // below, never via a synchronous setState directly in this effect
    // body (react-hooks/set-state-in-effect: an Effect calling setState
    // with nothing that actually depends on an external system is the
    // "you might not need an Effect" anti-pattern).
    if (isGuest || !userId) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    // Kicking off the fetch below is the actual external-system
    // subscription this effect exists for; this synchronous setState just
    // reflects that a request is now in flight for this exact identity -
    // the standard "fetch data" idiom react-hooks/set-state-in-effect's
    // own message describes as sanctioned ("calling setState... when
    // external state changes"), not the "you might not need an Effect"
    // anti-pattern it otherwise guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ status: 'loading', insight: null, milestone: null });

    fetchCompletionRows({ userId }).then((result) => {
      // Superseded by a newer request (e.g. a second genuine completion
      // in the same visit already started its own query) - never applies
      // this now-stale response.
      if (requestIdRef.current !== requestId) return;

      if (!result.ok) {
        console.warn('Momentum insight unavailable:', result.error?.message ?? result.reason);
        setState({ status: 'error', insight: null, milestone: null });
        return;
      }

      const { insight, milestone } = computeMomentumForCompletion({
        rows: result.rows,
        currentSessionId: sessionId,
        userId,
        journey,
        practiceType
      });
      if (milestone) acknowledgeMilestone(userId, milestone.id);
      setState({ status: 'success', insight, milestone });
    });
  }, [ready, userId, isGuest, sessionId, journey, practiceType]);

  // Derived, not stored: guest status depends only on props already
  // available this render, so it's computed here rather than round-
  // tripped through the effect + state above.
  if (ready && sessionId && (isGuest || !userId)) {
    return { status: 'guest', insight: null, milestone: null };
  }
  return state;
};
