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

      <button
        onClick={() => navigate('/')}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      >
        <span>Return Home</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </button>
    </EveningSceneShell>
  );
};
