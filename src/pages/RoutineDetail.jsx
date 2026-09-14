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
 * itself (startSession('morning-routine', { startIndex: <the 'start'
 * step> })) before navigating, so MorningStart.jsx opens directly as a
 * real, tracked "Step 1 of 5" — not a second, separate "Begin your
 * morning" decision screen the way it did before (MorningStart.jsx used
 * to own its own duration/steps summary and its own Begin button,
 * duplicating exactly what this screen already shows, which read as
 * "Start Routine did nothing"). Session Engine tracking is what lets
 * Home's "Continue Rise & Reset" card, per-step Back/Skip/Exit, and
 * accurate step numbering all work consistently — see MorningStart.jsx,
 * Affirmation.jsx, MorningFlow.jsx, Breathe.jsx, IntentionSetup.jsx.
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
    startRoute: '/morning-start',
    startLabel: 'Start Routine',
    requiresAuth: true,
    steps: [
      { title: 'Gentle Awakening / Morning Start', description: 'A short guided welcome into your morning.' },
      { title: 'Morning Affirmation', description: 'A guided affirmation video to set your tone for the day.' },
      { title: 'Stretching', description: 'A brief, gentle stretching sequence.' },
      { title: 'Deep Breathing', description: 'A one-minute guided breathing exercise.' },
      { title: 'Set Intention', description: 'Choose the intention you want to carry through today.' },
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
    requiresAuth: false,
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
    startSession('morning-routine', { startIndex: getStepIndex('morning-routine', MORNING_STEP_IDS.START) });
    navigate(detail.startRoute);
  };

  const handleStart = (e) => {
    if (!detail.requiresAuth) return; // plain <Link>, nothing to intercept
    e.preventDefault();
    if (isGuest) {
      setShowSignInPrompt(true);
      return;
    }
    beginRiseAndReset();
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
          <span className="text-[10px] text-primary uppercase font-bold tracking-wider">{routine.category}</span>
          <h2 className="font-headline-lg text-xl text-on-surface font-bold tracking-tight truncate">{routine.title}</h2>
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
              <span className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
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
        className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
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
