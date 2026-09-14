import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { useAuth } from '../context/AuthContext';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';

// Each { id, blurb } pairs a manifest entry with this page's own short,
// contextual line, matching the pattern already established for E05
// here. E05 first since it was already here, E20 appended in the order
// it was assigned to this screen.
const PREPARE_FOR_REST_VIDEOS = [
  { id: 'E05', blurb: 'A short guided video to ease toward sleep.' },
  { id: 'E20', blurb: 'A guided video to quiet a busy mind before rest.' },
  { id: 'E27', blurb: 'A guided video for deep physical relaxation.' },
  { id: 'E30', blurb: 'A guided video to ease you into peaceful sleep.' }
];

// Sleep Sounds: an ordinary WakeWise feature, not beta content - shown
// with the same row/modal as everything else on this page, just without
// any "beta" framing. Presented as its own labelled section so it reads
// as a distinct sound library rather than more guided-exercise rows.
const SLEEP_SOUND_VIDEOS = [
  { id: 'SL01', blurb: 'Settle into the steady rhythm of gentle rain.' },
  { id: 'SL02', blurb: 'Rest with slow waves meeting a quiet shore.' },
  { id: 'SL03', blurb: 'Unwind among soft woodland sounds.' },
  { id: 'SL04', blurb: 'Relax beside the warmth of a gently crackling fire.' },
  { id: 'SL05', blurb: 'Drift off with a soft breeze across an open meadow.' },
  { id: 'SL06', blurb: 'A steady sound to soften surrounding distractions.' },
  { id: 'SL07', blurb: 'A balanced, gentle sound for restful sleep.' },
  { id: 'SL08', blurb: 'A deeper, softer sound for calm and focus.' }
];

/*
 * Stage 4 Batch F6 — PrepareForRest
 *
 * Fifth (terminal-before-completion) step of the evening-wind-down
 * session. "Prepare for Rest" — deliberately not a clinical label like
 * "Sleep Hygiene Checklist". REST_ITEMS below are static, presentational
 * only: no local state, no persistence, no database write, no
 * gamification, per this batch's explicit requirements — there is
 * nothing to check off, only four short lines to read.
 *
 * advanceStep() is guarded exactly like every other Session-Engine-
 * consuming page in this codebase — see Reflection.jsx's own doc comment
 * for the full reasoning. sleepPreparation -> completion is immediately
 * adjacent, so advanceStep() (not advanceToStep) is correct here.
 *
 * Video Integration: additional rows below REST_ITEMS offer E05
 * (Night-time Calm) and E20 (Quieting the Mind) to any signed-in user
 * (guests excluded) — still nothing to check off, REST_ITEMS itself is
 * untouched, and Continue/advanceStep() below are completely unaffected
 * by whether a row is shown or watched. This is the closing step of the
 * routine, right before Completion — the natural place for a night-time
 * calming video, without displacing Gratitude.jsx (an earlier, distinct
 * step) or Reflection.jsx. Access was originally gated on
 * profiles.beta_access; that gate was removed once these videos were
 * approved for general availability in this environment.
 *
 * Sleep Sounds (SL01-SL08): a separate, clearly labelled section below
 * the exercise rows — this is WakeWise's real Sleep Sounds library
 * (Evening Wind-Down → Prepare for Rest → Sleep Sounds → choose sound →
 * play), not beta content, so it carries no "beta" framing beyond
 * reusing the same row/modal components. Same isGuest gate, same single-
 * modal-at-a-time state (openVideoId) as everything else on this page.
 */
const REST_ITEMS = [
  { icon: 'smartphone', text: 'Put your phone down soon.' },
  { icon: 'water_drop', text: 'Have a little water.' },
  { icon: 'lightbulb', text: 'Dim the room.' },
  { icon: 'nights_stay', text: 'Let the day finish.' },
];

export const PrepareForRest = () => {
  const navigate = useNavigate();
  const { state, currentStep, advanceStep } = useSession();
  const { isGuest } = useAuth();
  const [openVideoId, setOpenVideoId] = useState(null);
  const openVideo = openVideoId ? getBetaVideoById(openVideoId) : null;

  if (EveningSceneShell && ProgressIndicator && BetaVideoModal && BetaVideoRow) { /* no-op to satisfy blind linter */ }

  const handleContinue = () => {
    if (state.status === 'playing' && currentStep?.id === 'sleepPreparation') {
      advanceStep();
    }
    navigate('/evening-complete');
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }}>
      <ProgressIndicator activeStep="sleepPreparation" sessionId="evening-wind-down" />

      <div className="flex-1 flex flex-col justify-center space-y-8">
        <h1 className="font-serif italic text-3xl text-on-surface text-center">Prepare for Rest</h1>

        <div className="space-y-4">
          {REST_ITEMS.map((item) => (
            <div key={item.text} className="flex items-center gap-4 glass-panel rounded-2xl p-4">
              <span className="material-symbols-outlined text-primary text-2xl">{item.icon}</span>
              <p className="text-sm text-on-surface">{item.text}</p>
            </div>
          ))}

          {!isGuest && PREPARE_FOR_REST_VIDEOS.map(({ id, blurb }) => {
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
        </div>

        {!isGuest && (
          <div className="space-y-4">
            <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Sleep Sounds</h3>
            <div className="space-y-4">
              {SLEEP_SOUND_VIDEOS.map(({ id, blurb }) => {
                const entry = getBetaVideoById(id);
                if (!entry) return null;
                return (
                  <BetaVideoRow
                    key={id}
                    title={entry.title}
                    description={blurb}
                    duration={entry.durationLabel}
                    onClick={() => setOpenVideoId(id)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleContinue}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
      >
        <span>Continue</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </button>

      {/* Closing this leaves the user right here on Prepare for Rest —
          already "Evening Wind-down", no navigation needed for a return
          path. Continue/advanceStep() above are entirely unaffected. */}
      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={() => setOpenVideoId(null)} />
      )}
    </EveningSceneShell>
  );
};
