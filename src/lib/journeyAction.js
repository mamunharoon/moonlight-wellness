// WakeWise DEV — journey-aware primary action colour.
//
// Every plain per-page primary CTA in this app (Begin/Continue/Finish -
// the ones that advance the current journey, not a shared component with
// its own `accent` prop) shares one identical literal className today:
// `bg-primary text-on-primary ...`, regardless of which journey (Morning/
// Anytime/Evening) it belongs to. This is the one thing that class string
// needs to vary by - every other class (padding, shadow, rounded-full,
// hover/active, disabled) stays exactly as each page already has it;
// callers splice this in only where `bg-primary text-on-primary` used to
// be, never replacing the whole className.
//
// Object-lookup of literal, complete Tailwind class strings - the same
// established pattern this app already uses for MusicEntryChoice.jsx's
// own 'anytime' accent (`bg-tertiary text-on-tertiary`, no opacity
// modifier - a SOLID fill needs no `-tint` counterpart; the opacity-on-
// hex-var gap (see JourneyGlow.jsx's own doc comment) only ever affects a
// `/<n>` modifier, never a bare token like this one) - so this is
// intentionally not a component or a dynamically-concatenated string:
// Tailwind's content scanner finds these literal substrings in this file
// directly, exactly like Introduction.jsx's WELCOME_CARDS.iconClass
// values already work.
//
// Unknown/omitted journey falls back to the app's own existing generic
// peach primary - never a wrong colour, never a crash - matching every
// other lookup in this codebase (JourneyGlow.jsx returns null for an
// unknown journey since it has no safe visual fallback; a button DOES -
// its own pre-existing peach).
const JOURNEY_PRIMARY_ACTION_CLASSES = {
  morning: 'bg-morning-accent text-on-morning-accent',
  anytime: 'bg-tertiary text-on-tertiary',
  evening: 'bg-evening-accent text-on-evening-accent'
};

export const getJourneyPrimaryActionClasses = (journey) =>
  JOURNEY_PRIMARY_ACTION_CLASSES[journey] ?? 'bg-primary text-on-primary';
