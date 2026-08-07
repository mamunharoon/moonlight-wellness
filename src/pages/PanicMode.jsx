import { useNavigate } from 'react-router-dom';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';

/*
 * Solas — Support & Calm, Sprint 1 Phase 1: Panic Mode entry page
 *
 * Per the approved flow architecture, Panic Mode's full sequence is
 * Breathing -> Grounding -> Completion. Breathing is not built this
 * batch, so Begin routes straight to Grounding (the next real page that
 * exists) rather than a placeholder. This file only owns the entry
 * screen itself — Grounding and Completion are separate routes/pages.
 *
 * Skip is a distinct affordance from "skip this prompt" (see
 * Grounding.jsx): it means leaving the flow entirely, so it returns
 * Home rather than advancing forward — matches "invite, never
 * instruct." There is nothing to mark complete by skipping the entry
 * screen, so it does not visit /support-complete.
 */
export const PanicMode = () => {
  const navigate = useNavigate();

  if (EveningSceneShell) { /* no-op to satisfy blind linter */ }

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }}>
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
        <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">self_improvement</span>
        <h1 className="font-serif italic text-3xl text-on-surface leading-snug">
          You're safe.
          <br />
          Let's slow things down together.
        </h1>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          Nothing needs to be solved right now.
          <br />
          Just stay with this moment.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => navigate('/grounding')}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <span>Begin</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button
          onClick={() => navigate('/')}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Skip
        </button>
      </div>
    </EveningSceneShell>
  );
};
