// WakeWise Phase 2 (B4/B6) — a small, shared PRESENTATION model mapping
// this app's existing session outcomes to honest, context-sensitive
// user-facing copy. This never replaces or touches the underlying
// completion architecture (Session Engine's SESSION_STATUS enum in
// sessionReducer.js, dailyCompletion.js's per-day flags, each page's own
// completion-recording logic) - it only decides what to SAY once a page
// has already, correctly, determined which of these four outcomes
// happened. Every caller remains responsible for its own recording
// semantics (never mark 'ended_early'/'skipped'/'interrupted' as
// completed) - this module has no side effects of any kind.
//
// Rotation mirrors greeting.js's own already-established, already-proven
// pattern exactly (local dateKey -> day-count -> index into a fixed
// variant list, modulo its length): stable for the whole local day,
// advances by exactly one variant per real calendar day, cycles
// deterministically through the full set before ever repeating, never
// random, never AI-generated, and falls back to index 0 for a missing/
// unparseable dateKey rather than guessing. Kept as a small local
// duplicate of greeting.js's own dayIndexFromDateKey (not an import from
// it) so this module has no dependency on Home's own greeting concern -
// the two are conceptually unrelated even though they share one proven
// technique.
const dayIndexFromDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  if (!year || !month || !day) return 0;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
};

const pickVariant = (variants, dateKey) => variants[dayIndexFromDateKey(dateKey) % variants.length];

export const OUTCOME = Object.freeze({
  COMPLETED: 'completed',
  ENDED_EARLY: 'ended_early',
  SKIPPED: 'skipped',
  INTERRUPTED: 'interrupted'
});

export const JOURNEY = Object.freeze({
  MORNING: 'morning',
  ANYTIME: 'anytime',
  EVENING: 'evening'
});

// Rotating sets (B6 explicitly asks for these four to vary day to day):
// Morning completion, Anytime completion, Anytime early exit, Evening
// completion. Uplifting for Morning, calming for Anytime, reassuring for
// Evening (B4.5) - never a medical/therapeutic/guaranteed-outcome claim,
// never guilt or streak wording, and 'ended_early' copy never says
// "complete"/shows 100%.
const COMPLETED_MORNING = [
  { headline: 'You started today with intention.', body: 'Your direction is set. Take this feeling with you into the day.' },
  { headline: 'A steady start.', body: "You've given today a calm, clear beginning." },
  { headline: 'Morning well spent.', body: 'Whatever the day brings, you met it with intention first.' },
  { headline: 'You showed up for yourself.', body: 'That quiet effort carries further than it feels like right now.' },
  { headline: 'A grounded beginning.', body: "You've set the tone - the rest of the day gets to follow it." }
];

const COMPLETED_ANYTIME = [
  { headline: 'Reset complete.', body: 'Take a moment to notice how you feel.' },
  { headline: 'A moment well taken.', body: "However brief, that pause was genuinely yours." },
  { headline: 'Nicely done.', body: 'You gave yourself exactly what you needed right now.' },
  { headline: 'Reset, and ready.', body: 'Carry that steadiness into whatever comes next.' },
  { headline: 'You paused, on purpose.', body: 'That small choice counts for more than it seems.' }
];

const COMPLETED_EVENING = [
  { headline: 'Your Evening Wind-Down is complete', body: "You've taken time to reflect, appreciate the day and prepare for rest." },
  { headline: 'The day is gently closed.', body: "You've made space to rest - well earned." },
  { headline: 'Evening well spent.', body: "Whatever today held, you've given it a thoughtful close." },
  { headline: 'Ready for rest.', body: "You've reflected, appreciated, and prepared - that's a full wind-down." },
  { headline: 'A calm end to the day.', body: 'Let the rest of tonight be as unhurried as this was.' }
];

// 'ended_early' - never claims completion, never shows 100%.
const ENDED_EARLY_ANYTIME = [
  { headline: 'A short pause still matters.', body: 'Choose what would support you now.' },
  { headline: 'Even a moment counts.', body: "There's no need to finish something to have it help." },
  { headline: 'That was enough for now.', body: 'Come back to this, or try something else, whenever you\'re ready.' },
  { headline: 'A brief reset, and that\'s fine.', body: "Take what you needed from it - the rest can wait." },
  { headline: 'Stopping here is okay.', body: 'Choose what would support you now, no explanation needed.' }
];

