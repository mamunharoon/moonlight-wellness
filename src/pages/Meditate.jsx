/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MEDITATION_DURATION_GROUPS,
  MEDITATION_NEEDS,
  getCatalogEntryById
} from '../lib/mediaCatalog';
import { recommendMeditations } from '../lib/meditationRecommendations';
import { setPendingContent } from '../lib/pendingContent';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { BackButton } from '../components/BackButton';

/*
 * Meditation experience (WakeWise "Meditate")
 *
 * Today -> Meditate -> Choose available time -> Choose current need ->
 * Recommended sessions -> Play -> Completion -> Return to Today or Choose
 * Another. One route (/meditate), three local wizard steps, matching the
 * exact structural pattern Support.jsx already established for the
 * "Need a moment?" flow — reused deliberately rather than inventing a
 * second navigation shape:
 *   - a single top-left back control per step (BackButton on step 1 for
 *     real navigation home; a local "step back" arrow on steps 2-3, same
 *     as Support.jsx's own recommendation-view back button)
 *   - guest Begin -> SignInPromptDialog -> setPendingContent(returnPath)
 *     -> /auth -> back here with the exact same time+need+item restored
 *     via query params, same mechanism as Support.jsx/useProtectedVideo.js
 *   - "Choose Another" cycles between the current recommendation's
 *     results without re-selecting time/need, matching Support.jsx's own
 *     handleChooseAnother
 *   - BetaVideoModal reused completely unchanged — no second player.
 *
 * Refreshing /meditate is always safe: step/durationGroupId/needId are
 * local component state (no other persistence), so a hard refresh always
 * re-initialises to step 1 unless valid ?need=&duration= restore params
 * are present (the post-sign-in return trip), in which case it restores
 * directly to the recommendation step — never a crash, never a stale view.
 */
