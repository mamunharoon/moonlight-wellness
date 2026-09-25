import { useNavigate } from 'react-router-dom';

/*
 * Guest Onboarding — Welcome
 *
 * The very first thing an unauthenticated visitor sees, before any route
 * in the app renders (see components/OnboardingGate.jsx, the one place
 * this page is mounted). Never auto-redirects to /auth — signing in is
 * offered, never forced, per the explicit "do not automatically force
 * the authentication screen on launch" requirement.
 *
 * `onContinueAsGuest` is owned entirely by OnboardingGate: it persists
 * the choice (lib/guestEntry.js) and flips the gate's own local state so
 * the app renders immediately, without a full reload. This page itself
 * has no opinion on where that choice is stored.
 */
export const Welcome = ({ onContinueAsGuest }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col justify-between px-6 py-10 max-w-md mx-auto">
      <div className="flex-1 flex flex-col justify-center items-center text-center space-y-6">
        <span
          className="material-symbols-outlined text-primary text-5xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
          aria-hidden="true"
        >
          spa
        </span>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Welcome to WakeWise</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed max-w-xs mx-auto">
            Morning routines, anytime resets, meditation, breathing and evening wind-downs—at your own pace.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-5 space-y-3 text-left w-full">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            <span className="font-bold text-on-surface">As a guest</span>, you can explore WakeWise and try
            selected breathing, meditation, music and sleep experiences.
          </p>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            <span className="font-bold text-on-surface">Create an account or sign in</span> to save your
            intentions, progress and reflections, personalise reminders and access the complete WakeWise
            experience.
          </p>
        </div>
      </div>

      <div className="space-y-3 pt-8">
        <button
          type="button"
          onClick={() => navigate('/auth?tab=signup')}
          className="w-full py-4 rounded-full bg-primary text-on-primary font-bold text-center hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Create Free Account
        </button>
        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="w-full py-4 rounded-full glass-panel text-on-surface font-bold text-center border-white/10 hover:bg-white/10 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={onContinueAsGuest}
          className="w-full py-3 text-center text-xs text-on-surface-variant font-semibold hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
        >
          Continue as Guest
        </button>
      </div>
    </div>
  );
};
