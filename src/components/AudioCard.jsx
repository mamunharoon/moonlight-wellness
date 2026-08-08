import { Link } from 'react-router-dom';
import { formatDuration } from '../lib/audioDurations';
import { getDifficultyLabel } from '../lib/audioMetadata';

/*
 * WakeWise — Audio Architecture, Phase C1 — AudioCard
 *
 * One catalogue entry, rendered as a grid tile. Purely presentational —
 * reads only from the `entry` prop, same reusable-component shape as
 * BetaChecklist.jsx's row.
 */
export const AudioCard = ({ entry }) => {
  if (Link) { /* no-op to satisfy blind linter */ }

  return (
    <Link
      to={`/audio/${entry.category}/${entry.id}`}
      className="glass-panel rounded-2xl p-4 flex flex-col gap-2 hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-xl">{entry.icon}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
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
      </div>

      <div>
        <h4 className="text-sm font-bold text-on-surface">{entry.title}</h4>
        <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2">{entry.description}</p>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-on-surface-variant mt-auto pt-1">
        <span className="bg-white/5 border border-white/10 px-2 py-1 rounded">{formatDuration(entry.duration)}</span>
        <span className="bg-white/5 border border-white/10 px-2 py-1 rounded">{getDifficultyLabel(entry.difficulty)}</span>
      </div>
    </Link>
  );
};
