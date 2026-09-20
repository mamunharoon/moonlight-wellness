/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { BackButton } from '../components/BackButton';
import { INTRODUCTION_MEDIA } from '../lib/introductionMedia';
import { CURRENT_INTRODUCTION_VERSION } from '../lib/introductionVersion';
import { getBetaVideoById } from '../lib/mediaCatalog';
import { useProtectedVideo } from '../hooks/useProtectedVideo';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { SignInPromptDialog } from '../components/SignInPromptDialog';

/*
 * First-use WakeWise introduction. The "Why WakeWise" / "How to Use
 * WakeWise" guide videos (I01/I02 in betaVideoManifest.js) are real,
 * private Storage objects - played through the exact same shared
 * signed-URL mechanism every other private video in this app uses
 * (useProtectedVideo + BetaVideoModal + SignInPromptDialog), never a
 * bespoke player. A guest tap opens the sign-in prompt instead of ever
 * requesting a signed URL - this screen's own copy, guide list and
 * Continue/Skip remain fully usable without watching either video, for
 * both guests and registered users (see introductionMedia.js's own doc
 * comment for the caption-track/future-media state).
 *
 * Reached either automatically (Auth.jsx's redirectAfterAuth, once per
 * successful sign-in/sign-up whose profile.introduction_completed_version
 * is below CURRENT_INTRODUCTION_VERSION) or explicitly via Profile's
 * "About WakeWise" row (a pure replay - see persistAndContinue's own
 * "already at/above current version" short-circuit, which never re-writes
 * or lowers an already-saved version merely because the screen was
 * opened again).
 *
 * Start/Skip both call the exact same persistAndContinue function - one
 * persistence decision, not two. Guest behaviour is explicit: a guest
 * (isGuest/no user) never attempts a Supabase write at all, matching
 * "guests may view/replay Introduction, but no completion write should be
 * attempted for a guest" - they simply continue to Home.
 *
 * Full-bleed, no bottom-nav chrome - same placement as Welcome.jsx/
 * Onboarding.jsx (a focused, single-purpose screen, not part of the
 * tabbed app frame).
 */
const WHAT_YOU_CAN_DO = [
  { icon: 'wb_sunny', text: 'Start your morning with intention' },
  { icon: 'bedtime', text: 'Wind down gently in the evening' },
  { icon: 'self_improvement', text: 'Choose a quick calming practice' },
  { icon: 'spa', text: 'Explore meditation, breathing and sleep experiences' }
];

