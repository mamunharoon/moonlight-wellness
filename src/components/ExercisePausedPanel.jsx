/*
 * WakeWise — shared "exercise paused" panel for Breathe.jsx,
 * EveningBreathing.jsx and MorningFlow.jsx. Rendered immediately below
 * the interactive ring/countdown and its InteractiveAmbientMusic toggle,
 * ABOVE every optional guided-video row and the "Stretching/Breathing
 * Sessions" list — so it is visible in the initial mobile viewport
 * without scrolling past that catalogue (the exact defect this panel
 * replaces: the old single "Resume Exercise" button lived at the very
 * bottom of the page, below every video row).
 *
 * Build 16 physical-iPhone correction (F6) — ONE Resume action, not two.
 * The previous "Resume Exercise" (music stays off) / "Resume with Music"
 * (music restarts) split asked the user to remember and re-choose
 * something the app already knew: whether its own ambient loop was
 * genuinely playing the instant this exercise was interrupted. Found
 * live: opening a guided session with music ON, then tapping the plain
 * "Resume Exercise" button (the first/default one), silently left music
 * off with no way back short of re-toggling it. The calling page now
 * captures that real answer itself (InteractiveAmbientMusic's exposed
 * `isPlaying()`, read at the moment the interruption begins, before
 * `suspended` pauses it) and passes a single `onResume` that restarts
 * music only if it was genuinely on - never assumed to succeed either
 * way; a failed start() continues the exercise silently with the toggle
 * left off, exactly like a direct toggle tap would (see
 * InteractiveAmbientMusic.jsx's own catch block).
 *
 * Guest pre-start-music correction, part 2 (Build 18) — `isGuest`/
 * `onSignIn` removed (unchanged by this pass): the restored music, if
 * any, reaches the exact same InteractiveAmbientMusic.start() as the
 * pre-start Begin gesture and the active-view toggle - all real,
 * guest-allowed calls (IB01/IS01 are server-allowlisted for guests).
 *
 * WakeWise Phase 2 (B4) — this IS the app's one existing "interrupted"
 * resume screen for a timed exercise (Session Engine's own
 * SESSION_STATUS.INTERRUPTED has no dedicated resume-choice UI anywhere
 * else - see outcomeMessages.js's own top comment). Reused as-is rather
 * than building a new screen: still exactly one Resume action, no new
 * choices added. `journeyTone` (additive, default 'anytime' - matches
 * this component's own most-neutral existing tone) selects the honest,
 * context-appropriate copy from the shared outcomeMessages.js model
 * instead of one fixed "Exercise paused" string.
 */
import { OUTCOME, getOutcomeMessage } from '../lib/outcomeMessages';

export const ExercisePausedPanel = ({ onResume, journeyTone = 'anytime' }) => {
  const { headline, body } = getOutcomeMessage(OUTCOME.INTERRUPTED, journeyTone);
  return (
    <div className="glass-panel rounded-2xl p-5 text-center space-y-3 border border-white/10">
      <h3 className="text-sm font-bold text-on-surface">{headline}</h3>
      <p className="text-xs text-on-surface-variant leading-relaxed">
        {body}
      </p>
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={onResume}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          <span className="material-symbols-outlined text-sm">play_arrow</span>
          <span>Resume</span>
        </button>
      </div>
    </div>
  );
};
