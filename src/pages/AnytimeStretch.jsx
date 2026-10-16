/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExerciseScreenShell } from '../components/journey/ExerciseScreenShell';
import { JourneyHeader } from '../components/journey/JourneyHeader';
import { SelectionRow } from '../components/journey/SelectionRow';
import { SignInPromptDialog } from '../components/SignInPromptDialog';
import { PlusPaywallDialog } from '../components/PlusPaywallDialog';
import { JourneyGlow } from '../components/JourneyGlow';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';
import { requestBetaVideoUrl, isSignedUrlExpired } from '../lib/betaVideoAccess';
import { setPendingContent } from '../lib/pendingContent';
import { ANYTIME_STRETCH_SESSIONS, getAnytimeStretchSessionById } from '../lib/anytimeStretchCatalog';
import { useAuth } from '../context/AuthContext';
import { useUnifiedEntitlement } from '../context/SubscriptionContext';
import { getCatalogEntryById } from '../lib/mediaCatalog';
import { PREMIUM_GATE, resolvePremiumGate } from '../lib/premiumAccess';
import { useWakeLock } from '../hooks/useWakeLock';

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
 * network round trip could ever complete). The preload effect itself is
 * deliberately left untouched by the Phase 2C gate added below - gating
 * it too would risk reintroducing this exact bug if entitlement is still
 * resolving at mount (a brief, common window), and an unentitled
 * preload attempt is already harmless (server-rejected, silently
 * swallowed, see that effect's own comment).
 *
 * Cross-account cache safety - the preload effect is keyed by the
 * resolved `userId` (the same `user && !user.is_anonymous ? user.id :
 * null` shape AlarmContext.jsx already uses), not `[]`. Ordinary
 * navigation already unmounts this page on every real sign-out/account
 * switch in this app today (fresh refs on remount), so this was never
 * reachable through a normal tap - but nothing previously stopped
 * `preloadedRef`/`preloadedCoverRef` from surviving an identity change
 * if this component were ever kept mounted through one (e.g. a silent
 * auth-state event while backgrounded), which would let a tap reuse a
 * signed URL fetched under a PREVIOUS identity's request. The effect now
 * resets both caches and re-preloads from scratch whenever `userId`
 * actually changes, so a stale identity's entries can never be read by a
 * later one - this does not weaken anything above: `handleSelect`'s own
 * isGuest/resolvePremiumGate checks (added below) still run first, on
 * every tap, regardless of what's cached. For the common, unchanged
 * case - one identity for the page's whole lifetime - `userId` never
 * changes, so this adds no extra fetch and the autoplay-timing fix above
 * is completely unaffected.
 *
 * Phase 2C gate (docs/phase-2c-access-specification.md §11a-iii) - this
 * page previously had NO isGuest/entitlement check anywhere, unlike
 * every other content page (Library/Meditate/AnytimeReset/Support/
 * QuietBreathing). The real server-side boundary (get-beta-video-url)
 * was never actually bypassable either way. Correction to this
 * comment's own prior wording: a guest here has no Supabase session at
 * all, not an anonymous one carrying a JWT (AuthContext.jsx's own
 * header - this app has never called `signInAnonymously()`), so a
 * guest's request already reached the server with no Authorization
 * header, hit its 401 "Sign in required" branch, and the pre-existing
 * catch-block below already handled that specific case correctly via
 * `err.code === 'unauthorized'`, even before this round. What was
 * actually missing: a *signed-in* but non-entitled user's 403 had no
 * paywall at all - the catch-block only ever recognised that one 401
 * code, so a 403 fell through to the generic "You don't have access to
 * this beta preview" dead end regardless of who hit it. `handleSelect`
 * now checks isGuest/resolvePremiumGate BEFORE ever calling
 * requestBetaVideoUrl, exactly matching every other page's own
 * pre-check ordering (guest first, then premium) - never relying on
 * catching a server error after the fact, for either case.
 */
const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const AnytimeStretch = () => {
  const navigate = useNavigate();
  const { isGuest, user } = useAuth();
  // Same shape AlarmContext.jsx's own userId already uses - this app has
  // no real anonymous session (AuthContext.jsx's own header), so today
  // this is equivalent to `user?.id ?? null`, but matching the
  // established convention keeps this correct if that ever changes.
  const userId = user && !user.is_anonymous ? user.id : null;
  const entitlement = useUnifiedEntitlement();
  const audioRef = useRef(null);
  const [view, setView] = useState('select'); // 'select' | 'loading' | 'playing' | 'complete' | 'error'
  const [selectedId, setSelectedId] = useState(null);
  const [signedUrl, setSignedUrl] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [signInPromptOpen, setSignInPromptOpen] = useState(false);
  // Phase 2C — the premium paywall, a sibling of signInPromptOpen above:
  // a guest always sees the sign-in prompt first (handleSelect checks
  // isGuest before this), this only ever opens for an already signed-in,
  // non-guest user who tapped a session they aren't currently entitled
  // to. `paywallTargetId` records which session id Retry should
  // re-attempt via handleSelect itself, same shape as AnytimeReset.jsx's
  // own paywallTargetId.
  const [paywallState, setPaywallState] = useState(null);
  const [paywallTargetId, setPaywallTargetId] = useState(null);
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
  // screen mounts (or the resolved identity changes, see this file's own
  // top-of-file doc comment on cross-account cache safety) - see the
  // same comment for the full autoplay-timing root-cause trace. Every
  // result is independent and silent: a failed preload (including a
  // guest's unauthorized error) simply never populates preloadedRef for
  // that id, and handleSelect's own existing fetch-on-tap fallback below
  // handles it exactly as before, including opening the sign-in prompt -
  // a background preload must never itself surface a dialog or error
  // state with no tap behind it.
  //
  // Both refs are reset at the top of this effect, not just declared
  // once at the top of the component: this effect re-runs whenever
  // `userId` changes, and a previous identity's resolved entries must
  // never be readable once a different identity is current - handled
  // here rather than relying solely on `cancelled` (which only guards
  // in-flight promises, not entries a prior identity's requests already
  // wrote before the change).
  useEffect(() => {
    let cancelled = false;
    preloadedRef.current = {};
    preloadedCoverRef.current = {};
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
  }, [userId]);

  // Tester-reported defect: screen sleeps mid-stretch. Mirrors the native
  // onPlay/onPause-driven `isPlaying` state below exactly, so it releases
  // the instant playback actually pauses/ends, not merely when the view
  // changes (see useWakeLock.js's own header for the release mechanics).
  useWakeLock(isPlaying);

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
    // Phase 2C — checked BEFORE any network call, never after catching a
    // server error (see this file's own top-of-file doc comment for why
    // that used to be the only handling, and why it was wrong). Guest
    // first, exactly matching every other page's ordering.
    if (isGuest) {
      setSignInPromptOpen(true);
      return;
    }
    const gate = resolvePremiumGate(getCatalogEntryById(target.exerciseId), entitlement);
    if (gate === PREMIUM_GATE.LOADING) return; // defer — never guess, never flash a paywall before the real read resolves
    if (gate !== PREMIUM_GATE.ALLOWED) {
      setPaywallTargetId(id);
      setPaywallState(gate);
      return;
    }
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

  // Tester-reported defect: the progress bar couldn't seek at all - it was
  // a plain, non-interactive fill div (width driven by progressPercent),
  // never wired to any pointer/keyboard handler. The underlying file is a
  // plain MP3 (no moov-atom/"Fast Start" concept that applies to MP4 -
  // confirmed against betaVideoManifest.js), so nothing about the media
  // itself blocks seeking; this was purely a missing control. The real
  // <audio> element's own currentTime is the single source of truth seeking
  // writes to - the displayed time/progress-fill derive from it exactly as
  // before (onTimeUpdate), so they can never drift out of sync with a seek.
  // No separate "mark complete" logic exists on this page to protect
  // against (see this file's own top doc comment: no dailyCompletion flag,
  // no Session Engine, no momentum credit) - seeking to the very end only
  // ever reaches 'complete' via the real `ended` event once the browser's
  // own playback genuinely catches up to the end, the same as it always
  // could with the native scrubber on any other player in this app.
  const trackRef = useRef(null);
  const seekFromClientX = (clientX) => {
    const el = audioRef.current;
    const track = trackRef.current;
    const total = duration || session?.durationSeconds || 0;
    if (!el || !track || total <= 0) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const fraction = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    el.currentTime = fraction * total;
    setCurrentTime(el.currentTime);
  };
  const isSeekingRef = useRef(false);
  const handleTrackPointerDown = (e) => {
    isSeekingRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    seekFromClientX(e.clientX);
  };
  const handleTrackPointerMove = (e) => {
    if (!isSeekingRef.current) return;
    seekFromClientX(e.clientX);
  };
  const stopSeeking = () => {
    isSeekingRef.current = false;
  };
  const handleTrackKeyDown = (e) => {
    const el = audioRef.current;
    const total = duration || session?.durationSeconds || 0;
    if (!el || total <= 0) return;
    const step = 5; // seconds per key press, matching common player conventions
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      el.currentTime = Math.min(el.currentTime + step, total);
      setCurrentTime(el.currentTime);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      el.currentTime = Math.max(el.currentTime - step, 0);
      setCurrentTime(el.currentTime);
      e.preventDefault();
    } else if (e.key === 'Home') {
      el.currentTime = 0;
      setCurrentTime(0);
      e.preventDefault();
    } else if (e.key === 'End') {
      el.currentTime = total;
      setCurrentTime(total);
      e.preventDefault();
    }
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

  const dismissPaywall = () => {
    setPaywallState(null);
    setPaywallTargetId(null);
  };
  // Re-attempts the exact same tap via handleSelect itself (which
  // re-checks isGuest/the premium gate fresh) rather than duplicating
  // that logic here — if the retry still isn't allowed, handleSelect's
  // own gate re-sets paywallState to whatever the fresh result is.
  const retryPaywall = () => {
    if (!paywallTargetId) return;
    const id = paywallTargetId;
    dismissPaywall();
    handleSelect(id);
  };
  const viewPlusOptions = () => {
    dismissPaywall();
    navigate('/subscription');
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
              {/* Tester-reported defect fix: now a real seek control (click/
                  drag/arrow-keys), same exact visual markup/sizing as
                  before - only pointer/keyboard handlers and ARIA slider
                  semantics were added, nothing about the layout changed. */}
              <div
                ref={trackRef}
                role="slider"
                tabIndex={0}
                aria-label={`Seek ${session.title}`}
                aria-valuemin={0}
                aria-valuemax={Math.round(duration || session.durationSeconds)}
                aria-valuenow={Math.round(currentTime)}
                aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration || session.durationSeconds)}`}
                onPointerDown={handleTrackPointerDown}
                onPointerMove={handleTrackPointerMove}
                onPointerUp={stopSeeking}
                onPointerCancel={stopSeeking}
                onKeyDown={handleTrackKeyDown}
                className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden cursor-pointer touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tertiary"
              >
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
      <PlusPaywallDialog
        open={!!paywallState}
        state={paywallState}
        onViewPlus={viewPlusOptions}
        onRetry={retryPaywall}
        onDismiss={dismissPaywall}
      />
    </ExerciseScreenShell>
  );
};
