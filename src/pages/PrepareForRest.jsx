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
 * session. Four optional, independently toggleable preparation actions
 * (PrepareToggleRow - a real switch, role="switch"/aria-checked, never a
 * radio) plus a bedtime-content section that is DISCOVERABLE (expanded by
 * default, explicit "video or sleep sound" heading) rather than a vague
 * collapsed "guidance" row a user might bypass without understanding what
 * it offers.
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
 *   satisfies every requirement that matters: switches survive opening
 *   and closing a video/sound (the modal is layered on this same mounted
 *   page, never a real navigation), toggling can never leak between
 *   users or carry a stale selection into a new day (there is nothing
 *   stored to leak or carry), and "Start over" trivially clears it (a
 *   fresh mount has no prior state to begin with). The one thing this
 *   does NOT do is survive a full Back-then-forward ROUND TRIP (leaving
 *   to Evening Breathing and actually returning unmounts and remounts
 *   this page) - disclosed here rather than silently claimed.
 *
 * advanceStep() is guarded exactly like every other Session-Engine-
 * consuming page in this codebase — see Reflection.jsx's own doc comment
 * for the full reasoning. sleepPreparation -> completion is immediately
 * adjacent, so advanceStep() (not advanceToStep) is correct here.
 * `isAdvancing` guards against a rapid double-tap firing this (and the
 * one real completion event it guards) twice before the resulting
 * navigate() unmounts this page.
 *
 * FEATURED GUIDANCE (round 2 correction): exactly one guided video (E05,
 * "Night-time Calm" - the strongest, most literally sleep/night-specific
 * real video) and one real Sleep Sound (SL01, "Rain" - this library's own
 * first/flagship item) are shown immediately, expanded by default, each
 * explicitly labelled by content type ("Guided video"/"Sleep sound") so
 * a user understands what's on offer without an extra tap. "More bedtime
 * options" (E20/E27/E30 plus the remaining SL02-08) is its own, separately
 * collapsed disclosure directly below the featured pair - Build 15
 * Evening UX correction moved it ABOVE Ready for Sleep (previously
 * below), so a user who wants to keep browsing sees the full library
 * before the exit action, not after it. Neither featured id is
 * duplicated inside More options.
 */
const FEATURED_GUIDANCE = [
  { id: 'E05', kind: 'Guided video', blurb: 'A short guided video to ease toward sleep.' },
  { id: 'SL01', kind: 'Sleep sound', blurb: 'Settle into the steady rhythm of gentle rain.' }
];

const MORE_GUIDANCE = [
  { id: 'E30', blurb: 'A guided video to ease you into peaceful sleep.' },
  { id: 'E20', blurb: 'A guided video to quiet a busy mind before rest.' },
  { id: 'E27', blurb: 'A guided video for deep physical relaxation.' }
];

// SL01 is featured above - not repeated here.
const MORE_SLEEP_SOUNDS = [
  { id: 'SL02', blurb: 'Rest with slow waves meeting a quiet shore.' },
  { id: 'SL03', blurb: 'Unwind among soft woodland sounds.' },
  { id: 'SL04', blurb: 'Relax beside the warmth of a gently crackling fire.' },
  { id: 'SL05', blurb: 'Drift off with a soft breeze across an open meadow.' },
  { id: 'SL06', blurb: 'A steady sound to soften surrounding distractions.' },
  { id: 'SL07', blurb: 'A balanced, gentle sound for restful sleep.' },
  { id: 'SL08', blurb: 'A deeper, softer sound for calm and focus.' },
  { id: 'SL09', blurb: 'Settle with gentle birdsong in a peaceful natural setting.' },
  { id: 'SL10', blurb: 'Unwind with soft rustling leaves and gentle piano.' }
];

// Safe, non-medical wording only - no nervous-system/melatonin/health
// claims, nothing presented as mandatory. All four remain fully optional.
const PREP_ITEMS = [
  { id: 'phone', icon: 'smartphone', title: 'Put your phone down soon.', support: "Place it face down when you're ready." },
  { id: 'water', icon: 'water_drop', title: 'Have a little water.', support: 'Take a small sip if you need one.' },
  { id: 'dim', icon: 'lightbulb', title: 'Dim the room.', support: 'Create a softer, quieter space.' },
  { id: 'finish', icon: 'nights_stay', title: 'Let the day finish.', support: 'Everything else can wait until tomorrow.' }
];

