/* eslint-disable no-unused-vars */
/*
 * Stage 3C — Session Engine Preview (Ticket Group 2)
 *
 * Internal, unlinked route — same pattern as Stage3Preview.jsx and
 * SessionRegistryPreview.jsx: rendered outside <Layout />, not present
 * in Layout's navItems, not reachable from any existing screen, not
 * part of any Stage 2 or Stage 3B flow.
 *
 * INTEGRATION BOUNDARY: <SessionProvider> is mounted locally, right
 * here, around this page only — never in src/App.jsx's provider tree.
 * Nothing on this page navigates to a real morning route, writes
 * Supabase, or touches AlarmContext. Every action button below calls
 * exactly one SessionContext method; nothing here reimplements engine
 * logic.
 *
 * "Simulate Reload" remounts <SessionProvider> (via a changing `key`),
 * which forces its mount-time restore effect to re-run against whatever
 * is currently in localStorage — an accurate stand-in for a real browser
 * refresh from the Session Engine's own point of view. A literal tab
 * refresh works too and exercises the exact same code path.
 */

import { useEffect, useState } from 'react';
import { SessionProvider, useSession } from '../context/SessionContext';
import { SESSION_STORAGE_KEY, SESSION_STORAGE_VERSION } from '../session/sessionPersistence';

const MORNING_SESSION_ID = 'morning-routine';

const REASONS = ['document-hidden', 'panic-mode', 'navigation', 'manual'];

const button = 'px-3 py-1.5 rounded-full glass-panel text-[11px] font-mono text-on-surface hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent';

const fieldRow = (label, value) => (
  <div key={label} className="flex justify-between gap-4 py-1 border-b border-white/5 last:border-b-0">
    <span className="text-on-surface-variant/60">{label}</span>
    <span className="font-mono text-right break-all">{value}</span>
  </div>
);

const formatValue = (value) => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
};

// Writes directly to localStorage, bypassing the reducer entirely — this
// is deliberate: it's how the harness simulates "whatever was already
// sitting in a user's browser" (corrupt, stale, or referencing data that
// no longer exists) before the engine ever gets a chance to touch it.
const injectRaw = (rawString) => {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, rawString);
  } catch {
    // Storage unavailable — nothing to inject; the corresponding
    // recovery scenario is untestable in this browser/session, not a
    // bug in the injection helper.
  }
};

const isoHoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const SessionEngineHarness = ({ onSimulateReload }) => {
  const {
    state,
    currentSession,
    currentStep,
    currentStepIndex,
    totalSteps,
    canSkipCurrentStep,
    progress,
    startSession,
    advanceStep,
    skipStep,
    interruptSession,
    resumeSession,
    completeSession,
    abandonSession,
    resetSession,
  } = useSession();

  const [rawPayload, setRawPayload] = useState('');

  const refreshRawPayload = () => {
    try {
      setRawPayload(localStorage.getItem(SESSION_STORAGE_KEY) ?? '(empty)');
    } catch {
      setRawPayload('(storage unavailable)');
    }
  };

  // Reads back after the persist effect (in SessionProvider) has had a
  // chance to flush for this state change — setTimeout(0) runs as a
  // macrotask after the current commit's effects, so this reliably
  // reflects what was actually just written, not what's about to be.
  useEffect(() => {
    const id = setTimeout(refreshRawPayload, 0);
    return () => clearTimeout(id);
  }, [state]);

  const injectAndReload = (rawString) => {
    injectRaw(rawString);
    onSimulateReload();
  };

  const injectCorruptJson = () => injectAndReload('{not valid json');

  const injectUnknownSessionId = () =>
    injectAndReload(
      JSON.stringify({
        version: SESSION_STORAGE_VERSION,
        state: {
          sessionId: 'does-not-exist',
          stepIndex: 0,
          status: 'playing',
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          interruptionReason: null,
          completionEventId: null,
        },
      })
    );

  const injectOutOfRangeStepIndex = () =>
    injectAndReload(
      JSON.stringify({
        version: SESSION_STORAGE_VERSION,
        state: {
          sessionId: MORNING_SESSION_ID,
          stepIndex: 99,
          status: 'playing',
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          interruptionReason: null,
          completionEventId: null,
        },
      })
    );

  const injectStalePlayingSession = () =>
    injectAndReload(
      JSON.stringify({
        version: SESSION_STORAGE_VERSION,
        state: {
          sessionId: MORNING_SESSION_ID,
          stepIndex: 2,
          status: 'playing',
          startedAt: isoHoursAgo(14),
          updatedAt: isoHoursAgo(13),
          interruptionReason: null,
          completionEventId: null,
        },
      })
    );

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-white/10 overflow-hidden">
        <div className="bg-white/5 px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant/60">Live state</h2>
        </div>
        <div className="px-4 py-3 text-xs">
          {fieldRow('sessionId', formatValue(state.sessionId))}
          {fieldRow('status', state.status)}
          {fieldRow('current step id', formatValue(currentStep?.id))}
          {fieldRow('stepIndex', `${currentStepIndex} / ${totalSteps > 0 ? totalSteps - 1 : 0}`)}
          {fieldRow('totalSteps', totalSteps)}
          {fieldRow('progress', `${Math.round(progress * 100)}%`)}
          {fieldRow('startedAt', formatValue(state.startedAt))}
          {fieldRow('updatedAt', formatValue(state.updatedAt))}
          {fieldRow('interruptionReason', formatValue(state.interruptionReason))}
          {fieldRow('completionEventId', formatValue(state.completionEventId))}
          {fieldRow('route (display only — never navigated)', formatValue(currentStep?.route))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 overflow-hidden">
        <div className="bg-white/5 px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant/60">
            Persisted payload — localStorage['{SESSION_STORAGE_KEY}']
          </h2>
        </div>
        <pre className="px-4 py-3 text-[10px] font-mono whitespace-pre-wrap break-all text-on-surface-variant/80">
          {rawPayload}
        </pre>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-on-surface-variant/60 font-bold mb-2">
          Session lifecycle
        </h2>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={() => startSession(MORNING_SESSION_ID)}>
            Start morning-routine
          </button>
          <button className={button} onClick={() => startSession('does-not-exist')}>
            Start unknown-session-id
          </button>
          <button className={button} onClick={advanceStep}>Advance</button>
          <button className={button} onClick={skipStep} disabled={state.status === 'playing' && !canSkipCurrentStep}>
            Skip {state.status === 'playing' && !canSkipCurrentStep ? '(will be rejected — not skippable)' : ''}
          </button>
          <button className={button} onClick={resumeSession}>Resume</button>
          <button className={button} onClick={completeSession}>Complete</button>
          <button className={button} onClick={abandonSession}>Abandon</button>
          <button className={button} onClick={resetSession}>Reset</button>
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-on-surface-variant/60 font-bold mb-2">
          Interrupt (reason is metadata only)
        </h2>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((reason) => (
            <button key={reason} className={button} onClick={() => interruptSession(reason)}>
              Interrupt: {reason}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-on-surface-variant/60 font-bold mb-2">
          Reload / restore
        </h2>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={onSimulateReload}>
            Simulate reload (remount provider)
          </button>
        </div>
        <p className="text-[11px] text-on-surface-variant/50 mt-2 max-w-lg leading-relaxed">
          A literal browser tab refresh exercises the identical restore path and is the most
          authoritative test of the three.
        </p>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-on-surface-variant/60 font-bold mb-2">
          Corrupt / invalid / stale storage recovery
        </h2>
        <p className="text-[11px] text-on-surface-variant/50 mb-2 max-w-lg leading-relaxed">
          Each button writes directly to localStorage (bypassing the reducer entirely, simulating
          data already sitting in a browser) and then simulates a reload. Every one of these is
          expected to recover to canonical idle.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={injectCorruptJson}>Inject: corrupt JSON</button>
          <button className={button} onClick={injectUnknownSessionId}>Inject: unknown session id</button>
          <button className={button} onClick={injectOutOfRangeStepIndex}>Inject: out-of-range step index</button>
          <button className={button} onClick={injectStalePlayingSession}>Inject: stale playing session (14h old)</button>
        </div>
      </section>

      {currentSession && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-on-surface-variant/60 font-bold mb-2">
            Registered steps for current session ({currentSession.id})
          </h2>
          <ol className="text-xs font-mono space-y-1 text-on-surface-variant/70">
            {currentSession.steps.map((step, index) => (
              <li key={step.id} className={index === currentStepIndex ? 'text-primary font-bold' : ''}>
                {index}. {step.id} — {step.route} {step.skippable ? '(skippable)' : ''}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
};

export const SessionEnginePreview = () => {
  const [remountKey, setRemountKey] = useState(0);

  return (
    <div className="min-h-screen bg-background text-on-surface px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <header>
          <p className="text-[11px] uppercase tracking-[0.14em] text-on-surface-variant/60 font-bold">
            Session Engine Preview — internal only, not linked from navigation
          </p>
          <h1 className="text-2xl font-bold text-primary mt-2">Stage 3C — Ticket Group 2</h1>
          <p className="text-sm text-on-surface-variant/70 mt-1">
            SessionProvider is mounted locally on this page only — the live application's provider
            tree in src/App.jsx is untouched. Nothing here navigates to a real morning route,
            writes Supabase, or modifies AlarmContext.
          </p>
        </header>

        <SessionProvider key={remountKey}>
          <SessionEngineHarness onSimulateReload={() => setRemountKey((k) => k + 1)} />
        </SessionProvider>
      </div>
    </div>
  );
};
