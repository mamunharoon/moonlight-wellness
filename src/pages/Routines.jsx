/* eslint-disable no-unused-vars */
import { Link } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { ROUTINES, ROUTINE_SECTIONS } from '../lib/routinesCatalog';

/*
 * Daily Journey & Content Architecture — Routines Hub
 *
 * Grouped into the required Morning/Daytime/Evening sections (routine
 * cards were previously a flat list — this app has exactly one complete,
 * genuinely-built routine per time band today: Rise & Reset, Gentle
 * Reset, Begin Wind-Down. No other complete routine exists to add
 * alongside them, so each section shows exactly one card, honestly.
 *
 * Each card now also shows a completion/in-progress badge, sourced from
 * the Session Engine for the two routines it tracks (Rise & Reset,
 * Begin Wind-Down) — Gentle Reset has never been Session-Engine-tracked
 * (same as Support's on-demand flows), so it never shows one.
 */
export const Routines = () => {
  const { state } = useSession();

  const statusFor = (routine) => {
    if (!routine.sessionId || state.sessionId !== routine.sessionId) return null;
    if (state.status === 'playing') return { label: 'In progress', className: 'bg-primary/15 text-primary' };
    if (state.status === 'interrupted') return { label: 'Paused', className: 'bg-secondary/15 text-secondary' };
    return null;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="font-headline-lg text-2xl md:text-3xl text-on-surface font-bold tracking-tight">Routines Hub</h2>
        <p className="text-on-surface-variant font-body-md mt-1">
          Simple time-of-day templates to anchor your daily rituals.
        </p>
      </div>

      {ROUTINE_SECTIONS.map((section) => {
        const sectionRoutines = ROUTINES.filter((r) => r.section === section);
        if (!sectionRoutines.length) return null;
        return (
          <div key={section} className="space-y-3">
            <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">{section}</h3>
            <div className="space-y-6">
              {sectionRoutines.map((routine) => {
                const status = statusFor(routine);
                // Morning Visual Uplift (Build 16) — scoped to the Morning
                // section ONLY. This card renderer is shared by all three
                // routines (Rise & Reset/Morning, Gentle Reset/Anytime,
                // Begin Wind-Down/Evening); extending routine.accentColor
                // (already real, already per-routine since Build 16) to
                // the category label and "View routine" link too would
                // have been the more "consistent" choice, but doing so
                // would visibly recolour Evening's/Anytime's own cards -
                // exactly the kind of unrequested shared-card change the
                // approved brief says to leave alone. An inline style
                // (wins over the shared className below regardless of
                // stylesheet order, the same established technique the
                // left border already uses) applies gold ONLY when this
                // card's own section is Morning; every other section's
                // category label/link stays the exact original text-primary
                // peach, completely untouched.
                const isMorning = routine.section === 'Morning';
                // Evening Visual Uplift (Build 17) — same additive,
                // inline-style-scoped mechanism as isMorning above,
                // applied only when this card's own section is Evening.
                // routine.accentColor for 'wind-down' already resolves to
                // var(--color-evening-accent) (routinesCatalog.js), so
                // reusing the exact same style prop naturally recolours
                // the category label/link periwinkle - no new colour, no
                // change to Morning's own untouched gold (Anytime later
                // gains its own isAnytime branch below, Phase 2).
                const isEvening = routine.section === 'Evening';
                // Anytime Reset Visual Uplift (Phase 2, approved) — Gentle
                // Reset is the one 'Daytime'-section routine; scoped the
                // exact same additive way isMorning/isEvening already are.
                // Its title keeps the plain established sans-serif (no
                // font branch needed here - the fallback '' already
                // applies), so only the category label/link colour join
                // the existing isMorning||isEvening condition below.
                const isAnytime = routine.section === 'Daytime';
                return (
                  <Link
                    key={routine.id}
                    to={`/routines/${routine.id}`}
                    className="block glass-panel p-6 rounded-3xl space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
                    // Circadian Colors — inline style, not a border-l-4
                    // Tailwind class: see routinesCatalog.js's own
                    // accentColor doc comment for why (.glass-panel's own
                    // border shorthand otherwise silently overrides it).
                    style={{ borderLeft: `4px solid ${routine.accentColor}` }}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <span
                          className="text-[10px] text-primary uppercase font-bold tracking-wider"
                          style={(isMorning || isEvening || isAnytime) ? { color: routine.accentColor } : undefined}
                        >
                          {routine.category}
                        </span>
                        <h3 className={`text-lg font-bold text-on-surface mt-0.5 ${isMorning ? 'font-morning-display italic' : isEvening ? 'font-serif italic' : ''}`}>{routine.title}</h3>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-on-surface-variant bg-white/5 border border-white/10 px-2 py-1 rounded">{routine.duration}</span>
                        {status && (
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${status.className}`}>
                            {status.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {routine.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-on-surface-variant/60 uppercase tracking-wider font-semibold">
                        {routine.stepCount} {routine.stepCount === 1 ? 'step' : 'steps'}
                      </span>
                      <span
                        className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                        style={(isMorning || isEvening || isAnytime) ? { color: routine.accentColor } : undefined}
                      >
                        View routine
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
