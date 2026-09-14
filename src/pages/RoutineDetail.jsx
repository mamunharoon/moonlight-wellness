/* eslint-disable no-unused-vars */
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ROUTINES } from '../lib/routinesCatalog';

/*
 * Mobile navigation repair, Phase 3 — Routine detail screen
 *
 * Reached by tapping a Routines Hub card (previously inert <div>s with no
 * navigation at all). Shows title/purpose/duration/ordered steps plus a
 * Start Routine button, per the required experience.
 *
 * Start Routine deliberately does NOT call the Session Engine's
 * startSession() directly for any of the three routines — it navigates
 * to the exact same entry route Home's own existing CTAs already use
 * (e.g. "Begin Your Morning" -> /morning-start, "Begin Evening Wind-down"
 * -> /evening-wind-down, "60-Second Reset" -> /quiet-breathing). Those
 * entry pages own starting/continuing the routine themselves (Evening
 * Wind-down's Begin button already calls startSession('evening-wind-down')
 * — see EveningWindDown.jsx; the morning routine's Session Engine session
 * is only ever started by a real alarm ring, exactly as it already works
 * today, and Home's "Begin Your Morning" link has always relied on the
 * same legacy journeyStep-driven progression rather than starting the
 * Session Engine manually). Reusing those exact entry points means every
 * existing control, timer, and completion-tracking mechanism for these
 * three routines keeps working completely unchanged — this screen adds a
 * path into them, it does not re-implement them.
 */
const ROUTINE_DETAILS = {
  'rise-reset': {
    purpose: 'A short morning sequence to help you start the day grounded and clear-headed.',
    startRoute: '/morning-start',
    startLabel: 'Start Routine',
    steps: [
      { title: 'Morning Start', description: 'A short guided welcome into your morning.' },
      { title: 'Affirmation', description: 'A guided affirmation video to set your tone for the day.' },
      { title: 'Stretching', description: 'A brief, gentle stretching sequence.' },
      { title: 'Breathing', description: 'A one-minute guided breathing exercise.' },
      { title: 'Set Intention', description: 'Choose the intention you want to carry through today.' }
    ]
  },
  'gentle-reset': {
    purpose: 'A quick, on-the-spot breathing reset for whenever you need to lower your heart rate and refocus.',
    startRoute: '/quiet-breathing',
    startLabel: 'Start Routine',
    steps: [
      { title: '60-Second Reset', description: 'A short guided breathing visualizer — inhale, hold, exhale.' }
    ]
  },
  'wind-down': {
    purpose: 'A calming end-of-day sequence to help you unwind and prepare for restful sleep.',
    startRoute: '/evening-wind-down',
    startLabel: 'Start Routine',
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/routines')}
          aria-label="Back to Routines"
          className="w-11 h-11 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
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
        to={detail.startRoute}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
      >
        <span>{detail.startLabel}</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </Link>
    </div>
  );
};
