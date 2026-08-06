/*
 * Stage 3C — Session Registry Preview (Ticket Group 1)
 *
 * Internal, unlinked route — same pattern as Stage3Preview.jsx
 * (MLT-3A-16): rendered outside <Layout />, not present in Layout's
 * navItems, not reachable from any existing screen, not part of any
 * Stage 2 or Stage 3B flow. Exists solely so the Group 1 session
 * registry can be visually inspected as it's built.
 *
 * READ-ONLY: this component only calls the pure accessor functions from
 * src/session/sessionRegistry.js and renders their return values. It
 * holds no local state, dispatches nothing, calls no navigation, touches
 * no localStorage/Supabase, and mounts no Stage 3 atmospheric component
 * — it cannot trigger an animation or modify anything it displays.
 */

import { getAllSessions } from '../session/sessionRegistry';

const fieldRow = (label, value) => (
  <div className="flex justify-between gap-4 py-1 border-b border-white/5 last:border-b-0">
    <span className="text-on-surface-variant/60">{label}</span>
    <span className="font-mono text-right break-all">{value}</span>
  </div>
);

const formatAtmosphereRequest = (request) => {
  if (!request) return 'null';
  return JSON.stringify(request);
};

const formatValue = (value) => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
};

export const SessionRegistryPreview = () => {
  const sessions = getAllSessions();

  return (
    <div className="min-h-screen bg-background text-on-surface px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-10">
        <header>
          <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant/60 font-bold">
            Session Registry Preview — internal only, not linked from navigation
          </p>
          <h1 className="text-2xl font-bold text-primary mt-2">
            Stage 3C — Ticket Group 1
          </h1>
          <p className="text-sm text-on-surface-variant/70 mt-1">
            Read-only inspection of src/session/sessionRegistry.js. Displays data only —
            nothing on this page navigates, persists, or triggers behaviour.
          </p>
        </header>

        {sessions.length === 0 && (
          <p className="text-on-surface-variant/60 italic">No sessions registered.</p>
        )}

        {sessions.map((session) => (
          <section key={session.id} className="rounded-xl border border-white/10 overflow-hidden">
            <div className="bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-on-surface-variant/50 font-bold">
                {session.category}
              </p>
              <h2 className="text-lg font-bold">{session.title}</h2>
              <p className="text-xs font-mono text-on-surface-variant/50 mt-1">id: {session.id}</p>
              <p className="text-xs font-mono text-on-surface-variant/50">
                entryStates: {formatValue(session.entryStates)} · completionEffect: {formatValue(session.completionEffect)}
              </p>
            </div>

            <div className="divide-y divide-white/5">
              {session.steps.map((step, index) => (
                <div key={step.id} className="px-4 py-3 text-xs">
                  <p className="text-sm font-bold text-primary mb-1">
                    {index + 1}. {step.id}
                  </p>
                  {fieldRow('route', step.route)}
                  {fieldRow('skippable', formatValue(step.skippable))}
                  {fieldRow('durationSeconds', formatValue(step.durationSeconds))}
                  {fieldRow('atmosphereRequest', formatAtmosphereRequest(step.atmosphereRequest))}
                  {fieldRow('audioCue', formatValue(step.audioCue))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
