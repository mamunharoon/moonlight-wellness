import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getAudioEntryById } from '../lib/audioLibrary';
import { getCategoryById } from '../lib/audioCategories';
import { getDifficultyLabel } from '../lib/audioMetadata';
import { getVoiceLabel } from '../lib/audioVoices';
import { getBackgroundLabel } from '../lib/audioBackgrounds';
import { AudioPlayerPlaceholder } from '../components/AudioPlayerPlaceholder';
import { useEntitlements, useSubscription } from '../context/SubscriptionContext';
import { trackEvent } from '../lib/analyticsEvents';

/*
 * WakeWise — Audio Architecture, Phase C1 — AudioDetails
 *
 * The one page in this phase with a real async boundary: subscription
 * status comes from SubscriptionContext (imported read-only, not
 * modified — same pattern as Beta.jsx/Feedback.jsx importing
 * legalContent.js). While it's loading, premium gating is deferred
 * rather than guessed, so a Plus subscriber never sees a flash of
 * "locked" before their real status resolves.
 *
 * FUTURE INTEGRATION POINTS (documented, not wired — each would touch
 * a protected file this phase's rules keep off-limits):
 *  - Session engine: a completed play-through here could mark a
 *    Session Engine step complete.
 *  - Notification engine: notificationScheduler.js already calls
 *    audioEngine.playReminderSound() when a reminder fires (see that
 *    file) — a real engine would let a reminder deep-link here.
 *  - Offline storage: a future download-for-offline action would
 *    cache this entry's audio (Cache API / IndexedDB) — no such layer
 *    exists yet.
 */
export const AudioDetails = () => {
  const navigate = useNavigate();
  const { categoryId, entryId } = useParams();
  const entry = getAudioEntryById(entryId);
  const category = getCategoryById(categoryId);
  const { canUseAudio } = useEntitlements();
  const { loading: subscriptionLoading } = useSubscription();
  const [isPlaying, setIsPlaying] = useState(false);
  if (Link && AudioPlayerPlaceholder) { /* no-op to satisfy blind linter */ }

  const backTo = category ? `/audio/${category.id}` : '/audio';

  if (!entry || entry.category !== categoryId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(backTo)}
            aria-label="Back"
            className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
          </button>
          <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Audio Library</h2>
        </div>
        <div className="glass-panel rounded-2xl p-6 text-center space-y-2">
          <span className="material-symbols-outlined text-on-surface-variant text-3xl">search_off</span>
          <p className="text-sm font-semibold text-on-surface">Session not found</p>
          <p className="text-xs text-on-surface-variant">This session doesn't exist or may have moved.</p>
          <Link to={backTo} className="inline-block text-xs font-bold text-primary hover:underline pt-1">
            Back to {category ? category.label : 'Audio Library'}
          </Link>
        </div>
      </div>
    );
  }

  const locked = !subscriptionLoading && entry.premium && !canUseAudio;

  const handleTogglePlay = () => {
    if (locked || entry.comingSoon) return;
    const next = !isPlaying;
    setIsPlaying(next);
    trackEvent('audio_playback_toggled', { entryId: entry.id, category: entry.category, action: next ? 'play' : 'pause' });
  };

  const metadataRows = [
    { label: 'Difficulty', value: getDifficultyLabel(entry.difficulty) },
    { label: 'Voice', value: getVoiceLabel(entry.voiceType) },
    { label: 'Background', value: getBackgroundLabel(entry.backgroundType) }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(backTo)}
          aria-label={`Back to ${category?.label ?? 'Audio Library'}`}
          className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">{entry.title}</h2>
      </div>

      {subscriptionLoading ? (
        <div className="glass-panel rounded-3xl p-6 text-center">
          <p className="text-xs text-on-surface-variant">Checking your subscription…</p>
        </div>
      ) : (
        <AudioPlayerPlaceholder entry={entry} isPlaying={isPlaying} onTogglePlay={handleTogglePlay} locked={locked} />
      )}

      {locked && (
        <Link
          to="/subscription"
          className="block w-full text-center bg-primary text-on-primary py-3 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all"
        >
          Unlock with WakeWise Plus
        </Link>
      )}

      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">About this session</h3>
        <p className="text-sm text-on-surface-variant leading-relaxed glass-panel rounded-2xl p-4">{entry.description}</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Details</h3>
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5">
          {metadataRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between p-4 min-h-[48px]">
              <span className="text-xs text-on-surface-variant">{row.label}</span>
              <span className="text-sm font-semibold text-on-surface">{row.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
