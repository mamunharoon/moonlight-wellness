/* eslint-disable no-unused-vars */
import { useLocation, useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { resolveSelfGuidedMeditationContext } from '../lib/selfGuidedMeditationNav';
import { DEFAULT_MEDITATION_STYLE_ID, getMeditationStyleById } from '../lib/meditationStyles';
import { DEFAULT_MEDITATION_DURATION_ID, getMeditationDurationById } from '../lib/meditationDurations';

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

  const style = getMeditationStyleById(session?.styleId) || getMeditationStyleById(DEFAULT_MEDITATION_STYLE_ID);
  const duration = getMeditationDurationById(session?.durationId) || getMeditationDurationById(DEFAULT_MEDITATION_DURATION_ID);

  const handleDone = () => navigate(context.fallback);

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
    // Build 16 physical-iPhone correction (F8) - see Affirmation.jsx's
    // identical block for the full rationale.
    <div
      className="min-h-[85vh] flex flex-col justify-between pb-6 max-w-md mx-auto space-y-10"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))'
      }}
    >
      <div className="flex items-center gap-3">
        <BackButton fallback={context.fallback} label={context.label} guardActiveRoute={false} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
        <span className="material-symbols-outlined text-primary text-4xl" aria-hidden="true">self_improvement</span>
        <h1 className="font-serif italic text-3xl text-on-surface">Meditation complete</h1>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">Take this steadiness with you.</p>
        {session && (
          <div className="glass-panel rounded-2xl p-5 space-y-1 text-left max-w-xs mx-auto">
            <p className="text-xs text-primary font-bold uppercase tracking-wider">{style.label}</p>
            <p className="text-xs text-on-surface-variant">{duration.label}</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleDone}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
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
    </div>
  );
};
