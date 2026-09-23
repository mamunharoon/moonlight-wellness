/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from 'react';
import { requestPilotVideoUrl } from '../lib/pilotVideoAccess';
import { BackButton } from '../components/BackButton';

/*
 * WakeWise — Fast Start pilot comparison — /admin/faststart-pilot
 *
 * DEV-only, approved for controlled DEV deployment alongside the
 * controlled Fast Start remux pilot report. Reachable only through the
 * existing AdminRoute guard (server-verified is_admin(), see App.jsx) —
 * no nav link anywhere points here. To remove this pilot entirely: delete
 * this file, src/lib/pilotVideoAccess.js, supabase/functions/get-pilot-
 * video-url/, and the one route line + one lazy import this needs in
 * App.jsx. Nothing else references any of these four things.
 *
 * Deliberately does NOT reuse BetaVideoModal — that component is on the
 * real playback path for every user, and this pilot has no reason to add
 * risk there. PilotPlayer below reimplements only the specific behaviours
 * this comparison needs to be a fair, representative test: a user-gesture
 * "Begin" gate (matches BetaVideoModal's own handleBegin — .play() is
 * only ever called from a real click), and pause/removeAttribute/load
 * cleanup on unmount or URL change (matches BetaVideoModal's own cleanup
 * effect). Sleep-timer, background-music-toggle and beta-badge UI are
 * out of scope for a codec/container comparison and are intentionally
 * left out.
 */

const PILOT_PAIRS = [
  { key: 'I01', label: 'I01 — Welcome to WakeWise', sizeNote: '7.5 MB / 57s' },
  { key: 'A01', label: 'A01 — Confidence', sizeNote: '18.5 MB / 148s' },
  { key: 'SL01', label: 'SL01 — Rain', sizeNote: '38.2 MB / 312s' }
];

// This project's flat eslint config has no react/jsx-uses-vars equivalent
// (see App.jsx's own file-level disable of this same rule), so a local
// component referenced only via JSX below reads as unused to the base
// no-unused-vars rule.
// eslint-disable-next-line no-unused-vars
const PilotPlayer = ({ pilotId, onClose }) => {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [loadStartedAt] = useState(() => performance.now());
  const [readyAfterMs, setReadyAfterMs] = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus('loading');
      setErrorMessage('');
      setHasStarted(false);
      try {
        const { url } = await requestPilotVideoUrl(pilotId);
        if (cancelled) return;
        setVideoUrl(url);
        setStatus('ready');
        setReadyAfterMs(Math.round(performance.now() - loadStartedAt));
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(e?.message || "Couldn't load this video.");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilotId]);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [videoUrl]);

  const handleClose = () => {
    videoRef.current?.pause();
    onClose();
  };

  const handleBegin = () => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      setStatus('error');
      setErrorMessage("Couldn't start playback.");
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={pilotId}
      onClick={handleClose}
    >
      <div className="w-full max-w-sm glass-panel rounded-3xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-headline-md text-base text-on-surface font-bold truncate">{pilotId}</h3>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-xl">close</span>
          </button>
        </div>

        {readyAfterMs != null && (
          <p className="text-[10px] text-on-surface-variant">Signed URL ready in {readyAfterMs}ms (not first-frame time — see report §5)</p>
        )}

        <div className="relative w-full aspect-[9/16] max-h-[70vh] mx-auto bg-black rounded-2xl overflow-hidden flex items-center justify-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span>
              <span className="text-xs">Loading preview…</span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant">error</span>
              <p role="alert" className="text-xs text-on-surface-variant">{errorMessage}</p>
            </div>
          )}

          {status === 'ready' && videoUrl && (
            <>
              <video
                ref={videoRef}
                key={videoUrl}
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                onError={() => {
                  setStatus('error');
                  setErrorMessage('Playback error (link may have expired — 3 min TTL).');
                }}
                onPlay={() => setHasStarted(true)}
                className="w-full h-full object-contain bg-black"
              />
              {!hasStarted && (
                <button
                  type="button"
                  onClick={handleBegin}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40"
                >
                  <span className="material-symbols-outlined text-5xl text-white">play_circle</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-white">Begin</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const FastStartPilot = () => {
  const [openPilotId, setOpenPilotId] = useState(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallback="/admin" label="Back to Admin" />
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Fast Start Pilot</h2>
      </div>

      <p className="text-xs text-on-surface-variant px-1">
        DEV-only comparison tool. Admin access required. Plays the original catalogue file and a
        losslessly remuxed (moov-before-mdat) copy side by side, one at a time, from short-lived
        signed URLs (3 min). Remove after the pilot decision is made — see
        docs/fast-start-pilot-comparison.md.
      </p>

      <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5">
        {PILOT_PAIRS.map(({ key, label, sizeNote }) => (
          <div key={key} className="p-4 space-y-2">
            <div>
              <p className="text-sm font-semibold text-on-surface">{label}</p>
              <p className="text-[10px] text-on-surface-variant">{sizeNote}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpenPilotId(`${key}-original`)}
                className="flex-1 px-3 py-2 rounded-full glass-panel border-white/10 text-xs font-bold uppercase tracking-wider hover:bg-white/10 active:scale-95 transition-all"
              >
                Original
              </button>
              <button
                type="button"
                onClick={() => setOpenPilotId(`${key}-faststart`)}
                className="flex-1 px-3 py-2 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
              >
                Fast Start pilot
              </button>
            </div>
          </div>
        ))}
      </div>

      {openPilotId && <PilotPlayer pilotId={openPilotId} onClose={() => setOpenPilotId(null)} />}
    </div>
  );
};