// Single, calm, non-rotating copy for the remaining outcome/journey
// combinations - real, on-tone content rather than a placeholder, but not
// required to vary day to day by B6's own explicit list.
const SINGLE_MESSAGES = {
  morning: {
    ended_early: { headline: 'A short start still counts.', body: 'You can pick this back up whenever it suits you.' },
    skipped: { headline: "That's completely fine.", body: "Let's continue with what feels right this morning." },
    interrupted: { headline: 'Your morning routine paused.', body: 'Would you like to continue?' }
  },
  anytime: {
    skipped: { headline: "That's completely fine.", body: "Let's continue with what feels right today." },
    interrupted: { headline: 'Your session paused.', body: 'Would you like to continue?' }
  },
  evening: {
    ended_early: { headline: 'A short pause still matters.', body: "You've taken a moment for yourself - that's enough for tonight." },
    skipped: { headline: "That's completely fine.", body: "Let's continue winding down at your own pace." },
    interrupted: { headline: 'Your Evening Wind-Down paused.', body: 'Would you like to continue?' }
  }
};

const ROTATING_MESSAGES = {
  morning: { completed: COMPLETED_MORNING },
  anytime: { completed: COMPLETED_ANYTIME, ended_early: ENDED_EARLY_ANYTIME },
  evening: { completed: COMPLETED_EVENING }
};

/**
 * @param {'completed'|'ended_early'|'skipped'|'interrupted'} outcome
 * @param {'morning'|'anytime'|'evening'} journey
 * @param {string} [dateKey] - the caller's own local 'YYYY-MM-DD' (see
 *   timezone.js's getZonedParts) - required only for outcomes that
 *   rotate; ignored otherwise. A missing/invalid dateKey for a rotating
 *   outcome resolves to that set's first variant, never a crash.
 * @returns {{ headline: string, body: string }}
 */
// Honest positive acknowledgement after a single breathing PATTERN
// completes naturally (Breathe.jsx/EveningBreathing.jsx/QuietBreathing.jsx)
// - distinct from getOutcomeMessage above, which speaks to completing an
// entire Morning/Anytime/Evening routine. Reuses this same module's
// journey vocabulary rather than a second, competing outcome model; a
// fixed (non-rotating) single line per journey, since the requirement
// gives exact copy rather than a rotating set. Only ever shown for a
// genuine natural completion - callers gate this the same way they gate
// their own Continue/next action (never for early-exit/skip/interrupted).
const BREATHING_ACKNOWLEDGEMENT = {
  morning: 'Beautifully done. Carry this steady energy into your morning.',
  anytime: 'You gave yourself a moment to reset.',
  evening: 'Let that slower rhythm stay with you as you wind down.'
};
const BREATHING_ACKNOWLEDGEMENT_FALLBACK = 'Thank you for taking this moment for yourself.';

/**
 * @param {'morning'|'anytime'|'evening'|undefined} journey
 * @returns {string}
 */
export const getBreathingAcknowledgement = (journey) =>
  BREATHING_ACKNOWLEDGEMENT[journey] ?? BREATHING_ACKNOWLEDGEMENT_FALLBACK;

// Breathing completed state (mobile correction) — rotating, journey-
// SCOPED pools of short, warm, uplifting acknowledgements (3-8 words, no
// clinical/instructional language, per the approved copy revision) for
// the new dedicated completion panel. Three separate pools (never one
// shared pool with a journey-agnostic pick) so a Morning message can
// never appear during Evening/Anytime, and vice versa. Distinct from
// getBreathingAcknowledgement's single fixed line above (that line is
// still used, unchanged, by EveningBreathing.jsx/QuietBreathing.jsx's own
// inline acknowledgement - out of scope for this fix). Same module, same
// journey/outcome vocabulary, never a competing system: this is purely an
// additive export.
const BREATHING_COMPLETION_GREETINGS = {
  morning: [
    'A brighter morning starts now.',
    'Carry this calm into your day.',
    'You’re ready for what’s ahead.',
    'A steady start makes a difference.',
    'You showed up for yourself.'
  ],
  anytime: [
    'You gave yourself a moment.',
    'A short reset can change things.',
    'Carry this calm with you.',
    'You made space to breathe.',
    'Feeling steadier? Keep it close.'
  ],
  evening: [
    'Let the day soften now.',
    'You’re ready to slow down.',
    'Carry this calm into rest.',
    'The day can wait until tomorrow.',
    'Breathe out. It’s time to unwind.'
  ]
};

