/* eslint-disable no-unused-vars */
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ROUTINES } from '../lib/routinesCatalog';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { getStepIndex } from '../session/sessionRegistry';
import { MORNING_STEP_IDS } from '../session/sessionConstants';
import { setPendingContent } from '../lib/pendingContent';
import { BackButton } from '../components/BackButton';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { useState } from 'react';

/*
 * Mobile navigation repair, Phase 3 — Routine detail screen
 * Rise & Reset double-start repair — see this file's own inline notes
 * below for what changed and why.
 *
 * Reached by tapping a Routines Hub card (previously inert <div>s with no
 * navigation at all). Shows title/purpose/duration/ordered steps plus a
 * Start Routine button.
 *
 * Rise & Reset ('rise-reset') is the one routine whose Start Routine
 * button does more than a plain link: it starts the Session Engine
 * itself (startSession('morning-routine', { startIndex: <the 'intention'
 * step> })) before navigating, so IntentionSetup.jsx opens directly as a
 * real, tracked "Step 1 of 5" (Journey Embedding correction; was "Step 1
 * of 4" before Meditate was counted). Session Engine tracking is what lets
 * Home's "Continue Rise & Reset" card, per-step Back/Skip/Exit, and
 * accurate step numbering all work consistently — see IntentionSetup.jsx,
 * MorningFlow.jsx, Breathe.jsx, Affirmation.jsx.
 *
 * Morning-flow redesign: the former /morning-start video-selection screen
 * (once "Step 1 of 5") is removed from the routine entirely — Set Your
 * Intention is now Step 1. See sessionConstants.js's MORNING_STEP_IDS/
 * MORNING_DISPLAY_STEP_NUMBERS and morningFlowMigration.js for the
 * corresponding registry and storage-migration changes.
 *
 * Gentle Reset and Wind-Down are audited and do NOT have this bug:
 * Gentle Reset's Start Routine already goes straight to the one real
 * screen (/quiet-breathing, no separate intro); Wind-Down's Start
 * Routine already goes straight to EveningWindDown.jsx, which IS step 1
 * itself (its own Begin button starts the session and advances in one
 * motion) — neither needs the startSession-before-navigate treatment
 * Rise & Reset now gets.
 *
 * Guest gate: Rise & Reset's steps include gated exercise content
 * (Affirmation.jsx's videos, etc.), so a signed-out Start Routine tap
 * shows the standard SignInPromptDialog instead of starting anything —
 * "Sign in"/"Create account" stash this exact URL as the return route
 * (lib/pendingContent.js, id: null since there's no specific item to
 * reopen) so the user lands back on THIS routine detail screen after
 * authenticating, per spec, rather than being dropped into the routine
 * itself or losing their place. Gentle Reset and Wind-Down are not
 * gated — neither one requires an account to use today.
 */
const ROUTINE_DETAILS = {
  'rise-reset': {
    purpose: 'A short morning sequence to help you start the day grounded and clear-headed.',
    // Morning-flow redesign: Step 1 is now Set Your Intention — the former
    // /morning-start video-selection screen is removed from the routine
    // entirely (see MORNING_STEP_IDS' own comment in sessionConstants.js).
    startRoute: '/intention-setup',
    startLabel: 'Start Routine',
    requiresAuth: true,
    steps: [
      { title: 'Set Intention', description: 'Choose the intention you want to carry through today.' },
      { title: 'Stretching', description: 'A brief, gentle stretching sequence.' },
      { title: 'Deep Breathing', description: 'A one-minute guided breathing exercise.' },
      { title: 'Morning Affirmation', description: 'An affirmation matched to your intention.' },
      { title: 'Completion', description: 'Your morning routine is complete.' }
    ]
  },
  'gentle-reset': {
    purpose: 'A quick, on-the-spot breathing reset for whenever you need to lower your heart rate and refocus.',
    startRoute: '/quiet-breathing',
    startLabel: 'Start Routine',
    requiresAuth: false,
    steps: [
      { title: '60-Second Reset', description: 'A short guided breathing visualizer — inhale, hold, exhale.' }
    ]
  },
  'wind-down': {
    purpose: 'A calming end-of-day sequence to help you unwind and prepare for restful sleep.',
    startRoute: '/evening-wind-down',
    startLabel: 'Start Routine',
    // Guest Onboarding: Evening Wind-Down starts and persists real
    // Session Engine progress (routineProgress.js) the moment its own
    // Begin button is tapped — guests must not be able to reach that
    // without signing in first (same restriction Rise & Reset already
    // has below). Gentle Reset stays unauthenticated: it never touches
    // the Session Engine and persists nothing.
    requiresAuth: true,
    steps: [
      { title: 'Wind Down', description: 'Settle in and shift out of your day.' },
      { title: 'Reflection', description: 'A few short prompts to reflect on your day.' },
      { title: 'Gratitude', description: 'Log a moment of gratitude before rest.' },
      { title: 'Evening Breathing', description: 'A slow, guided breathing exercise.' },
      { title: 'Prepare for Rest', description: 'A short checklist plus Sleep Sounds to help you drift off.' }
    ]
  }
};