const buildGuidanceItem = ({ id, blurb, kind }) => {
  const entry = getBetaVideoById(id);
  if (!entry) return null;
  const cachedMinutes = getCachedDurationMinutes(id);
  // "show cached/known duration only when accurate; otherwise omit
  // duration—never fabricate it" - BetaVideoRow already renders no badge
  // at all when `duration` is falsy.
  const duration = entry.durationLabel || (cachedMinutes ? `~${cachedMinutes} min` : undefined);
  return { id, entry, blurb, duration, kind };
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
  // Expanded by default (round 2 correction) - discoverability, not a
  // hidden extra tap, is the whole point of this fix.
  const [guidanceOpen, setGuidanceOpen] = useState(true);
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

  const featuredItems = FEATURED_GUIDANCE.map(buildGuidanceItem).filter(Boolean);
  const moreGuidanceItems = MORE_GUIDANCE.map(buildGuidanceItem).filter(Boolean);
  const moreSleepSoundItems = MORE_SLEEP_SOUNDS.map(buildGuidanceItem).filter(Boolean);

  const primaryAction = isReviewMode ? (
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
  );

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/evening-breathing" showExit>
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

        {featuredItems.length > 0 && (
          <div className="space-y-3">
            {/* Evening selectable-control visual refinement (Build 15):
                same deep surface-container background as the toggle rows
                above, but a neutral white/15 border (not periwinkle) -
                this disclosure must stay recognisably different from the
                switches, not just visually coordinated with them. */}
            <button
              type="button"
              onClick={() => setGuidanceOpen((v) => !v)}
              aria-expanded={guidanceOpen}
              aria-controls="prepare-for-rest-guidance"
              className="w-full flex items-center justify-between gap-3 bg-surface-container border border-white/15 rounded-2xl p-4 min-h-[44px] hover:bg-white/10 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="text-sm font-semibold text-on-surface text-left">Choose a bedtime video or sleep sound</span>
              <span
                className="material-symbols-outlined text-on-surface-variant transition-transform shrink-0"
                style={{ transform: guidanceOpen ? 'rotate(180deg)' : 'none' }}
                aria-hidden="true"
              >
                expand_more
              </span>
            </button>
            {guidanceOpen && (
              <div id="prepare-for-rest-guidance" className="space-y-3">
                <p className="text-xs text-on-surface-variant px-1">Optional — play something calming, or continue when you're ready.</p>
                {featuredItems.map(({ id, entry, blurb, duration, kind }) => (
                  <div key={id} className="space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 px-1">{kind}</span>
                    <BetaVideoRow title={entry.title} description={blurb} duration={duration} onClick={() => handleSelect(id)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Build 15 Evening UX correction — "More bedtime options" moved
            above "Ready for Sleep" (was previously below it), so a user
            browsing the full bedtime content library sees Ready for Sleep
            only after they've seen everything on offer, not before it.
            The disclosure itself is unchanged: still collapsed by
            default, still a plain aria-expanded/aria-controls button that
            never navigates on its own — only repositioned. */}
        {(moreGuidanceItems.length > 0 || moreSleepSoundItems.length > 0) && (
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
                {moreGuidanceItems.length > 0 && (
                  <div className="space-y-2">
                    {moreGuidanceItems.map(({ id, entry, blurb, duration }) => (
                      <BetaVideoRow key={id} title={entry.title} description={blurb} duration={duration} onClick={() => handleSelect(id)} />
                    ))}
                  </div>
                )}
                {moreSleepSoundItems.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Sleep Sounds</h3>
                    {moreSleepSoundItems.map(({ id, entry, blurb, duration }) => (
                      <BetaVideoRow key={id} title={entry.title} description={blurb} duration={duration} onClick={() => handleSelect(id)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {primaryAction}
      </div>

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
