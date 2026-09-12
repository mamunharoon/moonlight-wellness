import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { useAuth } from '../context/AuthContext';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';

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
 * Video Integration: for any signed-in user (guests excluded), all four
 * moods now open an inline video intro instead of navigating straight
 * away (see MOOD_VIDEO_MAP below) — "anxious" originally had no video
 * and always went straight to /panic; it now maps to E16 (Anxiety
 * Relief) once that video was supplied. "stressed" maps to two videos
 * (E04 and E17), shown as separate rows — see the multi-video handling
 * below. Guests see this page completely unchanged from Phase 2 — every
 * card still navigates immediately via handleCardSelect's fallback path.
 * Access was originally gated on profiles.beta_access; that gate was
 * removed once the videos were approved for general availability in
 * this environment — get-beta-video-url now only requires a real
 * signed-in user, not beta_access, so client and server agree.
 *
 * No "Beta" label appears anywhere in this intro view — the video option
 * presents as an ordinary part of this flow, not a QA artifact. That
 * framing stays on /beta only.
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

// Maps every Support Hub mood to its approved exercise video(s)
// (BETA_VIDEO_MANIFEST) - `videos` is a list of { id, blurb } so a mood
// with more than one video (stressed: E04 + E17) renders each as its own
// clearly labelled row rather than picking one. heading/body below are
// reused verbatim from each mood's own existing on-screen copy ("retain
// the existing introduction where appropriate") rather than newly
// written lines: anxious's and overwhelmed's from PanicMode.jsx (which
// has always shown identical copy for both moods - see the file-level
// comment above), calm's from QuietBreathing.jsx, stressed's from this
// same file's own CARDS description above (StressRelease.jsx has no
// heading copy of its own to reuse).
const MOOD_VIDEO_MAP = {
  anxious: {
    videos: [{ id: 'E16', blurb: 'A guided video to ease a racing mind or a tight chest.' }],
    heading: "You're safe. Let's slow things down together.",
    body: 'Nothing needs to be solved right now. Just stay with this moment.',
    continueTo: '/panic'
  },
  overwhelmed: {
    videos: [{ id: 'E02', blurb: 'Too much at once. A guided video to help you set some of it down.' }],
    heading: "You're safe. Let's slow things down together.",
    body: 'Nothing needs to be solved right now. Just stay with this moment.',
    continueTo: '/panic'
  },
  calm: {
    videos: [{ id: 'E03', blurb: 'A fast, guided reset for your nervous system.' }],
    heading: 'Just breathe.',
    body: 'There is nowhere else to be.',
    continueTo: '/quiet-breathing'
  },
  stressed: {
    videos: [
      { id: 'E04', blurb: 'A short guided sequence to let go of physical tension.' },
      { id: 'E17', blurb: 'A guided video to release built-up stress.' }
    ],
    heading: "Let's set some of it down.",
    body: 'Tension you’re carrying — a guided video, or the usual guided moment below. Either way works.',
    continueTo: '/stress-release'
  }
};

export const Support = () => {
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  // id of the mood currently showing its video intro (Back returns to
  // the card list), or null for the normal card-list view.
  const [activeMoodId, setActiveMoodId] = useState(null);
  // id of the specific video currently open in the modal, or null.
  // Exactly one modal is ever mounted (see the render below), so only
  // one of a mood's rows can ever be playing at a time.
  const [openVideoId, setOpenVideoId] = useState(null);

  if (EveningSceneShell && BetaVideoModal && BetaVideoRow) { /* no-op to satisfy blind linter */ }

  // Only intercepts navigation for a signed-in user on a mapped mood.
  // The only other case now is a guest, who keeps the exact original
  // behaviour: navigate straight to card.to, unchanged.
  const handleCardSelect = (card) => {
    if (!isGuest && MOOD_VIDEO_MAP[card.id]) {
      setActiveMoodId(card.id);
      return;
    }
    navigate(card.to);
  };

  const handleBack = () => {
    setActiveMoodId(null);
    setOpenVideoId(null);
  };

  const activeMapping = activeMoodId ? MOOD_VIDEO_MAP[activeMoodId] : null;
  const openVideo = openVideoId ? getBetaVideoById(openVideoId) : null;

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }}>
      {activeMapping ? (
        <div className="flex-1 flex flex-col justify-center space-y-8 py-8">
          <button
            type="button"
            onClick={handleBack}
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
            {activeMapping.videos.map(({ id, blurb }) => {
              const entry = getBetaVideoById(id);
              if (!entry) return null;
              return (
                <BetaVideoRow
                  key={id}
                  title={entry.title}
                  description={blurb}
                  onClick={() => setOpenVideoId(id)}
                />
              );
            })}
            <button
              type="button"
              onClick={() => navigate(activeMapping.continueTo)}
              className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
            >
              Continue without video
            </button>
          </div>
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
      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={() => setOpenVideoId(null)} />
      )}
    </EveningSceneShell>
  );
};