// localStorage (not sessionStorage) - deliberately survives across days,
// not just this app session, since "avoid yesterday's greeting" and
// "avoid the immediately-previous greeting" are the same requirement in
// the common case of one breathing completion per journey per day. One
// key PER JOURNEY (never shared across pools, so Morning's last-shown
// index can never affect Evening's own rotation). Still just a single
// lightweight index per journey, never a persisted history/statistics
// table and never a database write (explicitly out of scope for this
// fix). Read/write failures (e.g. localStorage unavailable) degrade
// gracefully to a plain random pick with no repeat-avoidance for that
// one call - never a crash.
const breathingLastGreetingKey = (journey) => `moonlight_breathing_last_greeting_index_${journey}`;

/**
 * Picks one greeting for a single naturally-completed breathing session,
 * from the pool that matches the ACTUAL journey context - never a
 * Morning message during Evening/Anytime or vice versa. Callers must
 * call this exactly once per completion (e.g. via a lazy useState
 * initializer keyed to entering the completed state) and hold the
 * returned string for as long as the completion screen stays mounted -
 * this function itself does not memoize; calling it again picks again.
 * An unrecognised/missing journey falls back to the 'anytime' pool
 * (matching this module's own existing getOutcomeMessage default),
 * never a crash and never a Morning/Evening-specific claim for an
 * unknown context.
 * @param {'morning'|'anytime'|'evening'} [journey]
 * @returns {string}
 */
export const getBreathingCompletionGreeting = (journey) => {
  const pool = BREATHING_COMPLETION_GREETINGS[journey] ?? BREATHING_COMPLETION_GREETINGS.anytime;
  const storageKey = breathingLastGreetingKey(BREATHING_COMPLETION_GREETINGS[journey] ? journey : 'anytime');
  let lastIndex = -1;
  try {
    const stored = localStorage.getItem(storageKey);
    lastIndex = stored !== null ? Number(stored) : -1;
  } catch {
    lastIndex = -1;
  }
  let nextIndex = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && nextIndex === lastIndex) {
    nextIndex = (nextIndex + 1) % pool.length;
  }
  try {
    localStorage.setItem(storageKey, String(nextIndex));
  } catch {
    // best-effort only - a completion still gets a real greeting either way
  }
  return pool[nextIndex];
};

// Morning breathing Back/early-exit correction — a short, honest,
// non-celebratory acknowledgement shown on the pre-start/selection screen
// after the user confirms "Leave Exercise" from the active-exercise Back
// confirmation. Deliberately a separate, single Morning-only pool (per
// the approved brief) rather than overloading getOutcomeMessage's own
// existing SINGLE_MESSAGES.morning.ended_early (a differently-shaped,
// already-tested headline+body pair used elsewhere) - same module,
// same honest "never claims completion" spirit, still not a competing
// architecture. No non-repeat/localStorage tracking here (not requested
// for this pool, unlike the natural-completion greetings above) - a
// plain random pick, selected once per early-exit event by the caller.
const MORNING_BREATHING_EARLY_EXIT_MESSAGES = [
  'A short pause still matters.',
  'You still made time to breathe.',
  'Every mindful moment counts.',
  'Return when it feels right.',
  'Choose what supports you now.'
];

/**
 * Picks one short, Morning-appropriate supportive message for a
 * confirmed early exit from an active breathing exercise (Back -> Leave
 * Exercise). Callers must call this exactly once per early-exit event
 * and hold the returned string for as long as it stays displayed - this
 * function itself does not memoize; calling it again picks again. Never
 * claims completion, never celebratory - distinct from
 * getBreathingCompletionGreeting's own pool, which is reserved for
 * genuine natural completion only.
 * @returns {string}
 */
export const getMorningBreathingEarlyExitMessage = () => {
  const pool = MORNING_BREATHING_EARLY_EXIT_MESSAGES;
  return pool[Math.floor(Math.random() * pool.length)];
};

export const getOutcomeMessage = (outcome, journey = JOURNEY.ANYTIME, dateKey) => {
  const rotatingSet = ROTATING_MESSAGES[journey]?.[outcome];
  if (rotatingSet) return pickVariant(rotatingSet, dateKey);

  const single = SINGLE_MESSAGES[journey]?.[outcome];
  if (single) return single;

  // Defensive fallback only - every real (journey, outcome) pair this app
  // actually uses is covered above; this never claims completion either.
  return { headline: 'Session paused.', body: 'Would you like to continue?' };
};
