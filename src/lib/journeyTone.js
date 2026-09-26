// Shared selected-state / accent token palette for journey-aware
// interactive controls (radio rows, chips, cards, progress rings) across
// Breathing and Meditation's shared components. Extracted from
// BreathingPatternRow.jsx's own original ACCENT_TOKENS (identical
// content, same already-contrast-verified tokens - morning-accent/
// evening-accent/tertiary plus their -tint opacity-safe siblings) so
// Meditation's own controls (MeditationControls.jsx, MeditationSetupPanel.jsx,
// MeditationActiveSession.jsx, MeditationProgressRing.jsx) reuse the exact
// same mapping instead of a second, divergent copy. See
// BreathingPatternRow.jsx's own doc comment for the full history of each
// token (the opacity-on-plain-hex-var bug fixed for morning/evening, and
// why primary's identical bug is left as a pre-existing, separately-
// scoped issue).
export const JOURNEY_TONE_TOKENS = {
  primary: {
    selectedRow: 'bg-primary/10 border-primary',
    unselectedRow: 'bg-surface-container border-primary/50 hover:bg-white/10',
    selectedLabel: 'text-primary font-bold',
    selectedRing: 'border-primary bg-primary',
    unselectedRing: 'border-primary bg-surface-container-lowest',
    dot: 'bg-on-primary',
    focusRing: 'has-[:focus-visible]:ring-primary',
    text: 'text-primary'
  },
  evening: {
    selectedRow: 'bg-evening-accent-tint/10 border-evening-accent',
    unselectedRow: 'bg-surface-container border-evening-accent/55 hover:bg-white/10',
    selectedLabel: 'text-evening-accent font-bold',
    selectedRing: 'border-evening-accent bg-evening-accent',
    unselectedRing: 'border-evening-accent bg-surface-container-lowest',
    dot: 'bg-on-evening-accent',
    focusRing: 'has-[:focus-visible]:ring-evening-accent',
    text: 'text-evening-accent'
  },
  morning: {
    selectedRow: 'bg-morning-accent-tint/10 border-morning-accent',
    unselectedRow: 'bg-surface-container border-morning-accent/55 hover:bg-white/10',
    selectedLabel: 'text-morning-accent font-bold',
    selectedRing: 'border-morning-accent bg-morning-accent',
    unselectedRing: 'border-morning-accent bg-surface-container-lowest',
    dot: 'bg-on-morning-accent',
    focusRing: 'has-[:focus-visible]:ring-morning-accent',
    text: 'text-morning-accent'
  },
  anytime: {
    selectedRow: 'bg-tertiary-tint/10 border-tertiary',
    unselectedRow: 'bg-surface-container border-tertiary/55 hover:bg-white/10',
    selectedLabel: 'text-tertiary font-bold',
    selectedRing: 'border-tertiary bg-tertiary',
    unselectedRing: 'border-tertiary bg-surface-container-lowest',
    dot: 'bg-on-tertiary',
    focusRing: 'has-[:focus-visible]:ring-tertiary',
    text: 'text-tertiary'
  }
};

export const getJourneyToneTokens = (tone) => JOURNEY_TONE_TOKENS[tone] || JOURNEY_TONE_TOKENS.primary;
