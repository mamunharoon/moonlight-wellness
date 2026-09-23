/* eslint-disable no-unused-vars */
import { AUDIO_CATEGORIES } from '../lib/audioCategories';
import { getAudioEntriesByCategory } from '../lib/audioLibrary';
import { AudioCategoryCard } from '../components/AudioCategoryCard';
import { BackButton } from '../components/BackButton';

/*
 * WakeWise — Audio Architecture, Phase C1 — AudioLibrary hub
 *
 * Reached from Settings' new "Audio Library" row, same "secondary
 * page" placement as Beta/Feedback/Release Notes. All data here is
 * synchronous local content (audioCategories.js/audioLibrary.js), so
 * there's no network loading state on this page — AudioDetails.jsx is
 * where a real async boundary (subscription status) exists.
 */
export const AudioLibrary = () => {
  if (AudioCategoryCard) { /* no-op to satisfy blind linter */ }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallback="/settings" label="Back to Settings" />
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Audio Library</h2>
      </div>

      <p className="text-xs text-on-surface-variant px-1">
        The full library is in active development. Browse what's planned — every session below is marked "Coming soon" until real audio ships.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {AUDIO_CATEGORIES.map((category) => (
          <AudioCategoryCard key={category.id} category={category} count={getAudioEntriesByCategory(category.id).length} />
        ))}
      </div>
    </div>
  );
};
