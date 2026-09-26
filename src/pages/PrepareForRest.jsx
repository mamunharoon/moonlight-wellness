/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { useAlarm } from '../context/AlarmContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { PrepareToggleRow } from '../components/evening/PrepareToggleRow';
import { BedtimeMediaChooser } from '../components/evening/BedtimeMediaChooser';
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
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { loadEveningPrepareSelection, saveEveningPrepareSelection, clearEveningPrepareSelection } from '../lib/eveningPrepareSelection';

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
 * CHECKLIST STATE - WakeWise Phase 1 correction
 *   Previously plain local React state only, which reset on any full
 *   unmount/remount - including the ordinary case of reviewing an earlier
 *   Evening step (Back to Evening Breathing/Meditate) and returning here.
 *   Now backed by eveningPrepareSelection.js, mirroring
 *   eveningBreathingSelection.js's own already-approved "tonight's
 *   selection" convention exactly: a userId-scoped localStorage key,
 *   validated against today's local date so a value from a prior night is
 *   never silently reused - no Supabase migration, no new persistence
 *   architecture, reusing the one mechanism this Evening journey already
 *   has for exactly this "survives leaving and coming back, but is not a
 *   completed step" shape. Still never written as a Session Engine step
 *   completion or a routine_responses row - toggling a preparation item
 *   is not "answering a prompt" and must never be conflated with one.
 *   Cleared on: reaching /evening-complete (handleReadyForSleep below),
 *   and Redo Tonight's Wind-Down (redoEveningWindDown in
 *   routineResponses.js) - both genuine "this specific tonight is over"
 *   moments. Scoped by userId exactly like the breathing-pattern
 *   selection, so it can never leak between two different signed-in
 *   users, and a guest's own key is the separate unscoped base key (the
 *   same accepted device-shared guest policy already used for completion
 *   flags) - a user who signs out mid-journey and continues as a guest
 *   reads that different key, never their own prior selection.
 *
 * advanceStep() is guarded exactly like every other Session-Engine-
 * consuming page in this codebase — see Reflection.jsx's own doc comment
 * for the full reasoning. sleepPreparation -> completion is immediately
 * adjacent, so advanceStep() (not advanceToStep) is correct here.
 * `isAdvancing` guards against a rapid double-tap firing this (and the
 * one real completion event it guards) twice before the resulting
 * navigate() unmounts this page.
 *
 * BEDTIME MEDIA (Build 16 physical-iPhone correction, F10) — previously
 * one "featured" video/sound pair rendered expanded by default in-page,
 * with the rest of the real 4-video/10-sound catalogue hidden behind a
 * second "More bedtime options" disclosure directly below it - found
 * live: expanding it made this screen substantially longer, pushing the
 * preparation checklist and Ready for Sleep off-screen together with the
 * whole catalogue on one page. Both lists below are now the SAME two
 * flat, complete catalogues (every real id, every original blurb,
 * verbatim - nothing removed, nothing newly added), but consumed
 * differently: this screen itself shows only a compact chooser control
 * (or, once something is chosen, a compact one-row summary) - the full
 * lists only ever render inside the separate BedtimeMediaChooser overlay
 * (see that component's own doc comment), which owns its own independent
 * scroll.
 */
const GUIDED_VIDEOS = [
  { id: 'E05', blurb: 'A short guided video to ease toward sleep.' },
  { id: 'E30', blurb: 'A guided video to ease you into peaceful sleep.' },
  { id: 'E20', blurb: 'A guided video to quiet a busy mind before rest.' },
  { id: 'E27', blurb: 'A guided video for deep physical relaxation.' }
];

const SLEEP_SOUNDS = [
  { id: 'SL01', blurb: 'Settle into the steady rhythm of gentle rain.' },
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

const buildGuidanceItem = ({ id, blurb }) => {
  const entry = getBetaVideoById(id);
  if (!entry) return null;
  const cachedMinutes = getCachedDurationMinutes(id);
  // "show cached/known duration only when accurate; otherwise omit
  // duration—never fabricate it" - BetaVideoRow already renders no badge
  // at all when `duration` is falsy.
  const duration = entry.durationLabel || (cachedMinutes ? `~${cachedMinutes} min` : undefined);
  return { id, entry, blurb, duration };
};

export const PrepareForRest = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceStep } = useSession();
  const { effectiveTimezone, userId } = useAlarm();
  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;
  // Safe backward navigation ("Review Mode") - static content plus a
  // checklist backed by eveningPrepareSelection.js, no timer of its own -
  // review-only, no repeat-confirmation gate needed (see
  // EveningWindDown.jsx's identical block).
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

  // WakeWise Phase 1 correction — seeded from tonight's persisted
  // selection (see this file's own CHECKLIST STATE doc comment above),
  // falling back to an empty checklist/no bedtime choice exactly like a
  // genuinely fresh first visit. `savedSelection` is read once at mount
  // (a fresh mount is exactly when a stale value would otherwise need
  // reconciling) rather than re-read on every render.
  const [savedSelection] = useState(() => loadEveningPrepareSelection(userId, today));
  const [selectedPrep, setSelectedPrep] = useState(() => new Set(savedSelection?.prepIds ?? []));
  // Build 16 physical-iPhone correction (F10) — the chosen bedtime item
  // (if any) and whether the full-catalogue chooser overlay is open.
  // `selectedBedtimeId` is persisted (see CHECKLIST STATE doc comment);
  // `chooserOpen` (just whether the overlay is currently showing) is
  // deliberately left as plain, non-persisted UI state - a remount
  // reasonably reopens to the compact summary/button, not a re-opened
  // overlay.
  const [selectedBedtimeId, setSelectedBedtimeId] = useState(() => savedSelection?.bedtimeId ?? null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  // WakeWise Phase 1 correction — the one place both persisted fields are
  // written together, so a save can never capture one field's new value
  // alongside the other's stale one.
  const persistSelection = (nextPrepIds, nextBedtimeId) => {
    saveEveningPrepareSelection(userId, { prepIds: nextPrepIds, bedtimeId: nextBedtimeId }, today);
  };

  const togglePrep = (id) => {
    setSelectedPrep((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistSelection([...next], selectedBedtimeId);
      return next;
    });
  };

  const handleReadyForSleep = () => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    if (state.status === 'playing' && currentStep?.id === 'sleepPreparation') {
      advanceStep();
    }
    // WakeWise Phase 1 correction — tonight's checklist/bedtime selection
    // is temporary working state for THIS run of Prepare for Rest, not a
    // journey answer to keep around - clear it the moment the journey
    // actually completes, mirroring redoEveningWindDown's identical clear
    // on a deliberate Redo/Start Over.
    clearEveningPrepareSelection(userId);
    navigate('/evening-complete');
  };

  const guidedVideoItems = GUIDED_VIDEOS.map(buildGuidanceItem).filter(Boolean);
  const sleepSoundItems = SLEEP_SOUNDS.map(buildGuidanceItem).filter(Boolean);

  // Build 16 physical-iPhone correction (F10) — the chooser overlay only
  // ever SELECTS (never plays); this compact summary card is what
  // actually plays a selection, via the same handleSelect(id) every
  // BetaVideoRow tap in this app already uses.
  const handleChooseBedtimeMedia = (id) => {
    setSelectedBedtimeId(id);
    setChooserOpen(false);
    persistSelection([...selectedPrep], id);
  };
  const selectedBedtimeItem = selectedBedtimeId
    ? [...guidedVideoItems, ...sleepSoundItems].find((item) => item.id === selectedBedtimeId) ?? null
    : null;
  const selectedBedtimeIsSound = selectedBedtimeId ? sleepSoundItems.some((item) => item.id === selectedBedtimeId) : false;

  // Duplicate-return-action fix, found live: the ReviewModeBanner below
  // already renders its own "Return to X" whenever isReviewMode is true -
  // primaryAction rendered an identical second one. null while reviewing;
  // the banner covers it.
  const primaryAction = isReviewMode ? null : (
    <button
      onClick={handleReadyForSleep}
      disabled={isAdvancing}
      className={`w-full ${getJourneyPrimaryActionClasses('evening')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-70`}
    >
      <span>Ready for Sleep</span>
      <span className="material-symbols-outlined text-sm">arrow_forward</span>
    </button>
  );

  // Journey Embedding — Meditation is now the real preceding step
  // (Breathing -> Meditate (optional) -> Prepare for Rest), so Back must
  // return there, not skip over it straight to Evening Breathing.
  //
  // Build 16 physical-iPhone correction (F10) — BedtimeMediaChooser
  // renders as a genuine SIBLING of EveningSceneShell (outside its
  // children), not nested inside it - see that component's own doc
  // comment for the real, live-reproduced z-index stacking-context bug
  // this avoids (its own Close button was silently unclickable, blocked
  // by the shell's own nav row one stacking context up).
  return (
    <>
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/evening-meditate" showExit>
      {/* Build 16 physical-iPhone correction (F9) — see Gratitude.jsx's
          identical fix for the full rationale (ProgressIndicator's own
          mobile compact block already shows "Step 6 of 7"). */}
      <ProgressIndicator activeStep="sleepPreparation" sessionId="evening-wind-down" onReviewStep={requestReview} />

      {isReviewMode && currentStep && (
        <ReviewModeBanner currentStepLabel={getStepLabel(currentStep.id)} onReturnToCurrentStep={() => navigate(routeForStep(currentStep.id))} />
      )}

      {/* Decision 3 acceptance correction — space-y-6 -> space-y-5 on this
          outer stack, and space-y-3 -> space-y-2 on the checklist below:
          two further modest gap trims (combined with PrepareToggleRow.jsx's
          own py-4 -> py-3) to give Ready for Sleep a comfortable, non-
          fragile margin within the 390x844/393x852 viewport rather than a
          borderline few-pixel fit. */}
      <div className="flex-1 flex flex-col justify-center space-y-5">
        <div className="text-center space-y-1">
          <h1 className="font-serif italic text-3xl text-on-surface">Prepare for Rest</h1>
          <p className="text-xs text-on-surface-variant">Take a few simple steps to settle in for the night.</p>
        </div>

        <div className="space-y-2">
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

        {/* Build 16 physical-iPhone correction (F10) — one compact control
            replaces the old always-here, always-expanded catalogue: a
            single chooser button when nothing is selected yet, or a
            one-row summary (tap to play, via the same established
            BetaVideoRow tap-to-play behaviour every other guidance row in
            this app already uses) plus a small "Change selection" control
            once something is. Browsing the full 4-video/10-sound
            catalogue itself only ever happens in the separate
            BedtimeMediaChooser overlay below - never on this screen. */}
        {selectedBedtimeItem ? (
          <div className="space-y-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 px-1">
              {selectedBedtimeIsSound ? 'Sleep sound' : 'Guided video'} selected
            </span>
            <BetaVideoRow
              title={selectedBedtimeItem.entry.title}
              description={selectedBedtimeItem.blurb}
              duration={selectedBedtimeItem.duration}
              onClick={() => handleSelect(selectedBedtimeId)}
            />
            <button
              type="button"
              onClick={() => setChooserOpen(true)}
              className="text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors px-1 min-h-[44px] flex items-center gap-1"
            >
              Change selection
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setChooserOpen(true)}
            aria-haspopup="dialog"
            className="w-full flex items-center justify-between gap-3 bg-surface-container border border-white/15 rounded-2xl p-4 min-h-[44px] hover:bg-white/10 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="text-sm font-semibold text-on-surface text-left">Choose a bedtime video or sleep sound</span>
            <span className="material-symbols-outlined text-on-surface-variant shrink-0" aria-hidden="true">chevron_right</span>
          </button>
        )}

        {primaryAction}
      </div>

      {/* Closing this leaves the user right here on Prepare for Rest —
          already "Evening Wind-down", no navigation needed for a return
          path - checklist/bedtime selections are unaffected either way,
          since the modal is only ever layered on top of this same mounted
          page (and are now persisted via eveningPrepareSelection.js
          regardless, so even a real navigation away and back survives). */}
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
    {chooserOpen && (
      <BedtimeMediaChooser
        videos={guidedVideoItems}
        sounds={sleepSoundItems}
        onSelect={handleChooseBedtimeMedia}
        onClose={() => setChooserOpen(false)}
      />
    )}
    </>
  );
};
