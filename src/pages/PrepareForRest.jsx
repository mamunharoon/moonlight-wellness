/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { PrepareToggleRow } from '../components/evening/PrepareToggleRow';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { getCachedDurationMinutes } from '../lib/durationCache';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { ReviewModeBanner } from '../components/ReviewModeBanner';
import { useStepReviewMode } from '../session/useStepReviewMode';
import { useReviewNavigation } from '../session/useReviewNavigation';
import { getStepLabel } from '../lib/stepLabels';

/*
 * Phase 3 (Prepare for Rest subphase) — PrepareForRest
 *
 * Fifth (terminal-before-completion) step of the evening-wind-down
 * session. Redesigned from a static, non-interactive checklist + a long
 * permanently-visible video/Sleep Sounds list into four optional,
 * independently toggleable preparation actions plus a compact, collapsed
 * bedtime-guidance disclosure - matching the tap-first/collapsed-guidance
 * approach already approved for Reflection/Gratitude, adapted here for a
 * genuinely multi-select (never single-select) checklist, so the control
 * is a plain toggle button (PrepareToggleRow, aria-pressed), never a
 * radio (Reflection/Gratitude's AnswerOptionButton).
 *
 * CHECKLIST STATE - plain local React state only, deliberately
 *   Nothing about which preparation actions are toggled is written
 *   anywhere - no Supabase call, no localStorage, no new persistence
 *   layer, no completion event. This is a genuine, disclosed scope
 *   decision: the existing Session Engine/routineProgress.js model has
 *   no notion of "in-step checklist selections" at all, and wiring a new
 *   cross-remount store for it would mean touching SessionContext.jsx's
 *   resetSession/resetRoutine and AuthContext.jsx's signOut (the only
 *   existing places that clear routine-scoped local state) - genuinely
 *   shared infrastructure well outside this subphase's own scope ("this
 *   task covers only... Prepare for Rest"). Plain component state already
 *   satisfies every requirement that matters: selections survive opening
 *   and closing a guidance video (the modal is layered on this same
 *   mounted page, never a real navigation), toggling can never leak
 *   between users or carry a stale selection into a new day (there is
 *   nothing stored to leak or carry), and "Start over" trivially clears
 *   it (a fresh mount has no prior state to begin with). The one thing
 *   this does NOT do is survive a full Back-then-forward ROUND TRIP
 *   (leaving to Evening Breathing and actually returning unmounts and
 *   remounts this page) - disclosed here rather than silently claimed.
 *
 * advanceStep() is guarded exactly like every other Session-Engine-
 * consuming page in this codebase — see Reflection.jsx's own doc comment
 * for the full reasoning. sleepPreparation -> completion is immediately
 * adjacent, so advanceStep() (not advanceToStep) is correct here,
 * unchanged from before this subphase. `isAdvancing` guards against a
 * rapid double-tap firing this (and the one real completion event it
 * guards) twice before the resulting navigate() unmounts this page.
 *
 * GUIDANCE: E05 (Night-time Calm) and E30 (Peaceful Sleep) are the two
 * strongest, most literally sleep/night-specific matches in the real
 * catalogue (both a "Watch:" title AND description name sleep/night
 * directly) - shown first, expanded. E20 (Quieting the Mind) and E27
 * (Deep Relaxation) are real but more general relaxation content, and
 * SL01-08 (the existing real Sleep Sounds library) are a different kind
 * of content entirely (ambient sound, not a guided video) - both live
 * under the further-collapsed "More bedtime options" rather than
 * padding the initial two-item view. No id here is invented; every one
 * already existed on this exact page before this subphase.
 */
const INITIAL_GUIDANCE = [
  { id: 'E05', blurb: 'A short guided video to ease toward sleep.' },
  { id: 'E30', blurb: 'A guided video to ease you into peaceful sleep.' }
];

const MORE_GUIDANCE = [
  { id: 'E20', blurb: 'A guided video to quiet a busy mind before rest.' },
  { id: 'E27', blurb: 'A guided video for deep physical relaxation.' }
];

