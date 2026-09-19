/*
 * WakeWise — shared "paused for guided video" panel for Breathe.jsx and
 * MorningFlow.jsx. Rendered immediately below the interactive ring/
 * countdown and its InteractiveAmbientMusic toggle, ABOVE every optional
 * guided-video row and the "Stretching/Breathing Sessions" list — so it
 * is visible in the initial mobile viewport without scrolling past that
 * catalogue (the exact defect this panel replaces: the old single
 * "Resume Exercise" button lived at the very bottom of the page, below
 * every video row).
 *
 * Two distinct resume actions, not one, per the approved requirement:
 * - Resume Exercise: resumes the timer only, music stays off.
 * - Resume with Music: resumes the timer AND starts the page's own
 *   ambient loop as a fresh, deliberate gesture (musicPlayerRef.start()
 *   in the calling page) — never assumed to succeed; a failed start
 *   continues the exercise silently with the toggle left off, exactly
 *   like a direct toggle tap would (see InteractiveAmbientMusic.jsx's
 *   own catch block).
 *
 * `showResumeWithMusic` hides the second button entirely (rather than
 * disabling it) when the page's own ambient loop isn't eligible right
 * now (feature flag off, or no manifest entry) — showing a button that
 * silently does nothing would be its own, different bug.
 */
export const ExercisePausedPanel = ({ onResumeExercise, onResumeWithMusic, showResumeWithMusic }) => (
  <div className="glass-panel rounded-2xl p-5 text-center space-y-3 border border-white/10">
    <h3 className="text-sm font-bold text-on-surface">Exercise paused</h3>
    <p className="text-xs text-on-surface-variant leading-relaxed">
      Your timer and background music were stopped while you viewed the guided session.
    </p>
    <div className="space-y-2 pt-1">
      <button
        type="button"
        onClick={onResumeExercise}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
      >
        <span className="material-symbols-outlined text-sm">play_arrow</span>
        <span>Resume Exercise</span>
      </button>
      {showResumeWithMusic && (
        <button
          type="button"
          onClick={onResumeWithMusic}
          className="w-full glass-panel text-on-surface py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all border-white/10"
        >
          <span className="material-symbols-outlined text-sm">music_note</span>
          <span>Resume with Music</span>
        </button>
      )}
    </div>
  </div>
);
