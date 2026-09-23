/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlarm } from '../context/AlarmContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { EveningReviewBanner } from '../components/evening/EveningReviewBanner';
import { EveningReviewQuestion } from '../components/evening/EveningReviewQuestion';
import { GRATITUDE_PROMPTS } from '../lib/eveningJourneyQuestions';
import { loadRoutineResponses } from '../lib/routineResponses';
import { parseActiveIndex } from '../lib/questionStepNavigation';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { getEveningCompletionKey } from '../lib/dailyCompletion';

/*
 * Evening completed-review — GratitudeReview (/review/gratitude?q=N)
 *
 * Structurally identical to ReflectionReview.jsx (see that file's own
 * doc comment for the full no-session-engine/no-write/identity/guard
 * rationale, which applies here unchanged). The one behavioural
 * difference is Q1's Back destination: it returns to Reflection's own
 * last question (`/review/reflection?q=3`), not Reflection's Q1 - the
 * exact same cross-section stitching already proven correct in the live
 * journey's own Gratitude.jsx, reused verbatim here for review.
 */
const SESSION_ID = 'evening-wind-down';
const STEP_ID = 'gratitude';

const backFallbackForIndex = (activeIndex) => (activeIndex === 0 ? '/review/reflection?q=3' : `/review/gratitude?q=${activeIndex}`);

export const GratitudeReview = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeIndex = parseActiveIndex(searchParams, GRATITUDE_PROMPTS.length);
  const { isGuest } = useAuth();
  const { effectiveTimezone, userId } = useAlarm();

  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;
  const isEveningDoneToday = !isGuest && localStorage.getItem(getEveningCompletionKey(userId)) === today;

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

  const activePrompt = GRATITUDE_PROMPTS[activeIndex];
  const isLast = activeIndex === GRATITUDE_PROMPTS.length - 1;
  const handleNext = () => {
    if (isLast) {
      navigate('/evening-complete');
      return;
    }
    navigate(`/review/gratitude?q=${activeIndex + 2}`);
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback={backFallbackForIndex(activeIndex)}>
      <span className="block text-center text-[10px] text-primary uppercase font-bold tracking-wider">Gratitude</span>
      <EveningReviewBanner onReturn={handleReturnToSummary} />

      <div className="flex-1 flex flex-col justify-center space-y-6">
        <div className="glass-panel rounded-3xl p-6">
          {responses === null ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-on-surface-variant/60 text-3xl animate-pulse">hourglass_top</span>
              <p className="text-xs text-on-surface-variant mt-2">Loading tonight's journey…</p>
            </div>
          ) : (
            <EveningReviewQuestion
              prompt={activePrompt}
              questionNumber={activeIndex + 1}
              totalQuestions={GRATITUDE_PROMPTS.length}
              savedValue={responses[activePrompt.id]}
              accent="gratitude"
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
