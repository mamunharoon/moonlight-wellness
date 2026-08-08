import { formatDuration } from '../lib/audioDurations';

/*
 * WakeWise — Audio Architecture, Phase C1 — AudioPlayerPlaceholder
 *
 * No audio element, no real playback — see audioEngine.js. This is the
 * visual shape a real player will fill in later: artwork, play/pause,
 * duration, premium/coming-soon badges. Purely presentational — all
 * state (isPlaying) and gating (locked) are owned by the calling page
 * (AudioDetails.jsx), same separation as every other reusable component
 * in this app (e.g. BetaChecklist's row).
 */
export const AudioPlayerPlaceholder = ({ entry, isPlaying, onTogglePlay, locked }) => {
  const disabled = locked || entry.comingSoon;

  return (
    <div className="glass-panel rounded-3xl p-6 flex flex-col items-center gap-4 text-center">
      <div className="relative w-32 h-32 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/10 flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-5xl">{entry.icon}</span>
        {locked && (
          <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-sm">lock</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {entry.premium && (
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
            <span className="material-symbols-outlined text-xs">workspace_premium</span>
            Plus
          </span>
        )}
        {entry.comingSoon && (
          <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant/60 bg-white/5 px-2 py-1 rounded-full">
            Coming soon
          </span>
        )}
      </div>

      <button
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-3xl">{isPlaying ? 'pause' : 'play_arrow'}</span>
      </button>

      <span className="text-xs text-on-surface-variant">{formatDuration(entry.duration)}</span>

      {locked && (
        <p className="text-[10px] text-on-surface-variant">Requires WakeWise Plus</p>
      )}
      {!locked && entry.comingSoon && (
        <p className="text-[10px] text-on-surface-variant">This session is still in production</p>
      )}
    </div>
  );
};