export const Introduction = () => {
  const navigate = useNavigate();
  const { user, isGuest, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Reuses the exact same shared signed-URL/guest-gating mechanism every
  // other private video in this app already uses (Library, Support,
  // Prepare for Rest, etc.) - resolveEntry is getBetaVideoById rather than
  // useProtectedVideo's own default (the general Library catalog) because
  // I01/I02 are deliberately excluded from that catalog (see
  // mediaCatalog.js's INTERACTIVE_ONLY_IDS) and would never resolve there.
  // A guest tap opens SignInPromptDialog and never calls the Edge
  // Function at all; only one BetaVideoModal is ever mounted (openVideo is
  // a single piece of state), so selecting the other guide while one is
  // open replaces it outright rather than stacking a second player.
  const {
    openVideo,
    handleSelect,
    closeVideo,
    promptOpen,
    dismissPrompt,
    confirmSignIn,
    confirmCreateAccount
  } = useProtectedVideo(undefined, getBetaVideoById);

  const continueToHome = () => navigate('/');

  // Handle profile-row races safely: if the row is temporarily missing
  // (e.g. a fresh sign-up racing AuthContext's own upsert-on-first-load),
  // reuse that EXACT existing ensure-profile mechanism (refreshProfile,
  // which selects, upserts only if missing - never overwriting an
  // existing row's name/preferences - then re-selects) rather than
  // inventing a second, separate profile-creation path here.
  const readIntroductionVersion = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('introduction_completed_version')
      .eq('id', userId)
      .maybeSingle();
    return { data, error };
  };

  const persistAndContinue = async () => {
    // Guest behaviour is explicit: no Supabase write is ever attempted
    // for a guest - viewing/replaying Introduction is fine, persisting
    // completion to an account that doesn't exist is not.
    if (isGuest || !user || !supabase) {
      continueToHome();
      return;
    }
    if (saving) return; // prevent repeated clicks while saving

    setSaving(true);
    setSaveError('');

    let { data: profileRow, error: readError } = await readIntroductionVersion(user.id);

    if (readError) {
      setSaving(false);
      setSaveError("We couldn't save that. Please try again.");
      return;
    }

    if (!profileRow) {
      await refreshProfile();
      ({ data: profileRow, error: readError } = await readIntroductionVersion(user.id));
      if (readError || !profileRow) {
        setSaving(false);
        setSaveError("We couldn't save that. Please try again.");
        return;
      }
    }

    // Replay-safety: never write a value that could reset or lower an
    // already-saved version - if this account is already at or above the
    // current version, there is nothing to persist.
    if ((profileRow.introduction_completed_version ?? 0) >= CURRENT_INTRODUCTION_VERSION) {
      setSaving(false);
      continueToHome();
      return;
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from('profiles')
      .update({ introduction_completed_version: CURRENT_INTRODUCTION_VERSION })
      .eq('id', user.id)
      .select('id');

    setSaving(false);

    // A zero-row update (no error, but nothing matched) is never silently
    // treated as success - something changed underneath us (e.g. the row
    // vanished between the read and this write), so this is surfaced as
    // a retryable failure exactly like a genuine error would be.
    if (updateError || !updatedRows || updatedRows.length !== 1) {
      setSaveError("We couldn't save that. Please try again.");
      return;
    }

    continueToHome();
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-8 max-w-md mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <BackButton fallback="/" />
      </div>

      <div className="text-center space-y-4">
        <span
          className="material-symbols-outlined text-primary text-5xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
          aria-hidden="true"
        >
          spa
        </span>
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">Welcome to WakeWise</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed max-w-sm mx-auto">
            WakeWise helps you begin your morning with intention and end your day with calm. Follow short guided
            routines, choose practices that suit what you need, and move at your own pace.
          </p>
        </div>
      </div>

      <section aria-labelledby="what-you-can-do-heading" className="space-y-3">
        <h2 id="what-you-can-do-heading" className="text-xs font-bold uppercase tracking-widest text-primary text-center">
          What you can do
        </h2>
        <ul className="glass-panel rounded-2xl divide-y divide-white/5 overflow-hidden">
          {WHAT_YOU_CAN_DO.map((item) => (
            <li key={item.text} className="flex items-center gap-3 p-4">
              <span className="material-symbols-outlined text-primary text-xl shrink-0" aria-hidden="true">
                {item.icon}
              </span>
              <span className="text-sm text-on-surface font-medium">{item.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="introduction-guides-heading" className="space-y-3">
        <h2 id="introduction-guides-heading" className="text-xs font-bold uppercase tracking-widest text-primary text-center">
          Introduction guides
        </h2>
        <div className="space-y-3">
          {INTRODUCTION_MEDIA.map((guide) => {
            const cardContent = (
              <>
                <span
                  className="material-symbols-outlined text-on-surface-variant text-2xl shrink-0 mt-0.5"
                  aria-hidden="true"
                >
                  {guide.available ? 'play_circle' : 'movie'}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-on-surface">{guide.title}</h3>
                    {!guide.available && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant bg-white/5 px-2 py-0.5 rounded-full">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">{guide.description}</p>
                </div>
              </>
            );

            // Only an `available` guide (storageRef resolves to a real
            // betaVideoManifest.js id) is ever a real control - an
            // unavailable one stays a plain, non-interactive <div>, same
            // guarantee as before any real asset existed.
            if (!guide.available) {
              return (
                <div key={guide.id} className="glass-panel rounded-2xl p-4 flex items-start gap-3">
                  {cardContent}
                </div>
              );
            }

            return (
              <button
                key={guide.id}
                type="button"
                onClick={() => handleSelect(guide.storageRef)}
                className="w-full text-left glass-panel rounded-2xl p-4 flex items-start gap-3 hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {cardContent}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex-1" />

      <div className="space-y-3 pt-4">
        {saveError && (
          <p role="alert" className="text-xs text-red-400 font-medium text-center">
            {saveError}
          </p>
        )}
        <button
          type="button"
          onClick={persistAndContinue}
          disabled={saving}
          className="w-full py-4 rounded-full bg-primary text-on-primary font-bold text-center hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Start with WakeWise'}
        </button>
        <button
          type="button"
          onClick={persistAndContinue}
          disabled={saving}
          className="w-full py-3 text-center text-xs text-on-surface-variant font-semibold hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full disabled:opacity-60"
        >
          Skip for now
        </button>
      </div>

      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={closeVideo} />
      )}

      <SignInPromptDialog
        open={promptOpen}
        onSignIn={confirmSignIn}
        onCreateAccount={confirmCreateAccount}
        onDismiss={dismissPrompt}
      />
    </div>
  );
};
