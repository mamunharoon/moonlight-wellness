// Usability remediation - Home.jsx's "Change intention" (ActiveIntentionCard)
// reuses this exact same preset list, so the six choices offered there can
// never drift out of sync with IntentionSetup.jsx's own list.
export const INTENTION_PRESETS = Object.freeze([
  'Stay calm',
  'Be grateful',
  'Be patient',
  'Stay focused',
  'Take one step forward',
  'Be kind to yourself'
]);

// Morning-flow redesign — Affirm step: maps the user's own selected
// Morning intention (IntentionSetup.jsx, one of six presets or a custom
// string) to a pre-written affirmation. Deliberately a pure lookup
// table, never a template that interpolates the user's own text into a
// generated sentence — a custom intention (arbitrary user input) always
// gets the same fixed neutral rotation, never anything built from that
// input, so nothing here can ever produce unexpected or unsafe text.
//
// WakeWise Phase 2 (B6) — each preset now maps to FIVE curated variants
// instead of one fixed line, rotating by the caller's own local calendar
// day (same dayIndexFromDateKey % length technique greeting.js/
// outcomeMessages.js already use - stable all day, never re-rolled on
// rerender/reopen, cycles the full set before ever repeating). Each
// preset's own original single line is preserved verbatim as variant 0,
// so a call with no dateKey (every pre-Phase-2 call site/test) resolves
// to the exact original text, byte for byte.
export const INTENTION_AFFIRMATIONS = Object.freeze({
  'Stay calm': [
    'I can meet today with calm and steadiness.',
    'I can breathe, and let this moment be enough.',
    'Calm is available to me any time I choose it.',
    'I can move slower than the day is asking me to.',
    'Steadiness is something I carry with me, not something I wait for.'
  ],
  'Be grateful': [
    'I notice and appreciate the good around me.',
    'There is something worth noticing today, if I look for it.',
    'Gratitude grows the more I make room for it.',
    'I can hold appreciation and hardship in the same day.',
    'Small good things deserve to be noticed too.'
  ],
  'Be patient': [
    'I give myself and others the time we need.',
    'Patience is a gift I can give without running out.',
    'Not everything needs to resolve today.',
    'I can wait without losing my footing.',
    'Slower is still progress.'
  ],
  'Stay focused': [
    'I give my attention to what matters now.',
    'One thing at a time is still moving forward.',
    'I can return my attention here as many times as I need to.',
    'Focus is a practice, not a fixed state.',
    'What I give my attention to today is my choice.'
  ],
  'Take one step forward': [
    'Small, steady steps create meaningful progress.',
    'One step today is still real progress.',
    'I do not need the whole path to be visible to start walking it.',
    'Forward does not have to mean fast.',
    'Every small step counts, including this one.'
  ],
  'Be kind to yourself': [
    'I can move through today with self-compassion.',
    'I deserve the same kindness I offer others.',
    'Being gentle with myself is not the same as giving up.',
    'I can be a steady, kind voice for myself today.',
    'I am allowed to be a work in progress.'
  ],
});

// Shown for a custom (non-preset) intention, or when no intention was
// set at all - fixed and neutral, never derived from the user's own
// text. DEFAULT_AFFIRMATION (singular, still exported) is the first of
// these variants - unchanged for any existing direct reference.
export const DEFAULT_AFFIRMATION_VARIANTS = [
  'You can meet whatever today brings with steadiness and care.',
  'Whatever today holds, you can meet it one moment at a time.',
  'You get to decide what today means to you.',
  'You are allowed to take today at your own pace.',
  'Today does not have to be perfect to be worthwhile.'
];
export const DEFAULT_AFFIRMATION = DEFAULT_AFFIRMATION_VARIANTS[0];

// Local-day rotation - mirrors greeting.js's own established
// dayIndexFromDateKey pattern exactly (see outcomeMessages.js's own
// identical local copy and its doc comment for the full rationale).
const dayIndexFromDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  if (!year || !month || !day) return 0;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
};

/**
 * @param {string|null|undefined} intention - intentions[0]/intentions[1]
 *   from AlarmContext
 * @param {string} [dateKey] - the caller's own local 'YYYY-MM-DD' (see
 *   timezone.js's getZonedParts); omitted or invalid resolves to index 0
 *   (each preset's own original line) rather than guessing.
 * @returns {string} the affirmation to show on the Affirm step
 */
export const getAffirmationForIntention = (intention, dateKey) => {
  const variants = typeof intention === 'string' ? INTENTION_AFFIRMATIONS[intention] : undefined;
  const pool = variants ?? DEFAULT_AFFIRMATION_VARIANTS;
  return pool[dayIndexFromDateKey(dateKey) % pool.length];
};
