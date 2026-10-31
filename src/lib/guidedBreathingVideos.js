/*
 * Build 15 — shared guided-breathing video catalogue. Single source of
 * truth for Breathe.jsx (Morning) and QuietBreathing.jsx's own standalone
 * branch, so the same 7 real entries never get duplicated/drift between
 * the two pages. Two separate collections (not merged into one flat
 * list), matching the reason BREATHING_SESSION_VIDEOS was originally kept
 * distinct from BREATHE_VIDEOS: "Gentle Breathing Basics" (B01) reads as
 * its own thing next to the existing E08 "Calming Breath Meditation" row,
 * not a duplicate of it — confirmed, not just titled apart, by the
 * 2026-10-30 narration audit (reports/e08-b01-deep-breathing-duplication-
 * review-2026-10-30.md): B01 teaches diaphragmatic breathing without any
 * breath-hold, E08 has a real counted inhale/hold/exhale pattern.
 *
 * blurb below is each row's own short, contextual description shown on
 * Breathe.jsx/EveningBreathing.jsx/QuietBreathing.jsx via BetaVideoRow's
 * `description` prop — distinct from betaVideoManifest.js's own
 * `description` field (shown in Library/Support/search instead). Kept in
 * sync with the manifest's title/description wording as of the
 * 2026-10-30 retitling so neither surface reads inconsistently.
 */
export const BREATHE_VIDEOS = [
  { id: 'E08', blurb: 'A short, guided breathing meditation with gentle counting and brief breath holds.' },
  { id: 'E28', blurb: 'A guided video for slow, mindful breathing.' }
];

// B01-B05: a distinct "Breathing Sessions" collection - see the doc
// comment above for why it stays separate from BREATHE_VIDEOS.
export const BREATHING_SESSION_VIDEOS = [
  { id: 'B01', blurb: 'Learn comfortable belly breathing at your own pace, without holding your breath.' },
  { id: 'B02', blurb: 'A guided video for box breathing.' },
  { id: 'B03', blurb: 'A guided video for 4-7-8 breathing.' },
  { id: 'B04', blurb: 'A guided video for coherent breathing.' },
  { id: 'B05', blurb: 'A guided video for alternate nostril breathing.' }
];

// The real, calculated total (7) - every disclosure header reads this,
// never a hand-typed number.
export const GUIDED_BREATHING_VIDEO_COUNT = BREATHE_VIDEOS.length + BREATHING_SESSION_VIDEOS.length;
