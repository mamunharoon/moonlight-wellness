/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { BackButton } from '../components/BackButton';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { getPinnedRoutineDate, unpinRoutineDate, clearRoutineProgress } from '../session/routineProgress';
import { shouldWriteCompletionDate } from '../lib/routineCardState';
import { roleForIndex } from '../lib/intentionSelection';
import { getMorningCompletionKey, getMorningFullyCompletedKey } from '../lib/dailyCompletion';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { JourneyGlow } from '../components/JourneyGlow';
import { getCompletionGreeting } from '../lib/outcomeMessages';
import { getReducedMotionPreference } from '../lib/reducedMotionPreference';
import { recordPracticeCompletion } from '../lib/practiceCompletions';
import { useMomentumCompletion } from '../hooks/useMomentumCompletion';
import { CompletionReveal } from '../components/CompletionReveal';
import { MomentumPanel } from '../components/MomentumPanel';
import { ExploreCard } from '../components/ExploreCard';
import { getMorningExploreCatalog } from '../lib/exploreFiltering';
import { MorningJourneyPathway } from '../components/MorningJourneyPathway';
import { MORNING_PATHWAY_STAGES } from '../session/pathwayStages';
import { computeStageStatus, isFullyCompleted } from '../session/stageStatus';

const RING_CIRCUMFERENCE = 276.46;

