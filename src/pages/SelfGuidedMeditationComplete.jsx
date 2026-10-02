/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { resolveSelfGuidedMeditationContext } from '../lib/selfGuidedMeditationNav';
import { DEFAULT_MEDITATION_STYLE_ID, getMeditationStyleById } from '../lib/meditationStyles';
import { DEFAULT_MEDITATION_DURATION_ID, getMeditationDurationById } from '../lib/meditationDurations';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { usePracticeJourneyTone } from '../hooks/usePracticeJourneyTone';
import { clearPracticeJourneyTone, exitPracticeToHome } from '../lib/practiceJourneyContext';
import { getJourneyToneTokens } from '../lib/journeyTone';
import { OUTCOME, getOutcomeMessage, getCompletionGreeting } from '../lib/outcomeMessages';
import { useAlarm } from '../context/AlarmContext';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { CompletionReveal } from '../components/CompletionReveal';
import { resolveAnytimeOrigin } from '../lib/anytimeOrigin';
import { AnytimeClosingHandoff } from '../components/AnytimeClosingHandoff';

/*
 * Self-Guided Meditation — completion screen.
 *
 * Reached only via SelfGuidedMeditation.jsx's own natural-completion path
 * (router state, one-shot, not deep-linkable - same "no crash on refresh"
 * guarantee MeditationComplete.jsx already gives for the separate, existing
 * guided-video wizard). Never reached from an early End Session or a
 * mid-session Back/Close - those return directly to `context.fallback`
 * instead, since ending early is not a completion.
 *
 * Deliberately writes NO completion flag anywhere - no
 * getMeditationCompletionKey (that key belongs to the existing guided-video
 * wizard's own Home pill and must stay exactly as it is), no Morning/
 * Evening completion, nothing new. This feature has no persisted history at
 * all in this initial release, matching the explicit instruction not to
 * fabricate session history or completion data.
 */
