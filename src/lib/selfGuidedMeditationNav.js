// WakeWise — Self-Guided Meditation — allowlisted entry-context model.
//
// Same shape and same safety guarantee as Library.jsx's own FROM_CONTEXTS:
// an ALLOWLISTED identifier only, never a free-form `returnTo` URL. Each
// key maps to one fixed, hardcoded {fallback, label} pair this file
// itself owns - a caller's `from` value can only SELECT among these
// pre-approved destinations, never supply its own. An unknown, missing, or
// direct/deep-linked value safely resolves to the `home` entry (never
// undefined, never a raw passthrough) - "direct navigation without a valid
// context must fall back safely to Home."
//
// Only `home` and `library` are wired to real entry points in this phase
// (Home's Meditate tile, Library's Self-Guided Meditation entry). `morning`
// and `evening` are deliberately NOT added as keys here yet - the brief is
// explicit that those entry points must not be exposed this phase. Adding
// them later is a one-line addition to this object; no other file needs to
// change.
export const SELF_GUIDED_MEDITATION_CONTEXTS = {
  home: { fallback: '/', label: 'Back to Home' },
  library: { fallback: '/library?category=meditation', label: 'Back to Library' }
};

export const DEFAULT_SELF_GUIDED_MEDITATION_CONTEXT_KEY = 'home';

export const resolveSelfGuidedMeditationContext = (fromValue) =>
  SELF_GUIDED_MEDITATION_CONTEXTS[fromValue] || SELF_GUIDED_MEDITATION_CONTEXTS[DEFAULT_SELF_GUIDED_MEDITATION_CONTEXT_KEY];
