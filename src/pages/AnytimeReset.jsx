/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ANYTIME_RESET_DURATIONS, ANYTIME_RESET_NEEDS, getCatalogEntryById } from '../lib/mediaCatalog';
import { recommendAnytimeReset } from '../lib/anytimeResetRecommendations';
import { setPendingContent } from '../lib/pendingContent';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { BackButton } from '../components/BackButton';

/*
 * WakeWise — Anytime Reset (Build 15 UX remediation)
 *
 * Home -> Anytime Reset -> What do you need right now? -> How much time
 * do you have? -> Recommendation -> Play -> back to Recommendation.
 * Deliberately modeled on Meditate.jsx's own proven three-step wizard
 * shape (same local-state-only architecture, same guest/query-param
 * restore mechanism, same BetaVideoModal reuse) - Meditate.jsx itself is
 * untouched; this is a genuinely separate route/component/recommendation
 * engine, not a modification of it. Step order is reversed from
 * Meditate's own (need first, duration second) per the approved design.
 *
 * Single-select only (never multi, never a custom text field, never the
 * keyboard) - tap-only by design. State is 100% local component state:
 * no Supabase write, no localStorage, nothing survives a reload except
 * the one-time post-sign-in query-param restore below (need/duration id
 * only, allowlist-validated, stripped immediately after read) - it never
 * touches user_intentions or any other persisted record, so it can
 * neither overwrite the morning intention nor leak between users.
 */
