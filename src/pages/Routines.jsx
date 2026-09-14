/* eslint-disable no-unused-vars */
import { Link } from 'react-router-dom';
import { ROUTINES } from '../lib/routinesCatalog';

// Mobile navigation repair, Phase 3: each card used to be a plain,
// non-interactive <div> — zero onClick, zero <Link>, zero navigation of
// any kind (confirmed by audit before this fix). ROUTINES (in
// lib/routinesCatalog.js) holds the data each card displays plus the
// routineId RoutineDetail.jsx needs to find its own step list, so this
// file and RoutineDetail.jsx share one source of truth.
export const Routines = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="font-headline-lg text-2xl md:text-3xl text-on-surface font-bold tracking-tight">Routines Hub</h2>
        <p className="text-on-surface-variant font-body-md mt-1">
          Simple three-section circadian templates to anchor your daily rituals.
        </p>
      </div>

      <div className="space-y-6">
        {ROUTINES.map((routine) => (
          <Link
            key={routine.id}
            to={`/routines/${routine.id}`}
            className={`block glass-panel p-6 rounded-3xl space-y-4 border-l-4 ${routine.accent} shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary`}
          >
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <span className="text-[10px] text-primary uppercase font-bold tracking-wider">{routine.category}</span>
                <h3 className="text-lg font-bold text-on-surface mt-0.5">{routine.title}</h3>
              </div>
              <span className="text-xs text-on-surface-variant bg-white/5 border border-white/10 px-2 py-1 rounded shrink-0">{routine.duration}</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {routine.description}
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
              View routine
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};
