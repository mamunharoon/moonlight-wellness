/*
 * WakeWise — shared "add background music?" entry choice for every
 * interactive timed screen (Breathe.jsx, MorningFlow.jsx,
 * EveningBreathing.jsx, QuietBreathing.jsx). Rendered near the top of the
 * exercise, before its own countdown effect is allowed to start an
 * interval (each caller gates that effect on the same `musicChoiceMade`
 * state this component's two buttons set) - never a browser/native
 * `confirm()` (those block the whole tab and can't be styled to fit an
 * inline "top of the exercise" placement, and can't be reliably
 * dismissed by an automated test either).
 *
 * Shown only while `!musicChoiceMade` AND music is eligible on this
 * screen (feature flag on + a real registered asset) - the caller
 * computes that eligibility itself (same isInteractiveMusicEligible
 * check InteractiveAmbientMusic.jsx uses) and simply never renders this
 * component at all when it's false, so a screen with no music available
 * behaves exactly as it did before this feature existed: no extra
 * question, timer starts immediately.
 *
 * Deliberately compact (two same-row buttons, two short lines of copy)
 * so it never pushes ProgressIndicator or the exercise's own title out of
 * view, and both buttons fit side by side at iPhone width.
 *
 * Guest pre-start-music correction, part 2 (Build 18) — `isGuest`/
 * `onSignIn` REMOVED. "Start with Music" reaches InteractiveAmbientMusic's
 * own start() for IB01, which is server-allowlisted for guests exactly
 * like every other real interactive-ambient-music control in this app
 * (see musicPreference.js's own doc comment). The former Build 11 "Sign
 * In" substitute button - added when this really would have silently
 * failed for a guest - is now stale: that failure mode no longer exists,
 * so gating the button was gating a guest out of audio they are
 * genuinely permitted to hear. "Continue Without Music" is unaffected
 * either way; this choice is never persisted to musicPreference.js for
 * any user, guest or authenticated - it only ever sets this screen's own
 * local musicChoiceMade state (see QuietBreathing.jsx's own handlers).
 */
export const MusicEntryChoice = ({ onStartWithMusic, onContinueWithoutMusic }) => (
  <div className="glass-panel rounded-2xl p-4 text-center space-y-2 border border-white/10">
    <p className="text-sm font-bold text-on-surface">Add calming background music?</p>
    <p className="text-[11px] text-on-surface-variant">
      You can switch it off at any time.
    </p>
    <div className="flex gap-2 pt-1">
      <button
        type="button"
        onClick={onContinueWithoutMusic}
        className="flex-1 glass-panel text-on-surface py-3 rounded-full font-bold text-xs hover:bg-white/10 active:scale-95 transition-all border-white/10"
      >
        Continue Without Music
      </button>
      <button
        type="button"
        onClick={onStartWithMusic}
        className="flex-1 bg-primary text-on-primary py-3 rounded-full font-bold text-xs hover:opacity-90 active:scale-95 transition-all shadow-lg"
      >
        Start with Music
      </button>
    </div>
  </div>
);
