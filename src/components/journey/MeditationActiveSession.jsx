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
  showHeaderClose = true,
  bottomAction = null
}) => {
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [bottomActionConfirmOpen, setBottomActionConfirmOpen] = useState(false);
  const copy = { ...DEFAULT_END_COPY, ...endCopy };

  const handleConfirmLeave = () => {
    setLeaveConfirmOpen(false);
    onRequestLeave();
  };

  const handleConfirmBottomAction = () => {
    setBottomActionConfirmOpen(false);
    bottomAction?.onConfirm();
  };

  return (
    <div
      className="min-h-[85vh] max-w-md w-full mx-auto flex flex-col justify-between py-6 space-y-8 animate-in fade-in duration-500"
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
            onClick={() => setLeaveConfirmOpen(true)}
            aria-label={copy.buttonAriaLabel}
            className="w-full py-4 rounded-full font-semibold text-center min-h-[44px] bg-[#b3555f]/15 text-[#b3555f] border border-[#b3555f]/40 hover:bg-[#b3555f]/25 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[#b3555f] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            {copy.buttonLabel}
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
    </div>
  );
};
