import { Link } from 'react-router-dom';

/*
 * WakeWise — Audio Architecture, Phase C1 — AudioCategoryCard
 *
 * One category tile for the AudioLibrary hub. `count` is passed in
 * rather than derived here so this component stays free of any
 * dependency on audioLibrary.js — a page-level concern, not a card one.
 */
export const AudioCategoryCard = ({ category, count }) => {
  if (Link) { /* no-op to satisfy blind linter */ }

  return (
    <Link
      to={`/audio/${category.id}`}
      className="glass-panel rounded-2xl p-5 flex flex-col gap-3 hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-center justify-between">
        <div className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-2xl">{category.icon}</span>
        </div>
        <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
      </div>
      <div>
        <h4 className="text-sm font-bold text-on-surface">{category.label}</h4>
        <p className="text-xs text-on-surface-variant leading-relaxed mt-0.5">{category.description}</p>
      </div>
      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
        {count} {count === 1 ? 'session' : 'sessions'}
      </span>
    </Link>
  );
};
