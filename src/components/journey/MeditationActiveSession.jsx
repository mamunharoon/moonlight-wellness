/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { JourneyHeader } from './JourneyHeader';
import { ConfirmDialog } from '../ConfirmDialog';
import { MeditationProgressRing } from '../MeditationProgressRing';
import { MEDITATION_SOUNDS } from '../../lib/meditationSounds';
import { MeditationOptionRow } from './MeditationControls';

/*
 * WakeWise — Journey Embedding (Self-Guided Meditation) — shared active-
 * session screen, extracted from SelfGuidedMeditation.jsx's own
 * active-phase JSX. Renders the ring/prompt/Pause-Resume/sound row/End
 * button, owns its own leave-confirmation dialog, and NEVER navigates
 * itself - `onRequestLeave` is called at the exact moment the original
 * inline `navigate(...)` calls fired (mid-session Back/Close/End), letting
 * each caller (standalone vs. Morning-embedded vs. Evening-embedded)
 * decide what "leaving" actually means for it.
 *
 * `endCopy` (additive, defaults reproduce standalone's own existing
 * wording exactly): lets Morning/Evening embedded callers swap in their
 * own "End Meditation" / "End this meditation?" / "Keep Meditating" copy
 * without touching, or risking drift in, standalone's unchanged strings.
 *
 * `showHeaderClose` (additive, default true - standalone and Evening's
 * caller each have their own reason to touch it, Morning does not):
 * Evening's embedded caller passes `false` because it wraps this
 * component in EveningSceneShell with its OWN `showExit`
 * (ExitEveningButton) already visible at the same top-right corner -
 * rendering this component's own header Close there too produced two
 * overlapping controls with two different meanings (found live).
 * Suppressing only the Close button, never the Back arrow - the one
 * whole-journey exit for Evening stays exclusively EveningSceneShell's
 * own ExitEveningButton, positioned outside this component entirely.
 *
 * `onRequestClose` (additive, optional - standalone and Evening both omit
 * it and are unaffected): distinct from `onStepBack`/the big End-
 * Meditation button, both of which ALWAYS mean "end only this meditation"
 * and open this component's own local confirm dialog. Morning's active
 * screen has no wrapping shell to host a separate whole-journey exit
 * control the way Evening's does (found live: Morning's Back and Close
 * both silently meant "end meditation," leaving no way to exit the whole
 * Morning routine while meditation was active) - `onRequestClose` gives
 * Morning's Close/X a genuinely different action instead: when provided,
 * tapping Close calls it directly, bypassing this component's own local
 * dialog entirely, so the CALLER (MorningMeditate.jsx) owns what
 * "closing" means and shows its own separate "Leave this routine?"
 * confirmation using the existing whole-routine leave mechanism. When
 * omitted (standalone, Evening-with-Close-hidden), Close falls back to
 * the same local dialog Back already opens - byte-identical to before
 * this prop existed.
 *
 * `bottomAction` (Morning journey UX correction, additive - default null,
 * every existing caller (standalone, Evening) omits it and is completely
 * unaffected): the header's own Back arrow ALWAYS keeps meaning "end only
 * this meditation" via `copy`/`onRequestLeave`/the local dialog above,
 * regardless of this prop - never touched. When `bottomAction` is provided,
 * it REPLACES the bottom big button (which otherwise also opens that same
 * local "end meditation" dialog) with a second, genuinely distinct action
 * and its own dialog: shape `{ buttonLabel, buttonAriaLabel, dialogTitle,
 * dialogMessage, confirmLabel, cancelLabel, onConfirm }`. Morning uses this
 * for "Finish & continue" (its own "Finish meditation?" dialog, confirming
 * stops the timer/audio and advances straight to Affirmation) - found live:
 * the bottom button and the header Back arrow previously both opened the
 * exact same "End this meditation?" dialog, both always landing back on
 * Meditation setup with no way to finish-and-move-on from the active
 * screen itself, forcing "End Meditation -> setup -> Skip meditation."
 *
 * `onChooseAnother` (Morning/Evening journey meditation-selection fix,
 * additive - default null, standalone and every other existing caller
 * omits it and is completely unaffected): the active screen only ever
 * offered a sound choice (Gentle Ambient/Soft Piano/No Music) - there was
 * no visible way to switch to a different meditation STYLE or DURATION
 * once running, short of Back's "End this meditation?" (which returns to
 * the compact setup card, still requiring another tap on "Choose style,
 * time & sound"). When provided, renders a third, clearly distinct
 * secondary button ("Choose another meditation") below the primary bottom
 * action, with its own "Change meditation?" confirmation - explicitly
 * about CHANGING the meditation, never confused with Back's "end this
 * session" framing or bottomAction's "finish and continue" framing.
 * Confirming calls `onChooseAnother()` directly (the caller decides what
 * "choosing another" means - Morning/Evening end the session and reopen
 * their own setup panel already expanded to the full style/duration/sound
 * picker, never navigating Home/standalone/a later step).
 *
 * `onEndSession` (additive, optional - default null, every existing caller
 * before this fix omits it and falls back to the original behaviour):
 * found live that the bottom "End Session" button and the header Back
 * arrow were wired to the exact same state (`leaveConfirmOpen`) and the
 * exact same confirm handler (`onRequestLeave`) - two visibly separate
 * controls that were actually one control in two places, both silently
 * returning to setup with no distinct outcome. When provided, the bottom
 * button gets its OWN confirm dialog (`endSessionConfirmOpen`, same copy
 * as Back's - ending "this meditation" means the same thing regardless of
 * which control asked) and its OWN confirm handler (`onEndSession`,
 * independent of `onRequestLeave`), so a caller can give the two controls
 * genuinely different results (standalone: Back returns straight to
 * setup, End Session shows a truthful "ended early" result first). When
 * omitted, the bottom button falls back to `setLeaveConfirmOpen(true)` -
 * byte-identical to before this prop existed.
 *
 * `endSessionCopy` (additive, optional, default null - F4 pre-Build-15
 * usability pass): found live that Back's dialog and End Session's own
 * dialog, despite being genuinely separate controls after the
 * `onEndSession` fix above, still showed IDENTICAL wording (both reused
 * `copy`, derived from `endCopy` alone) - "End this meditation?" for
 * both, with no wording signal that Back returns quietly to setup while
 * End Session shows a distinct "ended early" result. When both
 * `onEndSession` and `endSessionCopy` are provided, the bottom button's
 * own label AND its own dialog use `endSessionCopy` instead of `copy`
 * (`endCopy` remains exclusively Back's own wording - never touched by
 * this prop). When `endSessionCopy` is omitted (every caller before this
 * fix), the bottom button falls back to sharing `copy` exactly as before
 * - byte-identical to before this prop existed.
 */
