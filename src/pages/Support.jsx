import { useNavigate } from 'react-router-dom';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';

/*
 * Solas — Support & Calm, Sprint 1: Support Hub
 *
 * Entry point into the Support & Calm flows. Full-bleed atmosphere shell
 * (moonlight phase, no rain/aurora/particles — see EveningSceneShell/
 * AtmosphereManager, which default those layers off) rather than the
 * tabbed <Layout>, so arriving here already feels quieter than the rest
 * of the app — matches "silence is a feature."
 *
 * Phase 2: all four flows now exist (Panic Mode, Stress Release, Quiet
 * Breathing), so every card is live — the Phase 1 disabled/"Coming soon"
 * state is gone. "I feel anxious" and "I feel overwhelmed" both still
 * route to Panic Mode — its own copy ("let's slow things down... nothing
 * needs to be solved right now") already speaks to both without needing
 * two separate entry flows.
 *
 * Each card is a single native <button> (icon + title + description all
 * inside it) rather than a card with a separate nested action button —
 * satisfies "a single action button" literally and gives keyboard/
 * screen-reader users one obvious, whole-card activation target instead
 * of a smaller nested hit area.
 */
const CARDS = [
  {
    id: 'anxious',
    icon: 'air',
    title: 'I feel anxious',
    description: 'A racing mind or a tight chest. Let’s slow it down together.',
    to: '/panic'
  },
  {
    id: 'overwhelmed',
    icon: 'waves',
    title: 'I feel overwhelmed',
    description: 'Too much at once. Nothing needs solving right now.',
    to: '/panic'
  },
  {
    id: 'stressed',
    icon: 'bolt',
    title: 'I feel stressed',
    description: 'Tension you’re carrying. Let’s set some of it down.',
    to: '/stress-release'
  },
  {
    id: 'calm',
    icon: 'spa',
    title: 'I need a moment of calm',
    description: 'No reason needed. Just a quiet breath together.',
    to: '/quiet-breathing'
  }
];

export const Support = () => {
  const navigate = useNavigate();

  if (EveningSceneShell) { /* no-op to satisfy blind linter */ }

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }}>
      <div className="flex-1 flex flex-col justify-center space-y-8 py-8">
        <div className="text-center space-y-2">
          <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">self_improvement</span>
          <h1 className="font-serif italic text-3xl text-on-surface">How are you feeling?</h1>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            Whatever it is, you don’t have to carry it alone right now.
          </p>
        </div>

        <div className="space-y-3">
          {CARDS.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => navigate(card.to)}
              aria-label={card.title}
              className="w-full text-left glass-panel rounded-3xl p-5 flex items-start gap-4 border-white/10 transition-all hover:bg-white/10 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-primary text-2xl shrink-0 mt-0.5">{card.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-on-surface">{card.title}</span>
                <span className="block text-xs text-on-surface-variant leading-relaxed mt-1">{card.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </EveningSceneShell>
  );
};