const SLEEP_SOUND_VIDEOS = [
  { id: 'SL01', blurb: 'Settle into the steady rhythm of gentle rain.' },
  { id: 'SL02', blurb: 'Rest with slow waves meeting a quiet shore.' },
  { id: 'SL03', blurb: 'Unwind among soft woodland sounds.' },
  { id: 'SL04', blurb: 'Relax beside the warmth of a gently crackling fire.' },
  { id: 'SL05', blurb: 'Drift off with a soft breeze across an open meadow.' },
  { id: 'SL06', blurb: 'A steady sound to soften surrounding distractions.' },
  { id: 'SL07', blurb: 'A balanced, gentle sound for restful sleep.' },
  { id: 'SL08', blurb: 'A deeper, softer sound for calm and focus.' }
];

// Safe, non-medical wording only - no nervous-system/melatonin/health
// claims, nothing presented as mandatory. All four remain fully optional.
const PREP_ITEMS = [
  { id: 'phone', icon: 'smartphone', title: 'Put your phone down soon.', support: "Place it face down when you're ready." },
  { id: 'water', icon: 'water_drop', title: 'Have a little water.', support: 'Take a small sip if you need one.' },
  { id: 'dim', icon: 'lightbulb', title: 'Dim the room.', support: 'Create a softer, quieter space.' },
  { id: 'finish', icon: 'nights_stay', title: 'Let the day finish.', support: 'Everything else can wait until tomorrow.' }
];

const buildGuidanceItem = ({ id, blurb }) => {
  const entry = getBetaVideoById(id);
  if (!entry) return null;
  const cachedMinutes = getCachedDurationMinutes(id);
  // "show cached/known duration only when accurate; otherwise omit
  // duration—never fabricate it" - unlike Reflection/Gratitude's own
  // guidance (which falls back to a plain "Guided video" label), this
  // subphase's own approved copy is to omit the badge entirely when no
  // real duration is known - BetaVideoRow already renders no badge at
  // all when `duration` is falsy.
  const duration = entry.durationLabel || (cachedMinutes ? `~${cachedMinutes} min` : undefined);
  return { id, entry, blurb, duration };
};

