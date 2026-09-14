import { useNavigate } from 'react-router-dom';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';

/*
 * Solas — Support & Calm, Sprint 1 Phase 1: Completion screen
 *
 * Terminal screen for every Support & Calm flow reached this batch
 * (Panic Mode's Skip goes straight Home instead — see PanicMode.jsx —
 * since nothing was completed in that case). Deliberately stateless: no
 * Session Engine, no Supabase, no localStorage. This is not a "session"
 * in that system's sense, and this batch's explicit exclusions rule out
 * any database change or analytics event on arrival here.
 *
 * Mobile navigation repair, Phase 3: added "Choose Another" alongside
 * Return Home, per the required Need-a-moment journey ("Completion ->
 * Return Home or Choose Another"). Distinct from the recommendation
 * screen's own "Choose Another" (which cycles between a mood's two
 * options without leaving Support.jsx) — this one returns to feeling
 * selection so the user can pick a different feeling entirely.
 */
export const SupportComplete = () => {
  const navigate = useNavigate();

  if (EveningSceneShell) { /* no-op to satisfy blind linter */ }

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }}>
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
        <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">self_improvement</span>
        <h1 className="font-serif italic text-3xl text-on-surface">You made it through this moment.</h1>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
          Be gentle with yourself.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => navigate('/')}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <span>Return Home</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button
          onClick={() => navigate('/support')}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Choose Another
        </button>
      </div>
    </EveningSceneShell>
  );
};
