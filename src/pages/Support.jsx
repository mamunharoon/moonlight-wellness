import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { useAuth } from '../context/AuthContext';
import { fetchOwnBetaAccess } from '../lib/betaAccess';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { BetaVideoModal } from '../components/BetaVideoModal';

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
 * Beta Video Integration: for signed-in beta testers only
 * (profiles.beta_access), three of these four moods — overwhelmed, calm,
 * stressed — now open an inline video intro instead of navigating
 * straight away (see MOOD_VIDEO_MAP below); "anxious" is deliberately
 * excluded and always still goes straight to /panic, since its own beta
 * video hasn't been supplied yet. Non-beta users and guests see this
 * page completely unchanged from Phase 2 — every card still navigates
 * immediately via handleCardSelect's fallback path.
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

// Beta Video Integration: maps a subset of Support Hub moods to their
// approved beta exercise video (BETA_VIDEO_MANIFEST). "anxious" has no
// entry here deliberately — its own video hasn't been supplied yet, so
// it must keep going straight to /panic exactly as before, for every
// user, beta or not. heading/body below are reused verbatim from each
// mood's own existing on-screen copy ("retain the existing introduction
// where appropriate") rather than newly written lines: overwhelmed's
// from PanicMode.jsx, calm's from QuietBreathing.jsx, stressed's from
// this same file's own CARDS description above (StressRelease.jsx has
// no heading copy of its own to reuse).
const MOOD_VIDEO_MAP = {
  overwhelmed: {
    videoId: 'E02',
    heading: "You're safe. Let's slow things down together.",
    body: 'Nothing needs to be solved right now. Just stay with this moment.',
    continueTo: '/panic'
  },
  calm: {
    videoId: 'E03',
    heading: 'Just breathe.',
    body: 'There is nowhere else to be.',
    continueTo: '/quiet-breathing'
  },
  stressed: {
    videoId: 'E04',
    heading: "Let's set some of it down.",
    body: 'Tension you’re carrying — a guided video, or the usual guided moment below. Either way works.',
    continueTo: '/stress-release'
  }
};

export const Support = () => {
  const navigate = useNavigate();
  const { user, isGuest, loading: authLoading } = useAuth();
  const [betaAccess, setBetaAccess] = useState(false);
  // id of the mood currently showing its video intro (Back returns to
  // the card list), or null for the normal card-list view.
  const [activeMoodId, setActiveMoodId] = useState(null);
  const [videoOpen, setVideoOpen] = useState(false);

  if (EveningSceneShell && BetaVideoModal) { /* no-op to satisfy blind linter */ }

  // Same inline fetchOwnBetaAccess check Beta.jsx already does, kept
  // local to this page rather than shared — matches how AdminRoute.jsx
  // and Beta.jsx each already do their own inline version of this
  // pattern in this codebase, rather than a new shared hook.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (authLoading) return;
      if (isGuest) {
        setBetaAccess(false);
        return;
      }
      const value = await fetchOwnBetaAccess(user.id);
      if (!cancelled) setBetaAccess(value);
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [user, isGuest, authLoading]);

  // Only intercepts navigation for a beta tester on a mapped mood.
  // Every other case — a non-beta user, or "anxious" (absent from
  // MOOD_VIDEO_MAP) — keeps the exact original behaviour: navigate
  // straight to card.to, unchanged.
  const handleCardSelect = (card) => {
    if (betaAccess && MOOD_VIDEO_MAP[card.id]) {
      setActiveMoodId(card.id);
      return;
    }
    navigate(card.to);
  };

  const activeMapping = activeMoodId ? MOOD_VIDEO_MAP[activeMoodId] : null;
  const activeVideo = activeMapping ? getBetaVideoById(activeMapping.videoId) : null;

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }}>
      {activeMapping ? (
        <div className="flex-1 flex flex-col justify-center space-y-8 py-8">
          <button
            type="button"
            onClick={() => setActiveMoodId(null)}
            aria-label="Back to how are you feeling"
            className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all self-start focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
          </button>

          <div className="text-center space-y-2">
            <h1 className="font-serif italic text-3xl text-on-surface leading-snug">{activeMapping.heading}</h1>
            <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">{activeMapping.body}</p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <span className="material-symbols-outlined text-lg">play_circle</span>
              <span>Watch Video</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(activeMapping.continueTo)}
              className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
            >
              Continue without video
            </button>
          </div>

          <span className="self-center text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Beta</span>
        </div>
      ) : (
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
                onClick={() => handleCardSelect(card)}
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
      )}

      {/* Closing this returns to the mood intro view above — still
          Support Hub, no navigation involved, which is the return path. */}
      {videoOpen && activeVideo && (
        <BetaVideoModal entry={activeVideo} onClose={() => setVideoOpen(false)} />
      )}
    </EveningSceneShell>
  );
};