export const SessionComplete = () => {
  const navigate = useNavigate();
  const { intentions, setJourneyStep, effectiveTimezone, userId } = useAlarm();
  // Stage 3C Group 3D Batch C: mirrors the final intention -> complete
  // completion into the Session Engine on mount, and resets the mirror on
  // Return Home. COMPLETE_SESSION is idempotent in the reducer itself (a
  // repeat call once status is already 'completed' returns the exact same
  // state reference, no new completionEventId) — this is what keeps a
  // StrictMode double-invoke of the mount effect below safe without needing
  // an extra guard ref here.
  const { state, currentStep, completeSession, resetSession } = useSession();

  // Phase 9 — Truthful Journey Outcomes: computed early (before the
  // completion-recording effects below, which must gate on it) from the
  // Session Engine's own stepOutcomes - never inferred from having reached
  // this screen. A direct/stale visit still resolves whatever stepOutcomes
  // state genuinely holds; a stage is never fabricated as "completed"
  // merely because this is the terminal screen.
  const morningPathwayStages = computeStageStatus({
    stages: MORNING_PATHWAY_STAGES,
    stepOutcomes: state.stepOutcomes,
    currentStepId: currentStep?.id ?? null,
    sessionStatus: state.status
  });
  const morningFullyCompleted = isFullyCompleted(morningPathwayStages);

  // WakeWise Phase 3B (3B.1) — captured once, before the mount effect below
  // can flip state.status to 'completed': true only for a genuine natural
  // completion arriving with the session still 'playing' (the exact same
  // signal the effect itself gates completeSession() on). A direct/
  // refreshed visit, or a Review Mode revisit, mounts with status already
  // 'completed' and never animates - matching this file's own established
  // "same static screen either way" precedent for those cases, just now
  // additionally deciding whether the ring animates rather than only what
  // copy it shows.
  const [isFreshCompletion] = useState(() => state.status === 'playing');
  const [reducedMotion] = useState(() => {
    try {
      return Boolean(getReducedMotionPreference() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  });
  // Starts empty only when it genuinely needs to animate; a revisit or
  // Reduced Motion renders the final 100% state immediately, no flash of
  // an empty ring first.
  const [ringFilled, setRingFilled] = useState(() => !isFreshCompletion || reducedMotion);

  // "Your Momentum" foundation, Phase 2 — integrity fix: the daily
  // completion-date flag below used to be written only on "Continue to My
  // Day" (handleReturnHome), which meant a genuinely completed Morning
  // routine could be lost entirely if the app was closed/backgrounded
  // before that tap. Moved here, into the same mount effect that already
  // calls completeSession() - EveningComplete.jsx's own already-proven
  // mount-time pattern - so both the flag and completeSession() fire
  // together, synchronously, the instant this screen is genuinely reached
  // via a real natural completion. The CTA (handleReturnHome) below is now
  // navigation/cleanup only - it never needs to run for this flag to be
  // set. Only ever runs when state.status is genuinely 'playing' at this
  // exact terminal step - a direct/stale visit, or an already-completed
  // remount/revisit, leaves this branch untouched (state.status is then
  // never 'playing'), so the flag can never be set twice or set falsely.
  useEffect(() => {
    if (state.status === 'playing' && currentStep?.id === 'complete') {
      completeSession();
      // "Repeat Morning Routine"/"Resume Previous Routine" remediation -
      // a session resumed from a genuinely stale (prior local day)
      // snapshot is pinned to its own original dateKey, so its completion
      // credits that original day, never today; an ordinary session
      // (including one spanning a local midnight) still credits "now".
      // User-scoped: writes to the CURRENT identity's own key
      // (dailyCompletion.js), so this completion is never later read back
      // as a different user's.
      const pinnedDateKey = getPinnedRoutineDate(state.sessionId);
      const attributionDateKey = pinnedDateKey ?? getZonedParts(effectiveTimezone, devNow()).dateKey;
      const morningDoneKey = getMorningCompletionKey(userId);
      if (shouldWriteCompletionDate(localStorage.getItem(morningDoneKey), attributionDateKey)) {
        localStorage.setItem(morningDoneKey, attributionDateKey);
      }
      // Phase 9 — Truthful Journey Outcomes (Part 8/9): the additive
      // "genuinely fully completed today" signal, written only when every
      // displayed Morning stage is genuinely 'completed' - never for a
      // partial run. morningDoneKey above keeps its own separate, broader
      // meaning ("reached a genuine completion today, so there is
      // something real to review") untouched.
      if (morningFullyCompleted) {
        const morningFullyDoneKey = getMorningFullyCompletedKey(userId);
        if (shouldWriteCompletionDate(localStorage.getItem(morningFullyDoneKey), attributionDateKey)) {
          localStorage.setItem(morningFullyDoneKey, attributionDateKey);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, currentStep, completeSession]);

  // "Your Momentum" foundation, Phase 2 — this new completion EVENT (a
  // separate concern from the daily completion-date flag above - see
  // practiceCompletions.js) follows Evening's own proven mount-time
  // pattern too: it fires the instant state.completionEventId is genuinely
  // minted (the COMPLETE_SESSION transition above, or an already-completed
  // remount/resume - never a direct/stale visit, since state.status is
  // then never 'completed' with a real completionEventId to begin with).
  // Keyed on completionEventId
  // rather than [state.status, currentStep, completeSession] like the
  // effect above, so it never re-fires on an unrelated re-render once this
  // exact id has already been seen - and recordPracticeCompletion's own
  // database uniqueness constraint (never a React ref alone) is what
  // actually keeps this to one row per id even if this effect is ever
  // double-invoked (StrictMode) or this screen is later revisited.
  //
  // Duration policy correction — deliberately NULL, never
  // state.updatedAt - state.startedAt. That elapsed wall-clock span is not
  // a mindful/active-duration measurement: it includes any time genuinely
  // spent interrupted/backgrounded mid-routine (INTERRUPT_SESSION/
  // RESUME_SESSION both advance updatedAt), so it would silently overstate
  // real engaged time - reported as fact, that is a false claim, not an
  // honest estimate. The Session Engine has no accumulator that tracks
  // only genuinely active (non-paused) time, and Phase 2 is deliberately
  // not building one - see practiceCompletions.js's own doc comment.
  // Routine mindful-minute insights are simply unavailable until a real,
  // verified active-duration measurement exists; this column staying NULL
  // for every Morning/Evening row is the honest reflection of that, not a
  // bug to work around later by approximating it here.
  // "Your Momentum" foundation, Phase 3 — the write's own resolution is
  // now captured (previously fire-and-forget): `confirmedSessionId` only
  // ever holds a completionEventId once recordPracticeCompletion has
  // genuinely resolved ok (a fresh insert or a safely-deduplicated
  // retry) for that EXACT id - this is the "current event confirmed or
  // safely deduplicated" gate useMomentumCompletion below requires before
  // it ever queries. Never a persistence redesign: recordPracticeCompletion
  // itself, and the identity it's called with, are completely unchanged -
  // only this local component now also listens for the result it already
  // returned. A stale response (e.g. this effect re-firing for a NEW
  // completionEventId before the OLD one's write settled) is discarded via
  // the `cancelled` flag, matching every other cleanup-guarded async
  // effect in this app.
  const [confirmedSessionId, setConfirmedSessionId] = useState(null);
  useEffect(() => {
    // Phase 9 — Truthful Journey Outcomes (Part 8): a full_routine
    // completion event must only ever be written when every displayed
    // Morning stage is genuinely 'completed' - reaching this terminal
    // screen (state.status === 'completed') is necessary but never
    // sufficient on its own. A partial run (any skipped/ended-early/
    // not-reached stage) still shows this same supportive screen, just
    // with no full_routine event and no full-routine Momentum credit.
    // Individual practice completions (e.g. Breathing/Meditation, if
    // separately tracked) are untouched by this gate - they are recorded
    // elsewhere, at their own natural-completion moment, regardless of
    // how the surrounding routine ultimately finishes.
    if (state.status !== 'completed' || !state.completionEventId || !morningFullyCompleted) return;
    let cancelled = false;
    recordPracticeCompletion({
      userId,
      isGuest: !userId,
      sessionId: state.completionEventId,
      journey: 'morning',
      practiceType: 'full_routine',
      durationSeconds: null,
      timezone: effectiveTimezone
    }).then((result) => {
      if (!cancelled && result.ok) setConfirmedSessionId(state.completionEventId);
    });
    return () => {
      cancelled = true;
    };
  }, [state.status, state.completionEventId, morningFullyCompleted, userId, effectiveTimezone]);

  // "Your Momentum" foundation, Phase 3 — factual insight + gentle
  // milestone for this exact, already-confirmed completion event. Never
  // blocks/delays Continue to My Day, which renders unconditionally below
  // regardless of this hook's own status (idle/loading/success/error/
  // guest) - see useMomentumCompletion.js's own doc comment.
  const momentum = useMomentumCompletion({
    ready: confirmedSessionId === state.completionEventId,
    userId,
    isGuest: !userId,
    sessionId: state.completionEventId,
    journey: 'morning',
    practiceType: 'full_routine'
  });

  useEffect(() => {
    if (ringFilled) return;
    // A short delay (not requestAnimationFrame's next-paint timing alone)
    // reliably lets the browser commit the initial empty-ring paint first,
    // so the stroke-dashoffset transition below is actually observed
    // rather than the fill appearing to jump straight to 100%.
    const timer = setTimeout(() => setRingFilled(true), 80);
    return () => clearTimeout(timer);
    // Runs once - deliberately not re-armed by any later state change, so
    // the fill never replays (e.g. on an unrelated re-render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Your Momentum" foundation, Phase 2 — timing fix: this handler no
  // longer writes the daily completion-date flag itself (moved to the
  // mount effect above, alongside completeSession(), matching
  // EveningComplete.jsx's own already-proven pattern) - by the time a user
  // can even see this button, the flag has already been set if this was a
  // genuine completion. This is now navigation/cleanup only: unpin/clear
  // this routine's progress snapshot, reset the Session Engine's journey
  // step, and go Home. Never required for the flag or the database
  // completion event to have been recorded - closing/backgrounding the app
  // before this tap is ever pressed loses nothing.
  const handleReturnHome = () => {
    if (state.sessionId) {
      unpinRoutineDate(state.sessionId);
      clearRoutineProgress(state.sessionId);
    }
    setJourneyStep('');
    navigate('/');
    resetSession();
  };

  const displayIntentions = intentions.length > 0 ? intentions : ['Stay calm'];

  // WakeWise DEV — full Morning routine completion correction: this
  // screen is reached ONLY on a genuine natural completion (the mount
  // effect above gates completeSession() on state.status==='playing'; a
  // direct/refreshed visit or a mismatched step still renders this same
  // static screen, unaffected). Now shares the same completion-message
  // architecture as Morning Breathing/Stretch/Meditation
  // (getCompletionGreeting - outcomeMessages.js) instead of its own
  // separate headline/body pair, picked once and held stable via
  // localStorage's own per-(journey, practice) non-repeat tracking -
  // never re-rolled on rerender/reopen.
  const [completionGreeting] = useState(() => getCompletionGreeting({ journey: 'morning', practice: 'routine' }));

  return (
    // Build 16 physical-iPhone correction (F8) - see Affirmation.jsx's
    // identical block for the full rationale.
    <div
      className="min-h-[85vh] flex flex-col justify-between pb-6 max-w-md mx-auto space-y-10 select-none"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))'
      }}
    >
      {/* WakeWise DEV — colour glow extension: subtle warm-gold ambient
          backdrop behind this step's own completion ring/badge. */}
      <JourneyGlow journey="morning" />

      <div className="flex items-center justify-between gap-3">
        {/* Back-navigation repair (Morning canonical map) — Morning is
            finished; there is no "leave this routine" concept left, so
            guardActiveRoute is off. alwaysFallback forces a plain replace
            to Home instead of BackButton's normal goBack (which would
            otherwise navigate(-1) straight back into the just-completed
            Affirmation step - "do not re-enter a completed journey using
            browser Back"). */}
        <BackButton fallback="/" guardActiveRoute={false} alwaysFallback />
        {/* Morning Visual Uplift (Build 16) — a small decorative orienting
            badge, the same established pattern Home's own "YOUR MORNING"
            pill already uses (Build 15) - not new data, just a label. */}
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-morning-accent/10 border border-morning-accent-tint/25 text-morning-accent text-[10px] font-bold uppercase tracking-wider">
          Morning Flow
        </span>
      </div>

      {/* Circular Gauge */}
      <div className="relative w-40 h-40 mx-auto flex items-center justify-center mt-4 rounded-full shadow-morning-glow">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" fill="transparent" r="44" stroke="rgba(255,255,255,0.05)" strokeWidth="4"></circle>
          {/* WakeWise Phase 3B (3B.1) — animates from empty to full only on
              a genuine fresh completion with Reduced Motion off (see
              ringFilled above); a revisit or Reduced Motion renders this
              at strokeDashoffset 0 from the very first paint, no
              transition attached. */}
          <circle
            cx="50"
            cy="50"
            fill="transparent"
            r="44"
            stroke="var(--color-gratitude-accent)"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={ringFilled ? 0 : RING_CIRCUMFERENCE}
            strokeLinecap="round"
            strokeWidth="5"
            style={isFreshCompletion && !reducedMotion ? { transition: 'stroke-dashoffset 900ms ease-out' } : undefined}
          ></circle>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {/* Phase 9 — Truthful Journey Outcomes: the numeric "100%"/
              "Complete" claim is removed - this ring is a decorative
              "you reached the end" marker, never a graded score. The
              real, truthful outcome is stated in words below (heading +
              supporting line), gated on whether every stage genuinely
              completed. */}
          <span className="material-symbols-outlined text-morning-accent text-3xl font-bold">check_circle</span>
        </div>
      </div>

      {/* "Your Momentum" foundation, Phase 3 — shared completion-reveal
          transition wraps the greeting/insight/milestone/summary content
          only; the ring above keeps its own pre-existing, independent
          fresh-completion animation untouched, and the primary action
          below stays outside this wrapper entirely - always immediately
          rendered and reachable, never gated on any fade timing.
          isFresh is this file's own pre-existing isFreshCompletion signal
          (a direct/stale visit or revisit never animates) - CompletionReveal
          cannot auto-detect freshness here since this whole screen only
          ever shows the completed state, unlike a ternary-swap screen. */}
      <CompletionReveal
        active
        isFresh={isFreshCompletion}
        journeyTone="morning"
        className="space-y-3"
        stagger={[
          <div key="greeting" className="text-center space-y-2">
            {/* Phase 9 — Truthful Journey Outcomes (Part 7): exact
                approved copy, gated on morningFullyCompleted - "complete"
                is shown ONLY when every displayed Morning stage is
                genuinely completed; any skipped/ended-early/not-reached
                stage shows the "finished" variant instead. Never a
                percentage, either way. */}
            <h1 className="text-2xl font-morning-display italic font-semibold text-on-surface leading-tight">
              {morningFullyCompleted ? 'Morning Reset complete' : 'Morning Reset finished'}
            </h1>
            <p className="text-sm text-on-surface-variant">
              {morningFullyCompleted ? 'You made time to begin your day with intention.' : 'Every intentional moment still matters.'}
            </p>
            {/* The pre-existing rotating greeting stays as a smaller,
                secondary line - every phrase in the morning/routine pool
                (outcomeMessages.js) is a generic, supportive affirmation
                that never itself claims full completion, so it never
                contradicts the "finished" outcome above. */}
            <p className="text-sm text-on-surface-variant/80 italic">{completionGreeting}</p>
          </div>,
          <MomentumPanel key="momentum" insight={momentum.insight} milestone={momentum.milestone} />
        ]}
      />

      {/* Phase 9 — Truthful Journey Outcomes: the real per-stage pathway
          for this run, added to the final Morning summary screen per
          Part 4/5 of the spec (this screen previously showed no
          high-level journey context at all). */}
      <MorningJourneyPathway stages={morningPathwayStages} />

      {/* Summary card */}
      <div className="glass-panel p-5 rounded-2xl text-left text-xs text-on-surface-variant w-full max-w-sm mx-auto space-y-2 shadow-sm">
        <span className="font-semibold uppercase text-morning-accent">
          {displayIntentions.length > 1 ? 'Your Morning Intentions' : 'Your Morning Intention'}
        </span>
        {displayIntentions.map((item, idx) => (
          <p key={item.toLowerCase()} className="text-on-surface font-medium italic flex items-baseline gap-2">
            {displayIntentions.length > 1 && (
              <span className="text-[9px] not-italic font-bold uppercase tracking-wider text-morning-accent shrink-0">{roleForIndex(idx)}</span>
            )}
            <span>"{item}"</span>
          </p>
        ))}
      </div>

      <div className="space-y-3 w-full">
        <button
          onClick={handleReturnHome}
          className={`w-full ${getJourneyPrimaryActionClasses('morning')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-morning-glow`}
        >
          <span>Continue to My Day</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>

      {/* "Explore More" discovery, Phase 5 — optional, secondary, and
          deliberately placed AFTER the primary Continue action above (per
          the approved placement rule: greeting -> Momentum -> primary
          action -> Explore) so it can never compete with or precede it.
          journey="morning" filters the Library to approved Morning-
          suitable content only (Morning/Stretching/Breathing categories
          plus meditation-eligible items, never an evening-only entry -
          see exploreFiltering.js's own documented rule). */}
      {/* Physical-iPhone correction — the supporting sentence removed
          (approved simplification, tightens the card automatically since
          ExploreCard's own space-y-1 wrapper only applies margin between
          actually-rendered siblings); title, CTA, route, origin, item
          count and accessibility label are all otherwise unchanged. */}
      <ExploreCard
        journey="morning"
        icon="explore"
        title="Have a little more time?"
        ctaLabel="Explore Morning"
        to="/library?journey=morning&from=morning-complete"
        itemCount={getMorningExploreCatalog().length}
      />
    </div>
  );
};