export const PrepareForRest = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceStep } = useSession();
  // Safe backward navigation ("Review Mode") - static content plus a
  // local-only checklist, no timer of its own - review-only, no repeat-
  // confirmation gate needed (see EveningWindDown.jsx's identical block).
  const { isReviewMode, isLiveStep } = useStepReviewMode('sleepPreparation', 'evening-wind-down');
  const { requestReview, routeForStep } = useReviewNavigation({ sessionId: 'evening-wind-down', isLiveStep, hasUnsavedProgress: false });
  const {
    openVideo,
    handleSelect,
    closeVideo,
    promptOpen,
    dismissPrompt,
    confirmSignIn,
    confirmCreateAccount
  } = useProtectedVideo();

  const [selectedPrep, setSelectedPrep] = useState(() => new Set());
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [moreGuidanceOpen, setMoreGuidanceOpen] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const togglePrep = (id) => {
    setSelectedPrep((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReadyForSleep = () => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    if (state.status === 'playing' && currentStep?.id === 'sleepPreparation') {
      advanceStep();
    }
    navigate('/evening-complete');
  };

  const initialGuidanceItems = INITIAL_GUIDANCE.map(buildGuidanceItem).filter(Boolean);
  const moreGuidanceItems = MORE_GUIDANCE.map(buildGuidanceItem).filter(Boolean);
  const sleepSoundItems = SLEEP_SOUND_VIDEOS.map(buildGuidanceItem).filter(Boolean);

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/evening-breathing">
      <ProgressIndicator activeStep="sleepPreparation" sessionId="evening-wind-down" onReviewStep={requestReview} />
      <span className="block text-center text-[10px] text-primary uppercase font-bold tracking-wider">Step 5 of 6</span>

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      <div className="flex-1 flex flex-col justify-center space-y-6">
        <div className="text-center space-y-1">
          <h1 className="font-serif italic text-3xl text-on-surface">Prepare for Rest</h1>
          <p className="text-xs text-on-surface-variant">Take a few simple steps to settle in for the night.</p>
        </div>

        <div className="space-y-3">
          {PREP_ITEMS.map((item) => (
            <PrepareToggleRow
              key={item.id}
              icon={item.icon}
              title={item.title}
              support={item.support}
              selected={selectedPrep.has(item.id)}
              onToggle={() => togglePrep(item.id)}
            />
          ))}
        </div>

        {initialGuidanceItems.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setGuidanceOpen((v) => !v)}
              aria-expanded={guidanceOpen}
              aria-controls="prepare-for-rest-guidance"
              className="w-full flex items-center justify-between gap-3 glass-panel rounded-2xl p-4 min-h-[44px] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="text-sm font-semibold text-on-surface">Would some bedtime guidance help?</span>
              <span
                className="material-symbols-outlined text-on-surface-variant transition-transform"
                style={{ transform: guidanceOpen ? 'rotate(180deg)' : 'none' }}
                aria-hidden="true"
              >
                expand_more
              </span>
            </button>
            {guidanceOpen && (
              <div id="prepare-for-rest-guidance" className="space-y-2">
                {initialGuidanceItems.map(({ id, entry, blurb, duration }) => (
                  <BetaVideoRow
                    key={id}
                    title={entry.title}
                    description={blurb}
                    duration={duration}
                    onClick={() => handleSelect(id)}
                  />
                ))}

                {(moreGuidanceItems.length > 0 || sleepSoundItems.length > 0) && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setMoreGuidanceOpen((v) => !v)}
                      aria-expanded={moreGuidanceOpen}
                      aria-controls="prepare-for-rest-more-guidance"
                      className="text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors px-1 min-h-[44px] flex items-center gap-1"
                    >
                      <span
                        className="material-symbols-outlined text-sm transition-transform"
                        style={{ transform: moreGuidanceOpen ? 'rotate(180deg)' : 'none' }}
                        aria-hidden="true"
                      >
                        expand_more
                      </span>
                      <span>More bedtime options</span>
                    </button>
                    {moreGuidanceOpen && (
                      <div id="prepare-for-rest-more-guidance" className="space-y-4">
                        <div className="space-y-2">
                          {moreGuidanceItems.map(({ id, entry, blurb, duration }) => (
                            <BetaVideoRow
                              key={id}
                              title={entry.title}
                              description={blurb}
                              duration={duration}
                              onClick={() => handleSelect(id)}
                            />
                          ))}
                        </div>
                        {sleepSoundItems.length > 0 && (
                          <div className="space-y-2">
                            <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Sleep Sounds</h3>
                            {sleepSoundItems.map(({ id, entry, blurb, duration }) => (
                              <BetaVideoRow
                                key={id}
                                title={entry.title}
                                description={blurb}
                                duration={duration}
                                onClick={() => handleSelect(id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {isReviewMode ? (
        currentStep && (
          <button
            onClick={() => navigate(routeForStep(currentStep.id))}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[56px]"
          >
            <span>Return to {getStepLabel(currentStep.id)}</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        )
      ) : (
        <button
          onClick={handleReadyForSleep}
          disabled={isAdvancing}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-70"
        >
          <span>Ready for Sleep</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      )}

      {/* Closing this leaves the user right here on Prepare for Rest —
          already "Evening Wind-down", no navigation needed for a return
          path - checklist selections (plain component state) are
          completely unaffected, since the modal is only ever layered on
          top of this same mounted page. */}
      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={closeVideo} />
      )}
      <SignInPromptDialog
        open={promptOpen}
        onSignIn={confirmSignIn}
        onCreateAccount={confirmCreateAccount}
        onDismiss={dismissPrompt}
      />
    </EveningSceneShell>
  );
};
