/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlarm } from '../context/AlarmContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { EveningReviewBanner } from '../components/evening/EveningReviewBanner';
import { EveningReviewQuestion } from '../components/evening/EveningReviewQuestion';
import { REFLECTION_PROMPTS } from '../lib/eveningJourneyQuestions';
import { loadRoutineResponses } from '../lib/routineResponses';
import { parseActiveIndex } from '../lib/questionStepNavigation';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { getEveningCompletionKey } from '../lib/dailyCompletion';

/*
 * Evening completed-review — ReflectionReview (/review/reflection?q=N)
 *
 * Read-only look back at tonight's ALREADY-SAVED Reflection answers.
 * Deliberately NOT a session-engine-coupled page: no useSession, no
 * advanceStep/completeSession/startSession/resetSession/resetRoutine
 * import anywhere in this file - there is nothing here to start, resume,
 * reset, advance, or complete (Phase 1 report §4/§7/§9 - the completed
 * session's own sessionId/completionEventId are already gone by the time
 * a user could ever reach this page, and coupling to the live engine is
 * explicitly out of scope). Equally deliberately NOT wired to
 * upsertRoutineResponse/deleteRoutineResponse - this file does not import
 * either, so it cannot write a response even by accident; only
 * loadRoutineResponses (a pure read) is imported.
 *
 * IDENTITY/OWNERSHIP: the only URL input this page accepts is `?q=`, via
 * the same allowlisted parseActiveIndex used by the live Reflection.jsx -
 * no userId, session id, return URL, or local date is ever read from the
 * URL. Identity (userId), the fixed session type, and today's local date
 * all come from the authenticated context exactly like the live journey
 * already does. Supabase RLS is the final ownership boundary regardless
 * (see routine_responses' own owner-only policies) - this page cannot
 * construct a query that reaches another user's rows even in principle.
 *
 * GUARDS, IN ORDER: unauthenticated (guest) -> neutral message, no
 * query at all; no completed-Evening flag for TODAY's own local date ->
 * safe "nothing to review yet" fallback, never presenting stale/partial
 * data as a completed review; only once both guards pass does this page
 * ever call loadRoutineResponses.
 */
const SESSION_ID = 'evening-wind-down';
const STEP_ID = 'reflection';

const backFallbackForIndex = (activeIndex) => (activeIndex === 0 ? '/evening-complete' : `/review/reflection?q=${activeIndex}`);

export const ReflectionReview = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeIndex = parseActiveIndex(searchParams, REFLECTION_PROMPTS.length);
  const { isGuest } = useAuth();
  const { effectiveTimezone, userId } = useAlarm();

  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;
  // Plain synchronous localStorage read during render - the same
  // established pattern Home.jsx's own isEveningDone already uses, not a
  // new async check. Never presented as a completed review without this
  // flag genuinely matching today, regardless of what routine_responses
  // rows might otherwise exist (e.g. a partial, uncompleted attempt).
  const isEveningDoneToday = !isGuest && localStorage.getItem(getEveningCompletionKey(userId)) === today;

  // null = still loading; object = loaded (possibly empty - "no response
  // saved" is handled per-question by EveningReviewQuestion, not as a
  // separate page-level empty state).
  const [responses, setResponses] = useState(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (isGuest || !isEveningDoneToday) return;
    let cancelled = false;
    loadRoutineResponses({ userId, sessionId: SESSION_ID, stepId: STEP_ID, localDate: today })
      .then((loaded) => {
        if (!cancelled) setResponses(loaded);
      })
      .catch(() => {
        // loadRoutineResponses itself already fails safe to {} and never
        // throws (matching this app's own established convention) - this
        // catch is defensive-only, kept explicit rather than assumed.
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isGuest, isEveningDoneToday, userId, today]);

  const handleReturnToSummary = () => navigate('/evening-complete');

  if (isGuest) {
    return (
      <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/">
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
          <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">lock</span>
          <h1 className="font-serif italic text-2xl text-on-surface">Sign in to review your journey</h1>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            Guest reflections aren't saved, so there's nothing saved here to review yet.
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          Return Home
        </button>
      </EveningSceneShell>
    );
  }

  if (!isEveningDoneToday) {
    return (
      <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/">
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
          <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">nightlight</span>
          <h1 className="font-serif italic text-2xl text-on-surface">Nothing to review yet</h1>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            Complete tonight's Evening Wind-Down to review your reflections here.
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          Return Home
        </button>
      </EveningSceneShell>
    );
  }

  if (loadError) {
    return (
      <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/evening-complete">
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
          <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">error</span>
          <h1 className="font-serif italic text-2xl text-on-surface">Couldn't load your journey</h1>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            Something went wrong loading tonight's saved answers. Please try again shortly.
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          Return Home
        </button>
      </EveningSceneShell>
    );
  }

  const activePrompt = REFLECTION_PROMPTS[activeIndex];
  const isLast = activeIndex === REFLECTION_PROMPTS.length - 1;
  const handleNext = () => {
    if (isLast) {
      navigate('/review/gratitude?q=1');
      return;
    }
    navigate(`/review/reflection?q=${activeIndex + 2}`);
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback={backFallbackForIndex(activeIndex)}>
      <span className="block text-center text-[10px] text-primary uppercase font-bold tracking-wider">Reflection</span>
      <EveningReviewBanner onReturn={handleReturnToSummary} />

      <div className="flex-1 flex flex-col justify-center space-y-6">
        <div className="glass-panel rounded-3xl p-6">
          {/* Loading state - genuinely distinct from "no response saved":
              never render the question list (which would show every
              option as unanswered) until the real saved data has
              actually arrived. */}
          {responses === null ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-on-surface-variant/60 text-3xl animate-pulse">hourglass_top</span>
              <p className="text-xs text-on-surface-variant mt-2">Loading tonight's journey…</p>
            </div>
          ) : (
            <EveningReviewQuestion
              prompt={activePrompt}
              questionNumber={activeIndex + 1}
              totalQuestions={REFLECTION_PROMPTS.length}
              savedValue={responses[activePrompt.id]}
              accent="reflection"
              groupName={`review-${activePrompt.id}`}
            />
          )}
        </div>

        {responses !== null && (
          <button
            onClick={handleNext}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            <span>{isLast ? 'Continue' : 'Next'}</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        )}
      </div>
    </EveningSceneShell>
  );
};