export const SelfGuidedMeditationComplete = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = location.state || null;
  const context = resolveSelfGuidedMeditationContext(session?.from);
  // Anytime Visual Flow and Closing Handoff uplift (Part 11, entry-context
  // isolation) — the ONE explicit, validated marker this screen uses to
  // know it was genuinely reached through Anytime Reset's own "Or choose
  // another quick reset" - never the merely-cosmetic journeyTone (below),
  // which also resolves to 'anytime' for an unrelated reason (a Home-
  // direct Meditate tap, or a direct visit, during a plain midday
  // daypart fallback - see dayPartJourneyTone.js). Computed here, ahead
  // of every other value that depends on it.
  const { anytimeOrigin, anytimeResetDestination } = resolveAnytimeOrigin(session);

  // Context-aware Breathing/Meditation theming — reads back whatever
  // SelfGuidedMeditation.jsx's own setup screen already captured for
  // this same practice (see usePracticeJourneyTone.js's own
  // capture/read-back shape) - never re-resolved from a fresh Home tap
  // or a possibly-different daypart, since no explicit journeyTone is
  // threaded through this specific navigate() call.
  const journeyTone = usePracticeJourneyTone();
  const { effectiveTimezone } = useAlarm();

  // Outcome-aware messaging correction — this genuine-natural-completion-
  // only screen (per this file's own doc comment) previously showed a
  // fixed, hand-written "Meditation complete" / "Take this steadiness
  // with you." regardless of journey, never rotating and never reusing
  // the same Phase 2 outcome model this app's other completion screens
  // (SessionComplete.jsx/EveningComplete.jsx/MeditationComplete.jsx) all
  // already share. journeyTone always resolves to a real JOURNEY value
  // (morning/anytime/evening - see usePracticeJourneyTone.js's own
  // fallback chain), so this is a direct, safe reuse rather than a
  // guess.
  //
  // Anytime Meditation completion correction — genuinely reached through
  // Anytime Reset (Part 11: anytimeOrigin, not the merely-cosmetic
  // journeyTone) now uses the same shared getCompletionGreeting({journey,
  // practice}) architecture as every other Morning/Evening/Anytime
  // completion panel this pass and the two before it added, instead of
  // the older per-calendar-day getOutcomeMessage headline/body pair. A
  // direct/Home-launched visit (not anytimeOrigin) keeps the original
  // getOutcomeMessage rotation completely unchanged - "existing direct
  // completion behaviour," matching QuietBreathing.jsx's own identical
  // gate.
  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;
  const { headline: completionHeadline, body: completionBody } = getOutcomeMessage(OUTCOME.COMPLETED, journeyTone, today);
  // Picked exactly once (lazy useState initializer - getCompletionGreeting
  // has real side effects: localStorage read/write + Math.random - never
  // safe to call on every render) and held stable for as long as this
  // screen stays mounted.
  const [completionGreeting] = useState(() => (anytimeOrigin ? getCompletionGreeting({ journey: 'anytime', practice: 'reset' }) : null));

  const style = getMeditationStyleById(session?.styleId) || getMeditationStyleById(DEFAULT_MEDITATION_STYLE_ID);
  const duration = getMeditationDurationById(session?.durationId) || getMeditationDurationById(DEFAULT_MEDITATION_DURATION_ID);

  const handleDone = () => {
    // Context-aware Breathing/Meditation theming — natural completion is
    // a real exit-to-Home; the centralized helper clears the captured
    // context before navigating, so a later, unrelated practice launch
    // never inherits this finished practice's colour.
    exitPracticeToHome(navigate, context.fallback);
  };

  // Anytime Visual Flow and Closing Handoff uplift (Part 9) — a practice
  // reached through Anytime Reset's own quick-reset context (anytimeOrigin,
  // computed above) gets the shared two-action AnytimeClosingHandoff
  // (Continue My Day / Choose Another Reset) instead of the generic Done/
  // Meditate Again/Choose Another Meditation trio. WakeWise DEV —
  // simplified Anytime completion panel: "Explore More" was removed from
  // this panel entirely; Library/Explore access elsewhere in the app is
  // unaffected. Reached any other way (Home/Library's own Meditate tiles),
  // anytimeOrigin is false and this screen is completely unchanged.
  // WakeWise DEV — Anytime Back-navigation correction: this screen's own
  // top-left Back (there is no earlier in-flow step on the completion
  // screen itself) now returns to the preserved Anytime Reset
  // recommendation - via the explicit anytimeOrigin marker, never
  // journeyTone/browser history - instead of falling through past it to
  // context.fallback (Home), when it was genuinely reached that way.
  const backDestination = anytimeOrigin ? anytimeResetDestination : context.fallback;
  const handleChooseAnotherQuickReset = () => {
    exitPracticeToHome(navigate, anytimeResetDestination);
  };
  const handleContinueMyDay = () => {
    exitPracticeToHome(navigate, '/');
  };

  // Both restore the exact same style/duration/sound choices and land back
  // on setup - only the label differs. Neither auto-starts: Begin Meditation
  // still requires its own fresh, deliberate tap either way. `soundId` here
  // is whatever was actually active at completion (SelfGuidedMeditation.jsx
  // reads it from the live snapshot, never a stale value) - the setup
  // screen's own `isValidMeditationSoundId` check falls back to the
  // selected style's suggested default if it's ever missing/invalid, and
  // treats a valid restored value as an explicit choice (never overridden
  // by a later style change).
  const handleMeditateAgain = () => {
    navigate(`/self-guided-meditation${session?.from ? `?from=${session.from}` : ''}`, {
      state: { styleId: style.id, durationId: duration.id, soundId: session?.soundId }
    });
  };

  const handleChooseAnotherMeditation = () => {
    navigate(`/self-guided-meditation${session?.from ? `?from=${session.from}` : ''}`, {
      state: { styleId: style.id, durationId: duration.id, soundId: session?.soundId }
    });
  };

  return (
    // Physical-iPhone TestFlight report — status-bar overlap fix. See
    // IntentionSetup.jsx's/Affirmation.jsx's identical block for the full
    // rationale: the old min-height-percentage-of-viewport wrapper was
    // only ever a floor, never a real scroll owner, so this screen now
    // owns the same proven h-dvh/overflow-y-auto scroll container instead,
    // with `min-h-full` replacing that old floor and the flat,
    // safe-area-unaware `pb-6` now a genuine `paddingBottom` calc(). The
    // internal justify-between/space-y-10 layout is completely untouched.
    <div className="h-dvh overflow-hidden">
    <div className="h-full w-full overflow-y-auto overflow-x-hidden scroll-hide" style={{ overscrollBehaviorY: 'contain' }}>
    <div
      className="min-h-full flex flex-col justify-between max-w-md mx-auto space-y-10"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))'
      }}
    >
      <div className="flex items-center gap-3">
        {/* Context-aware Breathing/Meditation theming — this screen's own
            Back always exits to Home too (there is no earlier in-flow
            step on the completion screen itself) - clears the captured
            tone before BackButton's own navigation proceeds. */}
        <BackButton
          fallback={backDestination}
          label={context.label}
          guardActiveRoute={false}
          // WakeWise DEV — Anytime Back-navigation correction: without
          // this, goBack() would silently prefer a real navigate(-1) over
          // backDestination whenever this app instance's in-app history
          // has more than one entry - discarding the preserved Anytime
          // Reset recommendation in favour of its bare, state-less
          // previous history entry. Forced straight to backDestination
          // only when anytimeOrigin; reached any other way, goBack's
          // normal "prefer the real previous screen" behaviour (here,
          // always Home - there is no earlier in-flow step on the
          // completion screen itself) is completely unchanged.
          alwaysFallback={anytimeOrigin}
          onBeforeLeave={() => {
            clearPracticeJourneyTone();
          }}
        />
      </div>

      {/* "Your Momentum" foundation, Phase 3 — the shared completion-
          reveal transition. This screen is always-rendered (reached only
          via SelfGuidedMeditation.jsx's own natural-completion router
          state per this file's own top-of-file doc comment), so `active`
          is unconditionally true from the very first render -
          CompletionReveal's auto-freshness detection can't distinguish
          "genuine" from "a direct/stale URL revisit" for a screen like
          that (see its own doc comment), so isFresh is passed explicitly:
          `session` (location.state) is only ever present for a genuine
          natural completion just now, never for a direct/stale visit -
          the exact same one-shot signal this file's own `session && (...)`
          detail-card guard already relies on below. */}
      {anytimeOrigin ? (
        // Anytime Visual Flow and Closing Handoff uplift (Part 9) — the
        // one shared closing presentation, replacing this screen's own
        // former hand-rolled mint badge/eyebrow/greeting/actions block.
        // The style+duration detail card is preserved as the handoff's
        // own optional `detail` slot - real, useful, factual information
        // this pass's brief never asked to remove.
        <AnytimeClosingHandoff
          active
          isFresh={Boolean(session)}
          greeting={completionGreeting}
          detail={
            <div className="glass-panel rounded-2xl p-5 space-y-1 text-left max-w-xs mx-auto">
              <p className="text-xs text-tertiary font-bold uppercase tracking-wider">{style.label}</p>
              <p className="text-xs text-on-surface-variant">{duration.label}</p>
            </div>
          }
          onContinueMyDay={handleContinueMyDay}
          onChooseAnotherReset={handleChooseAnotherQuickReset}
        />
      ) : (
        <>
          <CompletionReveal
            active
            isFresh={Boolean(session)}
            journeyTone={journeyTone}
            className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
            stagger={[
              <span key="badge" className={`material-symbols-outlined ${getJourneyToneTokens(journeyTone).text} text-4xl`} aria-hidden="true">self_improvement</span>,
              <div key="greeting" className="space-y-2">
                <h1 className="font-serif italic text-3xl text-on-surface" role="status">{completionHeadline}</h1>
                <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">{completionBody}</p>
              </div>,
              session ? (
                <div key="session-detail" className="glass-panel rounded-2xl p-5 space-y-1 text-left max-w-xs mx-auto">
                  <p className={`text-xs ${getJourneyToneTokens(journeyTone).text} font-bold uppercase tracking-wider`}>{style.label}</p>
                  <p className="text-xs text-on-surface-variant">{duration.label}</p>
                </div>
              ) : null
            ].filter(Boolean)}
          />

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleDone}
              className={`w-full ${getJourneyPrimaryActionClasses(journeyTone)} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
            >
              <span>Done</span>
              <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
            </button>
            <button
              type="button"
              onClick={handleMeditateAgain}
              className="w-full glass-panel text-on-surface py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
            >
              Meditate Again
            </button>
            <button
              type="button"
              onClick={handleChooseAnotherMeditation}
              className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
            >
              Choose Another Meditation
            </button>
          </div>
        </>
      )}
    </div>
    </div>
    </div>
  );
};