export const Meditate = () => {
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const restoredNeed = searchParams.get('need');
  const restoredDuration = searchParams.get('duration');
  const restoredIsValid =
    restoredNeed &&
    restoredDuration &&
    MEDITATION_NEEDS.some((n) => n.id === restoredNeed) &&
    MEDITATION_DURATION_GROUPS.some((g) => g.id === restoredDuration);

  const [step, setStep] = useState(() => (restoredIsValid ? 'recommend' : 'duration'));
  const [durationGroupId, setDurationGroupId] = useState(() => (restoredIsValid ? restoredDuration : null));
  const [needId, setNeedId] = useState(() => (restoredIsValid ? restoredNeed : null));
  const [optionIndex, setOptionIndex] = useState(0);

  // Post-auth return trip: a matching openId (only meaningful once signed
  // in) auto-opens the video the user originally tapped Begin on, without
  // auto-playing it — BetaVideoModal always requires its own explicit tap
  // regardless of how it was opened. Same lazy-initializer pattern as
  // Support.jsx/useProtectedVideo.js, for the same set-state-in-effect
  // reason (computed once, on mount, not inside an effect).
  const [openVideoId, setOpenVideoId] = useState(() => {
    const openId = searchParams.get('openId');
    return openId && !isGuest && getCatalogEntryById(openId) ? openId : null;
  });
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);

  // Strips the now-consumed params so they can't re-trigger on a later
  // re-render or a browser back/forward — touches only router state.
  //
  // Back-button repair: `need`/`duration` used to be stripped here only
  // implicitly (never, in fact) — they were read once by the lazy
  // initializers above but left sitting in the URL indefinitely. Any
  // reload while the wizard had since moved to a *different* step (e.g.
  // via "Change need"/"Change time", or the on-screen back arrow on the
  // "What would help right now?" step) re-ran `restoredIsValid` against
  // those same stale params and silently snapped back to the `recommend`
  // step — discarding whatever step the user was actually on, which is
  // exactly what a WKWebView memory reload (a normal iOS event after
  // backgrounding, or after returning from a video's native fullscreen)
  // can trigger. The on-screen back control's own click handler was never
  // broken — confirmed live, it correctly steps `need` -> `duration` — a
  // reload is what silently undid it. Stripping `need`/`duration` here
  // too, the same one-time-restore-then-clear treatment `openId` already
  // got, means a reload after this point always falls through to the
  // step's own local-state default (`duration`) instead of a stale
  // restore target — a predictable, safe landing spot rather than a
  // confusing jump.
  useEffect(() => {
    const hasOpenId = searchParams.get('openId');
    const hasRestoreParams = searchParams.get('need') || searchParams.get('duration');
    if (!hasOpenId && !hasRestoreParams) return;
    const next = new URLSearchParams(searchParams);
    next.delete('openId');
    next.delete('need');
    next.delete('duration');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recommendation = durationGroupId && needId ? recommendMeditations({ durationGroupId, needId }) : null;
  const items = recommendation?.items || [];
  const current = items.length > 0 ? items[optionIndex % items.length] : null;
  const openVideo = openVideoId ? getCatalogEntryById(openVideoId) : null;

  const handleSelectDuration = (id) => {
    setDurationGroupId(id);
    setStep('need');
  };

  const handleSelectNeed = (id) => {
    setNeedId(id);
    setOptionIndex(0);
    setStep('recommend');
  };

  const handleStepBack = () => {
    if (step === 'need') setStep('duration');
    else if (step === 'recommend') setStep('need');
  };

  const handleChangeTime = () => setStep('duration');
  const handleChangeNeed = () => setStep('need');
  const handleChooseAnother = () => setOptionIndex((i) => i + 1);

  const returnPath = () => `/meditate?need=${needId}&duration=${durationGroupId}`;

  const handleBegin = () => {
    if (!current) return;
    if (isGuest) {
      setSignInPromptOpen(true);
      return;
    }
    setOpenVideoId(current.id);
  };

  const handleSignIn = () => {
    setPendingContent({ id: current.id, returnPath: returnPath() });
    setSignInPromptOpen(false);
    navigate('/auth');
  };

  const handleCreateAccount = () => {
    setPendingContent({ id: current.id, returnPath: returnPath() });
    setSignInPromptOpen(false);
    navigate('/auth?tab=signup');
  };

  const handleVideoClose = () => {
    const entry = getCatalogEntryById(openVideoId);
    setOpenVideoId(null);
    navigate('/meditation-complete', {
      state: {
        id: entry.id,
        title: entry.title,
        durationSeconds: entry.meditation?.durationSeconds ?? null
      }
    });
  };

  const durationLabel = (group) => (group.description ? `${group.label} — ${group.description}` : group.label);
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      className="max-w-md w-full mx-auto space-y-8 animate-in fade-in duration-500 pb-4"
      style={{
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))',
        paddingTop: 'calc(1rem + env(safe-area-inset-top))'
      }}
    >
      <div className="flex items-center gap-3">
        {step === 'duration' ? (
          <BackButton fallback="/" />
        ) : (
          <button
            type="button"
            onClick={handleStepBack}
            aria-label="Go back"
            className="w-11 h-11 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
          </button>
        )}
      </div>

      {step === 'duration' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <span className="material-symbols-outlined text-primary text-3xl">spa</span>
            <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight mt-2">How much time do you have?</h1>
            <p className="text-xs text-on-surface-variant">We'll only suggest sessions that genuinely fit.</p>
          </div>
          <div className="space-y-3">
            {MEDITATION_DURATION_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => handleSelectDuration(group.id)}
                className="w-full text-left glass-panel rounded-2xl p-5 flex items-center justify-between border-white/10 hover:bg-white/5 active:scale-[0.99] transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span>
                  <span className="block text-sm font-bold text-on-surface">{group.label}</span>
                  {group.description && (
                    <span className="block text-xs text-on-surface-variant mt-0.5">{group.description}</span>
                  )}
                </span>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'need' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">What would help right now?</h1>
            <p className="text-xs text-on-surface-variant">{durationGroupId && durationLabel(MEDITATION_DURATION_GROUPS.find((g) => g.id === durationGroupId))}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {MEDITATION_NEEDS.map((need) => (
              <button
                key={need.id}
                type="button"
                onClick={() => handleSelectNeed(need.id)}
                className="glass-panel rounded-2xl p-4 text-center hover:bg-white/5 active:scale-95 transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="text-sm font-semibold text-on-surface">{need.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'recommend' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Recommended for you</h1>
            <p className="text-xs text-on-surface-variant">
              {MEDITATION_NEEDS.find((n) => n.id === needId)?.label} · {durationGroupId && durationLabel(MEDITATION_DURATION_GROUPS.find((g) => g.id === durationGroupId))}
            </p>
          </div>

          {current ? (
            <div className="glass-panel rounded-3xl p-5 space-y-3 border-white/10">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-bold text-on-surface">{current.title}</h2>
                <span className="text-[10px] text-on-surface-variant/70 font-semibold uppercase tracking-wider shrink-0 bg-white/5 px-2 py-1 rounded-full">
                  {formatDuration(current.meditation.durationSeconds)}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">{current.description}</p>
              {recommendation.matchQuality === 'closest' && (
                <p className="text-[11px] text-secondary font-semibold uppercase tracking-wider">Closest match</p>
              )}
              <p className="text-xs text-on-surface-variant/80 italic">Why this: {current.matchReason}</p>

              <button
                type="button"
                onClick={handleBegin}
                className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <span>Begin</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={handleChooseAnother}
                  className="w-full glass-panel text-on-surface-variant py-3 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Choose Another
                </button>
              )}
            </div>
          ) : (
            <div className="glass-panel rounded-3xl p-6 text-center space-y-2">
              <span className="material-symbols-outlined text-on-surface-variant/50 text-3xl">search_off</span>
              <p className="text-sm text-on-surface-variant">No session matches that combination yet.</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleChangeTime}
              className="flex-1 glass-panel text-on-surface-variant py-3 rounded-full text-xs font-bold uppercase tracking-wider text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px]"
            >
              Change time
            </button>
            <button
              type="button"
              onClick={handleChangeNeed}
              className="flex-1 glass-panel text-on-surface-variant py-3 rounded-full text-xs font-bold uppercase tracking-wider text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px]"
            >
              Change need
            </button>
          </div>
        </div>
      )}

      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={handleVideoClose} />
      )}
      <SignInPromptDialog
        open={signInPromptOpen}
        onSignIn={handleSignIn}
        onCreateAccount={handleCreateAccount}
        onDismiss={() => setSignInPromptOpen(false)}
      />
    </div>
  );
};
