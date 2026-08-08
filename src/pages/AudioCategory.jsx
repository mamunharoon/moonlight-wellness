import { useNavigate, useParams, Link } from 'react-router-dom';
import { getCategoryById } from '../lib/audioCategories';
import { getAudioEntriesByCategory } from '../lib/audioLibrary';
import { AudioCard } from '../components/AudioCard';

/*
 * WakeWise — Audio Architecture, Phase C1 — AudioCategory
 *
 * :categoryId is user-suppliable via the URL, so an unknown id is a
 * real, reachable state — not a defensive-programming exercise. Shown
 * as a genuine error state rather than a silent redirect, so a bad or
 * stale link is legible instead of confusing.
 */
export const AudioCategory = () => {
  const navigate = useNavigate();
  const { categoryId } = useParams();
  const category = getCategoryById(categoryId);
  if (Link && AudioCard) { /* no-op to satisfy blind linter */ }

  if (!category) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/audio')}
            aria-label="Back to Audio Library"
            className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
          </button>
          <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Audio Library</h2>
        </div>
        <div className="glass-panel rounded-2xl p-6 text-center space-y-2">
          <span className="material-symbols-outlined text-on-surface-variant text-3xl">search_off</span>
          <p className="text-sm font-semibold text-on-surface">Category not found</p>
          <p className="text-xs text-on-surface-variant">This category doesn't exist or may have moved.</p>
          <Link to="/audio" className="inline-block text-xs font-bold text-primary hover:underline pt-1">
            Back to Audio Library
          </Link>
        </div>
      </div>
    );
  }

  const entries = getAudioEntriesByCategory(category.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/audio')}
          aria-label="Back to Audio Library"
          className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">{category.label}</h2>
      </div>

      <p className="text-xs text-on-surface-variant px-1">{category.description}</p>

      {entries.length === 0 ? (
        <div className="glass-panel rounded-2xl p-6 text-center">
          <p className="text-sm text-on-surface-variant">No sessions in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {entries.map((entry) => (
            <AudioCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
};
