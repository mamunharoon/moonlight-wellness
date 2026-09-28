// Shared guided-media completion — context-aware presentation.
//
// The completion MESSAGE (outcomeMessages.js's own getMediaCompletionMessage)
// is deliberately the same general text everywhere; only the visual tone
// and the two action labels vary by the explicit, allowlisted launch
// context a caller passes as BetaVideoModal's `completionContext.journey`.
// One small lookup, owned here once, so no caller ever hand-rolls its own
// colour classes or duplicates this label table - "one shared
// implementation rather than duplicated page logic" per the approved
// brief.
//
// Every tone below reuses this app's own existing, already-contrast-
// verified tokens (morning-accent/evening-accent/tertiary mint, the same
// -glow shadow tokens Home.jsx/RecommendationCard.jsx/every Morning-
// Stretch-Meditation-routine completion panel this engagement already
// shipped) - never a new colour. 'library' and 'direct' share one neutral
// treatment (this app's existing peach primary, no glow) since neither
// has an established circadian identity of its own.
import { getJourneyPrimaryActionClasses } from './journeyAction';
import { ANYTIME_HANDOFF_EYEBROW, ANYTIME_HANDOFF_PROMPT } from '../components/AnytimeClosingHandoff';

export const MEDIA_COMPLETION_JOURNEYS = Object.freeze(['morning', 'anytime', 'evening', 'library', 'direct']);

// Anytime Visual Flow and Closing Handoff uplift — the overlay's own
// eyebrow ("Session Complete") and closing prompt ("What would you like
// to do next?") are additive/configurable per journey (default: the exact
// original strings, byte-identical for morning/evening/library/direct -
// only 'anytime' now uses the shared handoff's own approved copy,
// imported from AnytimeClosingHandoff.jsx so the eyebrow/prompt text is
// never duplicated in two places).
const DEFAULT_EYEBROW = 'Session Complete';
const DEFAULT_WHAT_NEXT = 'What would you like to do next?';
const EYEBROW_OVERRIDES = { anytime: ANYTIME_HANDOFF_EYEBROW };
const WHAT_NEXT_OVERRIDES = { anytime: ANYTIME_HANDOFF_PROMPT };

const TONE_CLASSES = {
  morning: {
    badge: 'bg-morning-accent/10 border border-morning-accent-tint/25 shadow-morning-glow',
    icon: 'text-morning-accent',
    label: 'text-morning-accent'
  },
  anytime: {
    badge: 'bg-tertiary/10 border border-tertiary-tint/25 shadow-mint-glow',
    icon: 'text-tertiary',
    label: 'text-tertiary'
  },
  evening: {
    badge: 'bg-evening-accent/10 border border-evening-accent-tint/25 shadow-evening-glow',
    icon: 'text-evening-accent',
    label: 'text-evening-accent'
  },
  library: {
    badge: 'bg-primary/10 border border-white/15',
    icon: 'text-primary',
    label: 'text-on-surface-variant'
  },
  direct: {
    badge: 'bg-primary/10 border border-white/15',
    icon: 'text-primary',
    label: 'text-on-surface-variant'
  }
};

// Exact approved labels per context - see the task's own table. Primary
// is always this journey's own affirmative "keep going" action; secondary
// (when present) is the lighter, "leave/browse" alternative. A caller
// that omits `onSecondaryAction` hides the secondary button entirely,
// regardless of journey - the only context where that's actually expected
// is 'direct' ("only when a valid destination exists"), but the omission
// mechanism itself is generic and safe for any journey.
const LABELS = {
  morning: { primary: 'Continue Morning Routine', secondary: 'Choose Another Session' },
  anytime: { primary: 'Choose Another Session', secondary: 'Return Home' },
  evening: { primary: 'Continue Wind-Down', secondary: 'Choose Another Session' },
  library: { primary: 'Explore Another Session', secondary: 'Back to Library' },
  direct: { primary: 'Done', secondary: 'Explore Another Session' }
};

/**
 * Resolves the presentation for one explicit, allowlisted journey value.
 * An unrecognised/missing journey falls back to 'direct' - the same
 * neutral, safe treatment the table itself specifies for "Direct/unknown"
 * - never a crash, never silently borrowing another journey's gold/mint/
 * periwinkle identity.
 * @param {string} journey
 * @returns {{ journey: string, badgeClasses: string, iconClasses: string, labelClasses: string, primaryButtonClasses: string, primaryLabel: string, secondaryLabel: string, eyebrowLabel: string, whatNextLabel: string }}
 */
export const getMediaCompletionPresentation = (journey) => {
  const resolvedJourney = MEDIA_COMPLETION_JOURNEYS.includes(journey) ? journey : 'direct';
  const tone = TONE_CLASSES[resolvedJourney];
  const labels = LABELS[resolvedJourney];
  return {
    journey: resolvedJourney,
    badgeClasses: tone.badge,
    iconClasses: tone.icon,
    labelClasses: tone.label,
    primaryButtonClasses: getJourneyPrimaryActionClasses(resolvedJourney === 'library' || resolvedJourney === 'direct' ? undefined : resolvedJourney),
    primaryLabel: labels.primary,
    secondaryLabel: labels.secondary,
    eyebrowLabel: EYEBROW_OVERRIDES[resolvedJourney] ?? DEFAULT_EYEBROW,
    whatNextLabel: WHAT_NEXT_OVERRIDES[resolvedJourney] ?? DEFAULT_WHAT_NEXT
  };
};
