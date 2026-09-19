// Morning-flow redesign — Affirm step: maps the user's own selected
// Morning intention (IntentionSetup.jsx, one of six presets or a custom
// string) to a fixed, pre-written affirmation. Deliberately a pure
// lookup table, never a template that interpolates the user's own text
// into a generated sentence — a custom intention (arbitrary user input)
// always gets the same fixed neutral line, never anything built from
// that input, so nothing here can ever produce unexpected or unsafe text.
export const INTENTION_AFFIRMATIONS = Object.freeze({
  'Stay calm': 'I can meet today with calm and steadiness.',
  'Be grateful': 'I notice and appreciate the good around me.',
  'Be patient': 'I give myself and others the time we need.',
  'Stay focused': 'I give my attention to what matters now.',
  'Take one step forward': 'Small, steady steps create meaningful progress.',
  'Be kind to yourself': 'I can move through today with self-compassion.',
});

// Shown for a custom (non-preset) intention, or when no intention was
// set at all - fixed and neutral, never derived from the user's own text.
export const DEFAULT_AFFIRMATION = 'You can meet whatever today brings with steadiness and care.';

/**
 * @param {string|null|undefined} intention - intentions[0] from AlarmContext
 * @returns {string} the affirmation to show on the Affirm step
 */
export const getAffirmationForIntention = (intention) => {
  if (typeof intention !== 'string') return DEFAULT_AFFIRMATION;
  return INTENTION_AFFIRMATIONS[intention] ?? DEFAULT_AFFIRMATION;
};
