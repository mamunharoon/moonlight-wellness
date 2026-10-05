/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExerciseScreenShell } from '../components/journey/ExerciseScreenShell';
import { JourneyHeader } from '../components/journey/JourneyHeader';
import { SelectionRow } from '../components/journey/SelectionRow';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { JourneyGlow } from '../components/JourneyGlow';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { requestBetaVideoUrl, isSignedUrlExpired } from '../lib/betaVideoAccess';
import { setPendingContent } from '../lib/pendingContent';
import { ANYTIME_STRETCH_SESSIONS, getAnytimeStretchSessionById } from '../lib/anytimeStretchCatalog';

/*
 * Anytime Stretch.
 *
 * Reached from AnytimeReset.jsx's own "Or choose another quick reset" row
 * (QUICK_RESET_ALTERNATIVES), exactly like Breathe/Meditate already are -
 * same navigate(path, { state: { journeyTone: 'anytime', ... } }) shape,
 * same standalone-outside-<Layout> placement. Reuses the real shared
 * journey scaffolding wherever practical: ExerciseScreenShell (Morning's
 * own safe-area/header/scroll shell, journeyTone="anytime" for the mint
 * header divider/glow), JourneyHeader (Back/Close), SelectionRow (the
 * exact row AnytimeReset's own Need/Duration steps use, accent="anytime"
 * mint) for picking a session, and getJourneyPrimaryActionClasses('anytime')
 * for the one primary button - the same mint `bg-tertiary text-on-tertiary`
 * token every other Anytime primary action already uses.
 *
 * Playback is intentionally a plain native <audio> element, not
 * MeditationActiveSession's ring/lifecycle-hook machinery - that
 * component is tightly coupled to the Journey Embedding audio lifecycle
 * hook's own duration-picker/silent-timer model, which doesn't fit a
 * fixed-length narrated track. The signed URL itself, though, now comes
 * from the exact same mechanism every other beta exercise uses:
 * requestBetaVideoUrl (src/lib/betaVideoAccess.js) calls the
 * get-beta-video-url Edge Function, which verifies the caller's JWT and
 * signs a short-lived Storage URL server-side - `wellness-videos` stays
 * private throughout, no new auth/access rule invented here. A session's
 * id (S06-S09, see anytimeStretchCatalog.js's own `exerciseId` field) is
 * the only thing ever sent; this page never sees or constructs a Storage
 * path. The view states below (select/loading/playing/complete/error) are
 * this page's own local state only - no Session Engine, no
 * dailyCompletion flag, no localStorage write; a reload always starts
 * over at selection.
 *
 * Only the single supplied narration track plays - no
 * InteractiveAmbientMusic or any other second soundtrack is ever mounted
 * on this page.
 *
 * First-use silent-narration fix (physical-iPhone TestFlight report) —
 * root cause (traced live): selecting a session used to be `async
 * handleSelect`, which `await`ed requestBetaVideoUrl's signed-URL fetch
 * BEFORE the `<audio autoPlay>` element was ever rendered - so the
 * browser's own autoplay attempt always happened from a React render
 * triggered by a resolved network Promise, never synchronously within
 * the tap itself. iOS/WKWebView's gesture-before-unmuted-playback rule
 * does not survive that gap; whether it was actually enforced came down
 * to how fast that one network round trip happened to be. The very
 * first stretch session after a fresh login is the single slowest case
 * (cold connection, a fresh/just-refreshed auth token, a cold Edge
 * Function) - comfortably the most likely real request to land outside
 * whatever grace window WebKit allows, while every later attempt
 * (warm connection, warm function, cached token) often resolves fast
 * enough to still count as "part of" the gesture - matching the reported
 * "first session after login is silent, subsequent attempts work"
 * exactly.
 *
 * Fix: every session's signed URL is now speculatively resolved the
 * moment this page mounts (`preloadedRef` below), while the user is
 * still reading the selection list - the same "resolve ahead of the real
 * gesture, during a natural waiting period" shape already proven
 * elsewhere in this app (InteractiveAmbientMusic.jsx's/
 * meditationAudioController.js's own preload()/start() split). By the
 * time an actual tap lands, the common case has a URL already in hand,
 * so `audio.play()` can run synchronously inside that real gesture - a
 * genuinely zero-async-gap play() call, not a race against network
 * speed. The `<audio>` element itself is therefore no longer
 * conditionally mounted on `view === 'playing'` (it has to already exist
 * for this synchronous call) and no longer carries `autoPlay` (play() is
 * now always an explicit, directly-attributable call, covered by its own
 * catch). A session whose preload hasn't resolved yet (still in flight,
 * or expired after sitting unpicked past the signed URL's 5-minute TTL -
 * isSignedUrlExpired) falls back to the original fetch-on-tap path,
 * unchanged, including its existing guest/unauthorized handling - this
 * fix narrows the window the original bug can occur in, it does not
 * remove the one genuinely unavoidable case (a cold tap faster than any
 * network round trip could ever complete).
 */