export const RoutineDetail = () => {
  const { routineId } = useParams();
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const { state, startSession, resetSession } = useSession();
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  const routine = ROUTINES.find((r) => r.id === routineId);
  const detail = ROUTINE_DETAILS[routineId];
  // Morning Visual Uplift (Build 16) — this detail screen is shared by
  // all three routines, exactly like Routines.jsx's own card renderer
  // (see that file's own doc comment for the full reasoning) - scoped to
  // Morning only, via inline style, so Gentle Reset's and Wind-Down's own
  // rendering stays byte-for-byte the original peach, untouched.
  const isMorning = routine?.section === 'Morning';
  // Evening Visual Uplift (Build 17) — same additive, inline-style-scoped
  // mechanism as isMorning above, applied only when this routine's own
  // section is Evening. routine.accentColor for 'wind-down' already
  // resolves to var(--color-evening-accent), so reusing the exact same
  // style prop naturally recolours the category label periwinkle - no
  // new colour (Gentle Reset later gains its own isAnytime branch below,
  // Phase 2).
  const isEvening = routine?.section === 'Evening';
  // Anytime Reset Visual Uplift (Phase 2, approved) — same additive,
  // optional-chained mechanism as isMorning/isEvening above, scoped to
  // Gentle Reset (the one 'Daytime'-section routine) only.
  const isAnytime = routine?.section === 'Daytime';

  if (!routine || !detail) {
    return (
      <div className="space-y-6 text-center py-8">
        <p className="text-sm text-on-surface-variant">This routine couldn't be found.</p>
        <Link to="/routines" className="text-primary text-sm font-bold">Back to Routines</Link>
      </div>
    );
  }

  const beginRiseAndReset = () => {
    // The Session Engine's START_SESSION rejects outright if a session is
    // already 'playing' or 'interrupted' — regardless of which routine it
    // belongs to (see session/sessionReducer.js). "Start Routine" here
    // always means "begin fresh," never "resume," so any leftover state
    // (including an 'interrupted' routine left via the Leave-routine
    // confirmation elsewhere) is reset first — same guard AlarmContext.jsx
    // already uses before its own startSession('morning-routine') call.
    if (state.status === 'playing' || state.status === 'interrupted') {
      resetSession();
    }
    startSession('morning-routine', { startIndex: getStepIndex('morning-routine', MORNING_STEP_IDS.INTENTION) });
    navigate(detail.startRoute);
  };

  const handleStart = (e) => {
    if (!detail.requiresAuth) return; // plain <Link>, nothing to intercept
    e.preventDefault();
    if (isGuest) {
      setShowSignInPrompt(true);
      return;
    }
    // Guest Onboarding: requiresAuth is now also true for 'wind-down', not
    // just 'rise-reset' — but beginRiseAndReset() is Rise & Reset-specific
    // (it always calls startSession('morning-routine', ...), which would
    // start the wrong routine entirely for Wind-Down). Once the guest
    // check above passes, Wind-Down gets a plain navigation instead,
    // matching Home.jsx's own handleBeginEveningWindDown and this exact
    // file's own doc comment above: EveningWindDown.jsx's own Begin
    // button is what actually starts+advances that session, exactly as
    // it already does for every other (unauthenticated) visitor today.
    if (routineId === 'rise-reset') {
      beginRiseAndReset();
      return;
    }
    navigate(detail.startRoute);
  };

  const handleSignIn = () => {
    setPendingContent({ returnPath: `/routines/${routineId}` });
    setShowSignInPrompt(false);
    navigate('/auth');
  };

  const handleCreateAccount = () => {
    setPendingContent({ returnPath: `/routines/${routineId}` });
    setShowSignInPrompt(false);
    navigate('/auth?tab=signup');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <BackButton fallback="/routines" />
        <div className="min-w-0">
          <span
            className="text-[10px] text-primary uppercase font-bold tracking-wider"
            style={(isMorning || isEvening || isAnytime) ? { color: routine.accentColor } : undefined}
          >
            {routine.category}
          </span>
          <h2 className={`font-headline-lg text-xl text-on-surface font-bold tracking-tight truncate ${isMorning ? 'font-morning-display italic' : isEvening ? 'font-serif italic' : ''}`}>{routine.title}</h2>
        </div>
      </div>

      <div className="glass-panel p-5 rounded-3xl space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Estimated duration</span>
          <span className="text-xs text-on-surface-variant bg-white/5 border border-white/10 px-2 py-1 rounded">{routine.duration}</span>
        </div>
        <p className="text-sm text-on-surface-variant leading-relaxed">{detail.purpose}</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Steps</h3>
        <div className="glass-panel rounded-3xl overflow-hidden divide-y divide-white/5">
          {detail.steps.map((step, index) => (
            <div key={step.title} className="flex items-start gap-4 p-4">
              <span
                className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                  isMorning
                    ? 'bg-morning-accent/10 border border-morning-accent/25 text-morning-accent'
                    : isEvening
                    ? 'bg-evening-accent/10 border border-evening-accent/25 text-evening-accent'
                    : isAnytime
                    ? 'bg-tertiary-tint/15 border border-tertiary-tint/30 text-tertiary'
                    : 'bg-primary/10 border border-primary/20 text-primary'
                }`}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-on-surface">{step.title}</p>
                <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Link
        to={detail.requiresAuth ? '#' : detail.startRoute}
        onClick={handleStart}
        className={`w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg ${isMorning ? 'shadow-morning-glow' : isEvening ? 'shadow-evening-glow' : isAnytime ? 'shadow-mint-glow' : ''}`}
      >
        <span>{detail.startLabel}</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </Link>

      <SignInPromptDialog
        open={showSignInPrompt}
        onSignIn={handleSignIn}
        onCreateAccount={handleCreateAccount}
        onDismiss={() => setShowSignInPrompt(false)}
      />
    </div>
  );
};
