// Phase 9 — Truthful Journey Outcomes: one canonical semantic icon
// mapping, shared by Morning, Anytime and Evening. Journey-stage and
// navigation concepts (Breathe, Meditate, Focus, Stretch, Affirm,
// Reflect, Gratitude, Rest, Need, Time, Reset, Instant Calm, Explore)
// must resolve to the exact same Material Symbol everywhere they
// represent the exact same concept - only the journey's own colour token
// (morning-accent/evening-accent/tertiary) may differ, never the glyph.
//
// Anytime is the approved reference for every concept it already
// defines (AnytimeReset.jsx's own QUICK_RESET_ALTERNATIVES and
// AnytimePathway.jsx's own decision-stage list) - those values are
// copied here verbatim, never re-derived. Concepts Anytime does not
// define (focus, stretch, affirm, reflect, gratitude, rest) keep
// whichever icon this app already used for that concept, EXCEPT
// `meditate`, which previously diverged (Morning/Evening's pathway
// components used 'spa', a lotus-style icon, while Anytime already used
// 'self_improvement', a seated-meditation icon) - `self_improvement` is
// now canonical everywhere, and `stretch` moves off 'self_improvement'
// (which it borrowed before this fix existed) onto 'accessibility_new'
// (Anytime's own body-reset/movement icon, AnytimeReset.jsx's
// NEED_ICONS['body-reset']) so Morning's own Stretch and Meditate
// stages are no longer visually identical to each other.
//
// This module intentionally does NOT cover meditation-style icons
// (Loving-Kindness, Body Scan, ...), breathing-pattern icons (4-4-6, Box
// Breathing, ...), individual reflection/gratitude answer-option icons,
// or Library/audio-catalog content icons - those are deliberately
// different by design and stay exactly as they are; see
// eveningOptionPresentation.js, MorningFlow.jsx's own per-move stretch
// icons, and Library.jsx's category filter for examples that are
// correctly untouched by this mapping.
export const JOURNEY_STAGE_ICONS = Object.freeze({
  focus: 'flag',
  stretch: 'accessibility_new',
  breathe: 'air',
  meditate: 'self_improvement',
  affirm: 'auto_awesome',
  reflect: 'chat_bubble',
  gratitude: 'favorite',
  rest: 'bedtime',
  need: 'psychology',
  time: 'schedule',
  reset: 'auto_awesome',
  instantCalm: 'bolt',
  explore: 'explore'
});
