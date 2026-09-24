// WakeWise — Self-Guided Meditation (IM01) — meditation styles.
//
// Five self-guided styles, one shared neutral instrumental background
// track (IM01 - see betaVideoManifest.js/mediaCatalog.js's own comments
// on that entry) for all of them. No narration, no spoken instructions,
// no cadence-specific cues - prompts below are visual text only, shown on
// the active-session screen per meditationSessionController.js's
// deterministic schedule (getPromptForStyle). Order and copy are exactly
// as specified; Quiet Meditation is the default style everywhere it's
// selected (SelfGuidedMeditation.jsx's initial state).
export const MEDITATION_STYLES = [
  {
    id: 'quiet',
    label: 'Quiet Meditation',
    description: 'Sit quietly with gentle background music',
    prompts: [
      'Allow yourself to be still.',
      'Let thoughts pass without following them.',
      'Return gently to this quiet moment.'
    ]
  },
  {
    id: 'breath-awareness',
    label: 'Breath Awareness',
    description: 'Gently notice each breath',
    prompts: [
      'Notice your natural breath.',
      'Feel each inhale and exhale.',
      'Return gently to the breath.'
    ]
  },
  {
    id: 'mindful-pause',
    label: 'Mindful Pause',
    description: 'Notice your body, thoughts and surroundings',
    prompts: [
      'Notice how your body feels.',
      'Become aware of the space around you.',
      'Allow this moment to be as it is.'
    ]
  },
  {
    id: 'body-awareness',
    label: 'Body Awareness',
    description: 'Gently notice sensations throughout your body',
    prompts: [
      'Notice where your body meets the surface beneath you.',
      'Gently soften your shoulders and jaw.',
      'Notice sensations without needing to change them.',
      'Allow your whole body to settle.'
    ]
  },
  {
    id: 'loving-kindness',
    label: 'Loving-Kindness',
    description: 'Offer kind thoughts to yourself and others',
    prompts: [
      'Offer yourself a moment of kindness.',
      'May you feel calm and supported.',
      'Bring someone you care about gently to mind.',
      'Extend that same kindness outward.'
    ]
  }
];

export const DEFAULT_MEDITATION_STYLE_ID = 'quiet';

export const getMeditationStyleById = (id) => MEDITATION_STYLES.find((style) => style.id === id) || null;

// Deterministic, accessible prompt schedule: divides the session into as
// many equal sections as the style has prompts, and shows the prompt for
// whichever section `elapsedSeconds` currently falls in. Never depends on
// wall-clock jitter or a random choice - the same (elapsedSeconds,
// durationSeconds, promptCount) always yields the same index, so prompts
// change sparingly (promptCount - 1 times per session) rather than on
// every timer tick.
export const getPromptIndexForElapsed = (elapsedSeconds, durationSeconds, promptCount) => {
  if (!promptCount || promptCount <= 1) return 0;
  if (!durationSeconds || durationSeconds <= 0) return 0;
  const sectionLength = durationSeconds / promptCount;
  const index = Math.floor(elapsedSeconds / sectionLength);
  return Math.max(0, Math.min(index, promptCount - 1));
};

export const getPromptForStyle = (style, elapsedSeconds, durationSeconds) => {
  if (!style || !Array.isArray(style.prompts) || style.prompts.length === 0) return '';
  const index = getPromptIndexForElapsed(elapsedSeconds, durationSeconds, style.prompts.length);
  return style.prompts[index];
};