const DEFAULT_END_COPY = {
  buttonLabel: 'End Session',
  buttonAriaLabel: 'End meditation session',
  dialogTitle: 'Leave meditation?',
  dialogMessage: 'Your current meditation will end.',
  confirmLabel: 'End and Leave',
  cancelLabel: 'Continue Meditation'
};

export const MeditationActiveSession = ({
  style,
  snapshot,
  soundId,
  soundUnavailable,
  reducedMotion = false,
  onSelectSound,
  onPause,
  onResume,
  onRequestLeave,
  onRequestClose,
  endCopy = DEFAULT_END_COPY,
  endSessionCopy = null,
  showHeaderClose = true,
  bottomAction = null,
  onChooseAnother = null,
  onEndSession = null
}) => {
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [bottomActionConfirmOpen, setBottomActionConfirmOpen] = useState(false);
  const [chooseAnotherConfirmOpen, setChooseAnotherConfirmOpen] = useState(false);
  const [endSessionConfirmOpen, setEndSessionConfirmOpen] = useState(false);
  const copy = { ...DEFAULT_END_COPY, ...endCopy };
  // F4 — see this file's own top doc comment for `endSessionCopy`.
  const endSessionActiveCopy = endSessionCopy ? { ...DEFAULT_END_COPY, ...endSessionCopy } : copy;

  const handleConfirmLeave = () => {
    setLeaveConfirmOpen(false);
    onRequestLeave();
  };

  const handleConfirmEndSession = () => {
    setEndSessionConfirmOpen(false);
    onEndSession();
  };

  const handleConfirmBottomAction = () => {
    setBottomActionConfirmOpen(false);
    bottomAction?.onConfirm();
  };

  const handleConfirmChooseAnother = () => {
    setChooseAnotherConfirmOpen(false);
    onChooseAnother();
  };

  return (
    // Mobile scroll repair — found live: this screen is reached only via
    // Morning/Evening's own authenticated routine flow or standalone
    // Meditation (both rendered outside <Layout>, see App.jsx routing),
    // so the original viewport audit's guest-mode pass could never reach
    // it and this defect was never caught. `min-h-[85vh]` alone relies on
    // document scroll, which index.html deliberately disables on both
    // axes (see Introduction.jsx's own identical fix/doc comment) - a real
    // wheel-scroll simulation confirmed `window.scrollY` never moved at
    // 320/375/390px width, leaving content below the fold (originally
    // standalone's own "End Session" button at the larger sizes; adding
    // "Choose another meditation" made this concretely unreachable at
    // every tested size, surfacing a pre-existing defect rather than
    // introducing a new one). Same proven shape as every other full-bleed
    // screen fixed this way: this screen now owns its own single scroll
    // container instead of depending on document scroll.
    //
    // Nested-scroll-trap correction — found live, Evening only: Evening's
    // caller wraps this component in EveningSceneShell, which owns its OWN
    // outer `fixed inset-0 overflow-y-auto` scroll container (Morning and
    // standalone have no such wrapper). The original fix set
    // `overscrollBehaviorY: 'contain'` on this component's own inner
    // scroll container (matching every other single-container screen fixed
    // this way) - but `contain` also blocks the browser's normal scroll-
    // chaining once THIS container's own scroll room runs out, so on
    // Evening specifically, once this inner container hit its own limit,
    // the remaining wheel delta had nowhere further to go and the bottom
    // controls stayed a few pixels below the fold even at max scroll -
    // confirmed live by inspecting both containers' scrollHeight/
    // clientHeight directly. Removing `contain` costs nothing on Morning/
    // standalone (there is no outer scrollable ancestor for a leftover
    // wheel delta to chain into there anyway) and lets Evening's leftover
    // delta correctly chain up into EveningSceneShell's own outer
    // container, which has its own additional scroll room.
    <div className="h-dvh overflow-hidden">
    <div className="h-full w-full overflow-y-auto overflow-x-hidden scroll-hide">
    <div
      className="min-h-full max-w-md w-full mx-auto flex flex-col justify-between py-6 space-y-8 animate-in fade-in duration-500"
      style={{
        paddingLeft: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-left))',
        paddingRight: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-right))',
        paddingTop: 'calc(1rem + env(safe-area-inset-top))'
      }}
    >
      <JourneyHeader
        showBackButton={false}
        onStepBack={() => setLeaveConfirmOpen(true)}
        onClose={onRequestClose ?? (() => setLeaveConfirmOpen(true))}
        showCloseButton={showHeaderClose}
      />

      <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center">
        <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">{style.label}</span>

        <MeditationProgressRing
          elapsedSeconds={snapshot.elapsedSeconds}
          durationSeconds={snapshot.durationSeconds}
          reducedMotion={reducedMotion}
        />

        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed min-h-[2.5rem]">{snapshot.promptText}</p>

        <p className="text-[10px] text-on-surface-variant/60 text-center min-h-[1.5em]">
          {soundUnavailable ? "That sound wasn't available right now — switched to No Music." : ''}
        </p>
      </div>

      <div className="space-y-3 w-full">
        {snapshot.status === 'paused' ? (
          <button
            type="button"
            onClick={onResume}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            <span>Resume</span>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">play_arrow</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            className="w-full glass-panel text-on-surface py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span>Pause</span>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">pause</span>
          </button>
        )}

        <div className="space-y-2">
          <h2 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Choose your sound</h2>
          <div className="space-y-2" role="radiogroup" aria-label="Choose your sound">
            {MEDITATION_SOUNDS.map((sound) => (
              <MeditationOptionRow
                key={sound.id}
                groupName="meditation-sound-active"
                label={sound.label}
                description={sound.description}
                selected={soundId === sound.id}
                onSelect={() => onSelectSound(sound.id)}
              />
            ))}
          </div>
        </div>

        {bottomAction ? (
          <button
            type="button"
            onClick={() => setBottomActionConfirmOpen(true)}
            aria-label={bottomAction.buttonAriaLabel}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            <span>{bottomAction.buttonLabel}</span>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => (onEndSession ? setEndSessionConfirmOpen(true) : setLeaveConfirmOpen(true))}
            aria-label={onEndSession ? endSessionActiveCopy.buttonAriaLabel : copy.buttonAriaLabel}
            className="w-full py-4 rounded-full font-semibold text-center min-h-[44px] bg-[#b3555f]/15 text-[#b3555f] border border-[#b3555f]/40 hover:bg-[#b3555f]/25 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[#b3555f] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            {onEndSession ? endSessionActiveCopy.buttonLabel : copy.buttonLabel}
          </button>
        )}

        {onChooseAnother && (
          <button
            type="button"
            onClick={() => setChooseAnotherConfirmOpen(true)}
            className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
          >
            Choose another meditation
          </button>
        )}
      </div>

      <ConfirmDialog
        open={leaveConfirmOpen}
        title={copy.dialogTitle}
        message={copy.dialogMessage}
        confirmLabel={copy.confirmLabel}
        cancelLabel={copy.cancelLabel}
        mildDestructive
        onConfirm={handleConfirmLeave}
        onDismiss={() => setLeaveConfirmOpen(false)}
      />

      {bottomAction && (
        <ConfirmDialog
          open={bottomActionConfirmOpen}
          title={bottomAction.dialogTitle}
          message={bottomAction.dialogMessage}
          confirmLabel={bottomAction.confirmLabel}
          cancelLabel={bottomAction.cancelLabel}
          onConfirm={handleConfirmBottomAction}
          onDismiss={() => setBottomActionConfirmOpen(false)}
        />
      )}

      {onEndSession && (
        <ConfirmDialog
          open={endSessionConfirmOpen}
          title={endSessionActiveCopy.dialogTitle}
          message={endSessionActiveCopy.dialogMessage}
          confirmLabel={endSessionActiveCopy.confirmLabel}
          cancelLabel={endSessionActiveCopy.cancelLabel}
          mildDestructive
          onConfirm={handleConfirmEndSession}
          onDismiss={() => setEndSessionConfirmOpen(false)}
        />
      )}

      {onChooseAnother && (
        <ConfirmDialog
          open={chooseAnotherConfirmOpen}
          title="Change meditation?"
          message="Your current meditation will end and its progress will be lost."
          confirmLabel="Choose another"
          cancelLabel="Keep meditating"
          mildDestructive
          onConfirm={handleConfirmChooseAnother}
          onDismiss={() => setChooseAnotherConfirmOpen(false)}
        />
      )}
    </div>
    </div>
    </div>
  );
};