export const AnytimeReset = () => {
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const restoredNeed = searchParams.get('need');
  const restoredDuration = searchParams.get('duration');
  const restoredIsValid =
    restoredNeed &&
    restoredDuration &&
    ANYTIME_RESET_NEEDS.some((n) => n.id === restoredNeed) &&
    ANYTIME_RESET_DURATIONS.some((d) => d.id === restoredDuration);

  const [step, setStep] = useState(() => (restoredIsValid ? 'recommend' : 'need'));
  const [needId, setNeedId] = useState(() => (restoredIsValid ? restoredNeed : null));
  const [durationId, setDurationId] = useState(() => (restoredIsValid ? restoredDuration : null));
  const [optionIndex, setOptionIndex] = useState(0);

  // Post-auth return trip: a matching openId (only meaningful once signed
  // in) auto-opens the video the user originally tapped Start on, without
  // auto-playing it - BetaVideoModal always requires its own explicit tap
  // regardless of how it was opened. Same lazy-initializer pattern as
  // Meditate.jsx/Support.jsx, for the same set-state-in-effect reason
  // (computed once, on mount, not inside an effect).
  const [openVideoId, setOpenVideoId] = useState(() => {
    const openId = searchParams.get('openId');
    return openId && !isGuest && getCatalogEntryById(openId) ? openId : null;
  });
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);

  // Strips consumed restore params immediately so they can never
  // re-trigger on a later re-render, browser back/forward, or a reload
  // after the user has since moved to a different step - same repair
  // Meditate.jsx already carries for the identical reason (see that
  // file's own comment on this exact effect).
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

  const recommendation = needId && durationId ? recommendAnytimeReset({ needId, durationId }) : null;
  const items = recommendation?.items || [];
  const current = items.length > 0 ? items[optionIndex % items.length] : null;
  const openVideo = openVideoId ? getCatalogEntryById(openVideoId) : null;

  const handleSelectNeed = (id) => {
    setNeedId(id);
    setStep('duration');
  };

  const handleSelectDuration = (id) => {
    setDurationId(id);
    setOptionIndex(0);
    setStep('recommend');
  };

  // Required Back semantics: recommendation -> duration -> need -> Home.
  const handleStepBack = () => {
    if (step === 'duration') setStep('need');
    else if (step === 'recommend') setStep('duration');
  };

  const handleChangeTime = () => setStep('duration');
  const handleChangeNeed = () => setStep('need');
  // Never immediately repeats the item just shown while alternatives
  // exist - a plain increment only wraps back to the first item after
  // cycling through every other one, exactly like Meditate.jsx's own
  // handleChooseAnother.
  const handleChooseAnother = () => setOptionIndex((i) => i + 1);

  const returnPath = () => `/anytime-reset?need=${needId}&duration=${durationId}`;

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

  // Closing the video returns to the recommendation step, not out of the
  // journey entirely - required by the approved design.
  const handleVideoClose = () => setOpenVideoId(null);

  const handleClose = () => navigate('/');

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-4">
      <div className="flex items-center justify-between gap-3">
        {step === 'need' ? (
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
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="w-11 h-11 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">close</span>
        </button>
      </div>

      {step === 'need' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <span className="material-symbols-outlined text-primary text-3xl">bolt</span>
            <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight mt-2">Take an Anytime Reset</h1>
            <p className="text-xs text-on-surface-variant">Choose what you need and how much time you have.</p>
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-on-surface">What do you need right now?</h2>
          </div>
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="What do you need right now?">
            {ANYTIME_RESET_NEEDS.map((need) => (
              <button
                key={need.id}
                type="button"
                onClick={() => handleSelectNeed(need.id)}
                aria-pressed={needId === need.id}
                className={`relative p-4 rounded-2xl border text-xs font-semibold text-center transition-all duration-200 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary ${
                  needId === need.id
                    ? 'bg-primary-container/20 border-primary text-primary font-bold shadow-md shadow-primary/5'
                    : 'glass-panel border-white/5 text-on-surface-variant hover:bg-white/10'
                }`}
              >
                {need.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'duration' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">How much time do you have?</h1>
            <p className="text-xs text-on-surface-variant">{ANYTIME_RESET_NEEDS.find((n) => n.id === needId)?.label}</p>
          </div>
          <div className="space-y-3" role="group" aria-label="How much time do you have?">
            {ANYTIME_RESET_DURATIONS.map((duration) => (
              <button
                key={duration.id}
                type="button"
                onClick={() => handleSelectDuration(duration.id)}
                aria-pressed={durationId === duration.id}
                className={`w-full text-left glass-panel rounded-2xl p-5 flex items-center justify-between border transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary ${
                  durationId === duration.id ? 'border-primary bg-primary-container/20' : 'border-white/10 hover:bg-white/5'
                } active:scale-[0.99]`}
              >
                <span className={`text-sm font-bold ${durationId === duration.id ? 'text-primary' : 'text-on-surface'}`}>{duration.label}</span>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
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
              {ANYTIME_RESET_NEEDS.find((n) => n.id === needId)?.label} · {ANYTIME_RESET_DURATIONS.find((d) => d.id === durationId)?.label}
            </p>
          </div>

          {current ? (
            <div className="glass-panel rounded-3xl p-5 space-y-3 border-white/10">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-bold text-on-surface">{current.title}</h2>
                <span className="text-[10px] text-on-surface-variant/70 font-semibold uppercase tracking-wider shrink-0 bg-white/5 px-2 py-1 rounded-full">
                  {formatDuration(current.anytimeReset.durationSeconds)}
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
                <span>Start</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={handleChooseAnother}
                  className="w-full glass-panel text-on-surface-variant py-3 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Choose another
                </button>
              )}
            </div>
          ) : (
            <div className="glass-panel rounded-3xl p-6 text-center space-y-2">
              <span className="material-symbols-outlined text-on-surface-variant/50 text-3xl">search_off</span>
              <p className="text-sm text-on-surface-variant">No reset matches that combination yet.</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleChangeNeed}
              className="flex-1 glass-panel text-on-surface-variant py-3 rounded-full text-xs font-bold uppercase tracking-wider text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px]"
            >
              Change need
            </button>
            <button
              type="button"
              onClick={handleChangeTime}
              className="flex-1 glass-panel text-on-surface-variant py-3 rounded-full text-xs font-bold uppercase tracking-wider text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px]"
            >
              Change time
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