const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const AnytimeStretch = () => {
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const [view, setView] = useState('select'); // 'select' | 'loading' | 'playing' | 'complete' | 'error'
  const [selectedId, setSelectedId] = useState(null);
  const [signedUrl, setSignedUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // Real, loaded-metadata duration (the actual file), never the catalog's
  // own upfront estimate once this is available - "respect the actual
  // media duration" in practice, not just in the selection list's copy.
  const [duration, setDuration] = useState(0);
  // Session cover image - resolved via the exact same signed-URL
  // mechanism as the audio itself (requestBetaVideoUrl(session.coverId)),
  // reusing betaVideoManifest.js/get-beta-video-url's existing
  // S06COVER-S09COVER entries (the very same ones the Library card for
  // these four sessions already resolves this same cover through).
  // Unlike the audio URL, this
  // is never on the critical path for the gesture-synchronous play()
  // call below - an image load has no autoplay policy to satisfy, so it
  // always resolves in the background and simply fills in once ready;
  // never blocks or delays playback starting.
  const [coverUrl, setCoverUrl] = useState(null);

  const session = selectedId ? getAnytimeStretchSessionById(selectedId) : null;

  // First-use silent-narration fix — keyed by exerciseId, holds
  // { url, expiresAt } once a session's signed URL has resolved, so
  // handleSelect below can play synchronously within the real tap
  // instead of awaiting a fresh fetch first. A plain ref, not state: this
  // is a background head start with nothing of its own to render.
  const preloadedRef = useRef({});
  // Same head-start idea for each session's cover image, keyed by
  // coverId this time (a separate id/signed-URL from the audio one) -
  // no gesture-timing constraint applies to an <img>, but preloading
  // still means the cover is very likely already in hand by the time a
  // session is tapped, same as the audio.
  const preloadedCoverRef = useRef({});

  // Speculatively resolves every session's signed URL as soon as this
  // screen mounts - see this file's own top-of-file doc comment for the
  // full root-cause trace. Every result is independent and silent: a
  // failed preload (including a guest's unauthorized error) simply never
  // populates preloadedRef for that id, and handleSelect's own existing
  // fetch-on-tap fallback below handles it exactly as before, including
  // opening the sign-in prompt - a background preload must never itself
  // surface a dialog or error state with no tap behind it.
  useEffect(() => {
    let cancelled = false;
    ANYTIME_STRETCH_SESSIONS.forEach((s) => {
      requestBetaVideoUrl(s.exerciseId)
        .then(({ url, expiresAt }) => {
          if (cancelled) return;
          preloadedRef.current[s.exerciseId] = { url, expiresAt };
        })
        .catch(() => {});
      requestBetaVideoUrl(s.coverId)
        .then(({ url, expiresAt }) => {
          if (cancelled) return;
          preloadedCoverRef.current[s.coverId] = { url, expiresAt };
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Back/exit cleanup — stop playback the instant this page leaves the
  // 'playing' view for ANY reason (selecting a different session, Back,
  // Close/unmount), never leaving audio running in the background.
  useEffect(() => {
    if (view !== 'playing') audioRef.current?.pause();
  }, [view]);
  useEffect(() => () => audioRef.current?.pause(), []);

  // Resolves this session's cover image in the background - cache-first
  // (preloadedCoverRef), falling back to a fresh fetch. Deliberately
  // fire-and-forget: never awaited by handleSelect, never blocks or
  // delays audio playback starting, and a failure here simply leaves
  // coverUrl null (the view falls back to the plain icon badge below,
  // the pre-existing baseline - never an error state of its own).
  // Guarded against a fast session-switch race (select A, back, select B
  // before A's own fetch resolves) via currentCoverIdRef - A's `.then`
  // landing after B is already selected must never overwrite B's cover.
  const currentCoverIdRef = useRef(null);
  const resolveCover = (coverId) => {
    currentCoverIdRef.current = coverId;
    const cachedCover = preloadedCoverRef.current[coverId];
    if (cachedCover && !isSignedUrlExpired(cachedCover.expiresAt)) {
      setCoverUrl(cachedCover.url);
      return;
    }
    requestBetaVideoUrl(coverId)
      .then(({ url, expiresAt }) => {
        preloadedCoverRef.current[coverId] = { url, expiresAt };
        if (currentCoverIdRef.current === coverId) setCoverUrl(url);
      })
      .catch(() => {});
  };

  const handleSelect = (id) => {
    const target = getAnytimeStretchSessionById(id);
    setSelectedId(id);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setErrorMessage('');
    setCoverUrl(null);
    resolveCover(target.coverId);

    const audio = audioRef.current;
    const cached = preloadedRef.current[target.exerciseId];
    if (audio && cached && !isSignedUrlExpired(cached.expiresAt)) {
      // The common case (see this file's own top-of-file doc comment):
      // already resolved, so this is a real, synchronous play() call
      // inside the actual tap - the one thing that reliably satisfies
      // iOS/WKWebView's autoplay policy regardless of how the network
      // happens to behave.
      audio.src = cached.url;
      audio.currentTime = 0;
      setSignedUrl(cached.url);
      setView('playing');
      audio.play().catch(() => {
        setErrorMessage("This stretch isn't available right now.");
        setView('error');
      });
      return;
    }

    // Not yet preloaded (still in flight, or this session's own preload
    // failed/expired) - the original fetch-on-tap path, unchanged,
    // including the existing guest/unauthorized handling. Narrower than
    // before (preload above now covers the realistic common case,
    // including the reported first-use-after-login scenario), not
    // eliminated - a tap faster than any network round trip could ever
    // complete still has nothing synchronous to play.
    setSignedUrl(null);
    setView('loading');
    (async () => {
      try {
        const { url, expiresAt } = await requestBetaVideoUrl(target.exerciseId);
        preloadedRef.current[target.exerciseId] = { url, expiresAt };
        setSignedUrl(url);
        setView('playing');
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {
            setErrorMessage("This stretch isn't available right now.");
            setView('error');
          });
        }
      } catch (err) {
        if (err?.code === 'unauthorized') {
          setView('select');
          setSelectedId(null);
          setSignInPromptOpen(true);
          return;
        }
        setErrorMessage(err?.message || "This stretch isn't available right now.");
        setView('error');
      }
    })();
  };

  const handleTogglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  };

  const handleBackFromPlaying = () => {
    setView('select');
    setSelectedId(null);
    setSignedUrl(null);
  };

  const handleEnded = () => setView('complete');

  const handleChooseAnother = () => {
    setSelectedId(null);
    setSignedUrl(null);
    setView('select');
  };

  const handleBackToAnytime = () => navigate('/');

  const handleSignIn = () => {
    setPendingContent({ returnPath: '/anytime-stretch' });
    setSignInPromptOpen(false);
    navigate('/auth');
  };

  const handleCreateAccount = () => {
    setPendingContent({ returnPath: '/anytime-stretch' });
    setSignInPromptOpen(false);
    navigate('/auth?tab=signup');
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <ExerciseScreenShell
      journeyTone="anytime"
      header={
        <JourneyHeader
          showBackButton={view === 'select'}
          backFallback="/"
          onStepBack={handleBackFromPlaying}
          onClose={handleBackToAnytime}
        />
      }
    >
      <JourneyGlow journey="anytime" />

      {/* First-use silent-narration fix — unconditionally mounted (never
          gated on `view === 'playing'`) so audioRef.current already
          exists the instant handleSelect's own synchronous play() call
          needs it; `src` is set imperatively by handleSelect, never as a
          React prop here, so there is exactly one place that ever writes
          it. See this file's own top-of-file doc comment for the full
          root-cause trace. */}
      <audio
        ref={audioRef}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={handleEnded}
      />

      {view === 'select' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <span className="material-symbols-outlined text-tertiary text-3xl" aria-hidden="true">accessibility_new</span>
            <h1 className="font-headline-lg text-3xl text-on-surface font-bold tracking-tight mt-2">Guided Stretch</h1>
            <p className="text-sm text-on-surface-variant">A short, narrated stretch - pick what fits right now.</p>
          </div>
          <div className="space-y-3" role="group" aria-label="Guided Stretch sessions">
            {ANYTIME_STRETCH_SESSIONS.map((s) => (
              <SelectionRow
                key={s.id}
                label={s.title}
                description={formatTime(s.durationSeconds)}
                selected={false}
                onClick={() => handleSelect(s.id)}
                accent="anytime"
                icon="accessibility_new"
                iconAlwaysAccent
              />
            ))}
          </div>
        </div>
      )}

      {view === 'loading' && session && (
        <div className="space-y-6 text-center pt-16">
          <span className="material-symbols-outlined text-tertiary text-4xl animate-spin" aria-hidden="true">progress_activity</span>
          <p className="text-sm text-on-surface-variant">Loading "{session.title}"…</p>
        </div>
      )}

      {view === 'error' && (
        <div className="space-y-6 text-center pt-16">
          <span className="material-symbols-outlined text-on-surface-variant/60 text-4xl" aria-hidden="true">error_outline</span>
          <p className="text-sm text-on-surface-variant">{errorMessage}</p>
          <button
            type="button"
            onClick={() => { setView('select'); setSelectedId(null); }}
            className="block w-full py-3 rounded-xl glass-panel text-on-surface-variant font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/30"
          >
            Back to sessions
          </button>
        </div>
      )}

      {view === 'playing' && session && signedUrl && (
        <div className="space-y-6">
          {/* Stretch playback card — same established card shell Home's own
              Anytime card uses (glass-panel + rounded-3xl + mint border/
              glow + tertiary-tint-tinted background), so the player reads
              as one cohesive surface rather than loose floating elements.
              Back/Close stay outside this card (JourneyHeader, in
              ExerciseScreenShell's own separate header slot) - only the
              icon/title/progress/time/play-pause button live inside it. */}
          <div
            className="glass-panel p-5 rounded-3xl text-center space-y-6 border-tertiary-tint/40 shadow-mint-glow"
            style={{ backgroundColor: 'rgb(var(--color-tertiary-tint) / 0.05)' }}
          >
            <div className="space-y-2 pt-2">
              {/* Session cover, generic-icon fix - same circular slot,
                  same size/border/glow treatment, just filled with the
                  session's real cover photo once resolveCover resolves
                  it. Falls back to the original plain icon badge
                  (unchanged markup) whenever coverUrl isn't available
                  yet or failed to resolve - never a broken-image state. */}
              {coverUrl ? (
                <span className="inline-flex items-center justify-center w-20 h-20 rounded-full overflow-hidden border-2 border-tertiary-tint/30 mx-auto">
                  <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                </span>
              ) : (
                <span className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-tertiary-tint/15 border-2 border-tertiary-tint/30 text-tertiary mx-auto">
                  <span className="material-symbols-outlined text-4xl" aria-hidden="true">accessibility_new</span>
                </span>
              )}
              <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight pt-2">{session.title}</h1>
            </div>

            <div className="space-y-2">
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-tertiary transition-all duration-150" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="text-xs text-on-surface-variant font-semibold">
                {formatTime(currentTime)} / {formatTime(duration || session.durationSeconds)}
              </p>
            </div>

            <button
              type="button"
              onClick={handleTogglePlay}
              aria-label={isPlaying ? 'Pause' : 'Resume'}
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${getJourneyPrimaryActionClasses('anytime')} hover:opacity-90 active:scale-95 transition-all shadow-lg`}
            >
              <span className="material-symbols-outlined text-4xl" aria-hidden="true" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
          </div>
        </div>
      )}

      {view === 'complete' && session && (
        <div className="space-y-6 text-center pt-8">
          <span className="material-symbols-outlined text-tertiary text-5xl" aria-hidden="true">check_circle</span>
          <div className="space-y-1">
            <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Stretch complete</h1>
            <p className="text-sm text-on-surface-variant">Nice work finishing "{session.title}."</p>
          </div>
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={handleBackToAnytime}
              className={`block w-full py-3.5 rounded-xl ${getJourneyPrimaryActionClasses('anytime')} font-bold text-center hover:opacity-90 active:scale-95 transition-all shadow-lg`}
            >
              Back to Anytime
            </button>
            <button
              type="button"
              onClick={handleChooseAnother}
              className="block w-full py-3 rounded-xl glass-panel text-on-surface-variant font-semibold text-center hover:bg-white/10 active:scale-95 transition-all !border-white/30"
            >
              Choose Another Stretch
            </button>
          </div>
        </div>
      )}

      <SignInPromptDialog
        open={signInPromptOpen}
        onSignIn={handleSignIn}
        onCreateAccount={handleCreateAccount}
        onDismiss={() => setSignInPromptOpen(false)}
      />
    </ExerciseScreenShell>
  );
};
