// Background Music, Phase B — asset-selection logic.
//
// Pure decision logic extracted for direct Vitest coverage (see
// subscriptionStatusMessages.js/routineCardState.js for this codebase's
// established pattern of pulling pure decisions out of components).
// Nothing here touches the Session Engine, Supabase, or the player
// itself — BetaVideoModal.jsx is the only caller, and the actual
// asset-selection ("with music" vs "without music") never happens
// mid-playback; it is resolved once, before the signed-URL fetch, per
// docs/background-music-specification.md §2's own architecture decision
// (pre-mixed variants, not a runtime dual-track player).
//
// EXCLUSION GUARD — id-based, not category-based
// Sleep Soundscapes (and any future music-only content) must NEVER
// receive an additional music layer — the background sound already IS
// the content. `entry.category === 'Sleep Soundscapes'` is the normal
// signal (see mediaCatalog.js), but Beta.jsx's own QA catalogue passes a
// bare BETA_VIDEO_MANIFEST entry directly (no `category` field at all —
// see betaVideoManifest.js's own typedef), so relying on `category`
// alone would silently treat an undefined category as "eligible" for
// that one caller. The SL01-SL08 id prefix is stable and namespace-
// exclusive regardless of which entry shape is passed in, so it's
// checked directly as the authoritative, caller-independent guard.
const SLEEP_SOUNDSCAPE_ID_PREFIX = 'SL';

export const isMusicEligibleEntry = (entry) =>
  Boolean(entry?.id) && !entry.id.startsWith(SLEEP_SOUNDSCAPE_ID_PREFIX);

/**
 * Resolves which BETA_VIDEO_MANIFEST id should actually be requested for
 * playback — the existing narration-only `entry.id` (always valid,
 * always the safe default) or `entry.musicVariantId` (only when every
 * condition holds). Never mutates, never touches storage/network itself.
 *
 * Conditions for the music variant, ALL required:
 *   - `featureEnabled` — the `backgroundMusic` feature flag (see
 *     featureFlags.js), defaulting off, independent of the user's own
 *     saved preference below.
 *   - `musicEnabled` — the user's own persisted choice (musicPreference.js).
 *   - `isMusicEligibleEntry(entry)` — never Sleep Soundscapes/music-only content.
 *   - `entry.musicVariantId` is actually set on this entry (most entries
 *     have none today — no licensed asset exists yet for any of them).
 *   - `getEntryById(entry.musicVariantId)` actually resolves to a real,
 *     registered manifest entry — a `musicVariantId` naming a variant
 *     that hasn't been produced/registered yet must fall back safely,
 *     never request a dead id.
 *
 * Any single failed condition falls back to `entry.id` — narration-only
 * is always a safe, always-valid result.
 */
export const resolvePlaybackId = ({ entry, musicEnabled, featureEnabled, getEntryById }) => {
  if (!entry?.id) return null;

  const wantsMusic = Boolean(featureEnabled) && Boolean(musicEnabled) && isMusicEligibleEntry(entry) && Boolean(entry.musicVariantId);
  if (wantsMusic && typeof getEntryById === 'function' && getEntryById(entry.musicVariantId)) {
    return entry.musicVariantId;
  }
  return entry.id;
};

/** Whether the in-player "Music" toggle should even be shown for this entry. */
export const shouldShowMusicToggle = ({ entry, featureEnabled }) =>
  Boolean(featureEnabled) && isMusicEligibleEntry(entry) && Boolean(entry?.musicVariantId);
