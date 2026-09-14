/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { useAuth } from '../context/AuthContext';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { getCachedDurationMinutes } from '../lib/durationCache';
import { BetaVideoModal } from '../components/BetaVideoModal';

/*
 * Mobile navigation repair, Phase 3 — Support Hub ("Need a moment?")
 *
 * Replaces the previous mood -> optional video intro -> "Continue
 * without video" -> a separate hand-built exercise page flow (which the
 * audit found mismatched what it showed against what was actually
 * played, routed "anxious" and "overwhelmed" to the identical /panic
 * page, and offered a bypass around the recommendation entirely). This
 * is now a single direct path:
 *
 *   Need a moment? -> How are you feeling? -> Recommended exercise
 *   (title, explanation, duration, Begin Exercise, Choose Another)
 *   -> Play -> Completion -> Return Home or Choose Another
 *
 * "Recommended exercise" and "Exercise detail" (two separate screens in
 * the requested diagram) are deliberately collapsed into the one
 * 'recommend' view below — the requested detail screen's own content
 * (title, explanation, duration, Begin Exercise, Choose Another) is
 * everything the recommendation already needs to show, so a second,
 * near-identical screen would only add an extra tap with nothing new on
 * it. Noted here as a deliberate simplification, not an omission.
 *
 * Feeling -> exercise mapping matches the requested pairs exactly, reusing
 * existing built pages/videos rather than inventing new content:
 *   anxious      -> Instant Calm (E03) or Deep Breathing (E08)
 *   overwhelmed  -> Overwhelmed Mind (E02) or Grounding (the existing
 *                   5-4-3-2-1 exercise at /grounding)
 *   stressed     -> Release Tension (E04) or Mindful Pause (E09)
 *   need calm    -> 60-Second Reset (the existing breathing visualizer
 *                   at /quiet-breathing) — the only option for this
 *                   mood, so "Choose Another" is not shown for it.
 *
 * "Choose Another" at the recommendation stage cycles between a mood's
 * own two options (never leaves this screen, never re-selects a
 * feeling). "Choose Another" at the completion stage (SupportComplete.jsx)
 * returns to feeling selection, distinct from "Return Home".
 *
 * Access: video options open the existing BetaVideoModal exactly as
 * every other page does — get-beta-video-url requires a real signed-in
 * user, not beta_access, so no gate changed here. Guests can use either
 * mood's interactive option (Grounding, 60-Second Reset — no private
 * media involved) but a video option's Begin Exercise becomes a
 * "Sign in to play" prompt for a guest instead of attempting to open a
 * modal that would just fail server-side.
 */
const CARDS = [
  { id: 'anxious', icon: 'air', title: 'I feel anxious', description: 'A racing mind or a tight chest. Let’s slow it down together.' },
  { id: 'overwhelmed', icon: 'waves', title: 'I feel overwhelmed', description: 'Too much at once. Nothing needs solving right now.' },
  { id: 'stressed', icon: 'bolt', title: 'I feel stressed', description: 'Tension you’re carrying. Let’s set some of it down.' },
  { id: 'calm', icon: 'spa', title: 'I need a moment of calm', description: 'No reason needed. Just a quiet breath together.' }
];

const MOOD_RECOMMENDATIONS = {
  anxious: {
    heading: "You're safe. Let's slow things down together.",
    body: 'Nothing needs to be solved right now. Just stay with this moment.',
    options: [
      { kind: 'video', id: 'E03' },
      { kind: 'video', id: 'E08' }
    ]
  },
  overwhelmed: {
    heading: "You're safe. Let's slow things down together.",
    body: 'Nothing needs to be solved right now. Just stay with this moment.',
    options: [
      { kind: 'video', id: 'E02' },
      {
        kind: 'interactive',
        route: '/grounding',
        title: 'Grounding',
        description: 'A short 5-4-3-2-1 noticing exercise to bring you back to the present moment.',
        duration: '~2 min'
      }
    ]
  },
  stressed: {
    heading: "Let's set some of it down.",
    body: 'Tension you’re carrying — a short guided moment, either way works.',
    options: [
      { kind: 'video', id: 'E04' },
      { kind: 'video', id: 'E09' }
    ]
  },
  calm: {
    heading: 'Just breathe.',
    body: 'There is nowhere else to be.',
    options: [
      {
        kind: 'interactive',
        route: '/quiet-breathing',
        title: '60-Second Reset',
        description: 'A short guided breathing visualizer — inhale, hold, exhale.',
        duration: '~1 min'
      }
    ]
  }
};

