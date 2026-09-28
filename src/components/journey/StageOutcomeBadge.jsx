// Shared per-stage outcome badge (Phase 9 — Truthful Journey Outcomes).
// The genuine stage icon is always the primary visual, rendered by the
// caller (MorningJourneyPathway.jsx/EveningJourneyPathway.jsx). This
// component only ever renders the small ADDITIVE secondary badge in the
// icon's corner - it never replaces the real icon, and it renders nothing
// at all for 'not_started'/'current' (current is communicated by the
// caller's own ring/highlight treatment on the main icon badge, not a
// corner glyph - see the outcome-indicator table in the Phase 9 spec).
// Never colour alone: completed/skipped/ended_early each carry their own
// distinct glyph (check/remove/pause) in addition to colour, and every
// caller also renders an sr-only text suffix alongside this (see
// session/stageStatus.js's STAGE_STATUS_SR_TEXT) - colour and shape are
// never the only channel.
//
// This file exports only this one component - the sr-only text map lives
// in session/stageStatus.js instead, since react-refresh/only-export-
// components (this repo's established Fast Refresh guard) rejects a
// component file that also exports a non-primitive constant.
const TONE_SOLID = Object.freeze({
  morning: 'bg-morning-accent border-surface text-on-morning-accent',
  evening: 'bg-evening-accent border-surface text-on-evening-accent',
});

const MUTED = 'bg-surface-container-lowest border-on-surface-variant/40 text-on-surface-variant';

const GLYPH_BY_STATUS = Object.freeze({
  completed: 'check',
  skipped: 'remove',
  ended_early: 'pause',
});

export const StageOutcomeBadge = ({ status, journeyTone }) => {
  const glyph = GLYPH_BY_STATUS[status];
  if (!glyph) return null;
  const toneClass = status === 'completed' ? TONE_SOLID[journeyTone] : MUTED;
  return (
    <span
      aria-hidden="true"
      className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border flex items-center justify-center ${toneClass}`}
    >
      <span className="material-symbols-outlined text-[8px] leading-none">{glyph}</span>
    </span>
  );
};