export const Support = () => {
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  // id of the mood currently showing its recommendation (Back returns to
  // the card list), or null for the normal card-list view.
  const [activeMoodId, setActiveMoodId] = useState(null);
  const [optionIndex, setOptionIndex] = useState(0);
  // id of the specific video currently open in the modal, or null. Only
  // one modal is ever mounted, so only one option can ever be playing.
  const [openVideoId, setOpenVideoId] = useState(null);

  const mapping = activeMoodId ? MOOD_RECOMMENDATIONS[activeMoodId] : null;
  const option = mapping ? mapping.options[optionIndex % mapping.options.length] : null;
  const openVideo = openVideoId ? getBetaVideoById(openVideoId) : null;

  const handleSelectFeeling = (card) => {
    setActiveMoodId(card.id);
    setOptionIndex(0);
  };

  const handleBack = () => {
    setActiveMoodId(null);
    setOptionIndex(0);
    setOpenVideoId(null);
  };

  const handleChooseAnother = () => {
    setOptionIndex((i) => i + 1);
  };

  const handleBegin = () => {
    if (!option) return;
    if (option.kind === 'interactive') {
      navigate(option.route);
      return;
    }
    if (isGuest) return; // video Begin renders as a sign-in prompt for guests instead — see below
    setOpenVideoId(option.id);
  };

  // Closing the video (finished, or the user closed it early) is the
  // signal this moment is done — advances to the shared Completion
  // screen, matching the requested Play -> Completion step exactly.
  const handleVideoClose = () => {
    setOpenVideoId(null);
    navigate('/support-complete');
  };

  const videoEntry = option?.kind === 'video' ? getBetaVideoById(option.id) : null;
  const cachedMinutes = videoEntry ? getCachedDurationMinutes(videoEntry.id) : null;
  const optionTitle = option?.kind === 'video' ? videoEntry?.title : option?.title;
  const optionDescription = option?.kind === 'video' ? videoEntry?.description : option?.description;
  const optionDuration = option?.kind === 'video' ? (cachedMinutes ? `~${cachedMinutes} min` : 'Guided video') : option?.duration;

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }}>
      {mapping ? (
        <div className="flex-1 flex flex-col justify-center space-y-8 py-8">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back to how are you feeling"
            className="w-11 h-11 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all self-start focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
          </button>

          <div className="text-center space-y-2">
            <h1 className="font-serif italic text-3xl text-on-surface leading-snug">{mapping.heading}</h1>
            <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">{mapping.body}</p>
          </div>

          {option && (
            <div className="glass-panel rounded-3xl p-5 space-y-3 border-white/10">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-bold text-on-surface">{optionTitle}</h2>
                <span className="text-[10px] text-on-surface-variant/70 font-semibold uppercase tracking-wider shrink-0 bg-white/5 px-2 py-1 rounded-full">
                  {optionDuration}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">{optionDescription}</p>

              {option.kind === 'video' && isGuest ? (
                <Link
                  to="/auth"
                  className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
                >
                  <span>Sign in to play</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleBegin}
                  className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                >
                  <span>Begin Exercise</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              )}

              {mapping.options.length > 1 && (
                <button
                  type="button"
                  onClick={handleChooseAnother}
                  className="w-full glass-panel text-on-surface-variant py-3 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Choose Another
                </button>
              )}
            </div>
          )}
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
                onClick={() => handleSelectFeeling(card)}
                aria-label={card.title}
                className="w-full text-left glass-panel rounded-3xl p-5 flex items-start gap-4 border-white/10 transition-all hover:bg-white/10 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]"
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

      {/* Unlike every other BetaVideoModal caller on this page's prior
          version, closing this modal navigates to /support-complete
          rather than just clearing local state — see handleVideoClose. */}
      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={handleVideoClose} />
      )}
    </EveningSceneShell>
  );
};
