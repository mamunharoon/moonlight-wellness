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

// Shared completion-greeting architecture (Morning Stretch/Meditation/
// routine correction) — ONE rotating-pool system, keyed by BOTH journey
// (morning/anytime/evening) AND completed practice (breathing/stretching/
// meditation/routine), used by every natural-completion panel in the app.
// Extends the breathing-only pool this module already shipped (mobile
// correction #3/Morning breathing completion correction) into this same
// two-dimensional shape rather than standing up a second, competing
// system - `getBreathingCompletionGreeting` below is now a thin,
// byte-for-byte-compatible wrapper over `getCompletionGreeting`, so
// Breathe.jsx (already approved and physical-iPhone-tested) needs no
// changes at all. Each (journey, practice) pool is short, warm, uplifting
// (3-8 words, no clinical/instructional language) and completely
// separate from every other pool - a Morning message can never leak into
// Anytime/Evening, and Stretch/Meditation/routine messages can never leak
// into each other, by construction (each is its own array, its own
// storage key).
const COMPLETION_GREETINGS = {
  morning: {
    breathing: [
      'A brighter morning starts now.',
      'Carry this calm into your day.',
      'You’re ready for what’s ahead.',
      'A steady start makes a difference.',
      'You showed up for yourself.'
    ],
    stretching: [
      'Your body is awake and ready.',
      'Carry this energy into your morning.',
      'A little movement makes a difference.',
      'You’ve made a strong start.',
      'Your morning is already in motion.'
    ],
    meditation: [
      'Your mind has room to breathe.',
      'Carry this clarity with you.',
      'You made space for stillness.',
      'Hold onto this quiet moment.',
      'A calmer morning continues here.'
    ],
    routine: [
      'Step into your day with confidence.',
      'Carry this positive energy forward.',
      'Your morning has a clear direction.',
      'You’re ready for the day ahead.',
      'Take this calm and confidence with you.'
    ]
  },
  // Anytime completion correction — breathing's own wording replaced with
  // the exact copy approved for this pass (the earlier pool was never
  // wired to any live UI yet - QuietBreathing.jsx/SelfGuidedMeditation.jsx
  // still called the older single getBreathingAcknowledgement('anytime')/
  // getOutcomeMessage('anytime') strings until this pass); meditation is
  // a new pool. Anytime's own stretching/routine equivalents don't exist
  // (Anytime has no Stretch step and no dedicated whole-routine-completion
  // screen of its own) - out of scope, not merely deferred.
  anytime: {
    breathing: [
      'You gave yourself a moment.',
      'Carry this calm with you.',
      'A short reset can shift your day.',
      'You made space to breathe.',
      'You’re ready for what comes next.'
    ],
    meditation: [
      'You made room for yourself.',
      'Let this calm stay with you.',
      'A few quiet minutes matter.',
      'Carry this clearer feeling forward.',
      'You chose a moment of stillness.'
    ],
    // Anytime Visual Flow and Closing Handoff uplift — the shared closing
    // handoff (AnytimeClosingHandoff.jsx) reuses this exact same rotating-
    // pool architecture for Anytime-origin guided media/Instant Calm
    // completions, replacing the generic, journey-agnostic
    // getMediaCompletionMessage() pool BetaVideoModal.jsx otherwise uses
    // for every other journey (morning/evening/library/direct, all
    // unaffected). A natural extension of this file's own established
    // (journey, practice) shape, not a new architecture.
    media: [
      'You gave yourself a reset.',
      'That pause was worth it.',
      'You made space to reset.',
      'A short reset can shift your day.',
      'You’re ready for what comes next.'
    ]
  },
  // Evening Breathing/Meditation completion correction — breathing's own
  // wording replaced with the exact copy approved for this pass (the
  // earlier placeholder pool was never wired to any UI yet - EveningBreathing.jsx
  // still called the older single getBreathingAcknowledgement('evening')
  // string until this pass); meditation is a new pool. Evening's own
  // stretching/routine equivalents don't exist (Evening has no Stretch
  // step and no dedicated 100%-completion screen of its own) - out of
  // scope, not merely deferred.
  evening: {
    breathing: [
      'Let the day soften now.',
      'Breathe out. You can slow down.',
      'Carry this calm toward rest.',
      'You’ve made space to unwind.',
      'The day can begin to fade.'
    ],
    meditation: [
      'Your mind can settle now.',
      'Let this stillness stay with you.',
      'You’ve made room for rest.',
      'The day can wait until tomorrow.',
      'Ease gently into your evening.'
    ],
    // Rotating 100% Evening completion messages correction — real found
    // defect: EveningComplete.jsx (this journey's own whole-routine
    // completion screen, distinct from a single breathing/meditation
    // practice) still used the OLDER getOutcomeMessage/ROTATING_MESSAGES
    // architecture, whose day-of-year-based rotation (pickVariant, top of
    // this file) only ever changes once every 5 calendar days per user -
    // indistinguishable from "stuck" across any single test session,
    // unlike this shared architecture's own per-completion, session-
    // stable, avoid-immediate-repeat rotation every other practice
    // already uses. This 'routine' pool is EveningComplete.jsx's exact
    // Morning/Anytime counterpart - there is no Morning/Anytime
    // 'routine' pool yet (Morning's own SessionComplete.jsx and Anytime
    // have no equivalent shared-architecture migration in this pass),
    // but the key shape (journey, practice) is the same one this whole
    // module already uses everywhere else.
    routine: [
      'You’ve made space to unwind.',
      'Let the day settle now.',
      'You’re ready to rest.',
      'Carry this calm into the night.',
      'The day can wait until tomorrow.',
      'You showed up for yourself tonight.',
      'Rest gently. You’ve done enough today.'
    ]
  }
};

// localStorage (not sessionStorage) - deliberately survives across days,
// not just this app session, since "avoid yesterday's greeting" and
// "avoid the immediately-previous greeting" are the same requirement in
// the common case of one completion per journey+practice per day. One key
// PER (journey, practice) PAIR - never shared across pools, so e.g.
// Morning Stretch's last-shown index can never affect Morning Meditation's
// or Evening Breathing's own rotation. Still just a single lightweight
// index per pool, never a persisted history/statistics table and never a
// database write (explicitly out of scope). Read/write failures (e.g.
// localStorage unavailable) degrade gracefully to a plain random pick
// with no repeat-avoidance for that one call - never a crash.
const completionGreetingKey = (journey, practice) => `moonlight_completion_greeting_last_index_${journey}_${practice}`;

/**
 * Picks one greeting for a single naturally-completed activity, from the
 * pool that matches BOTH the actual journey AND the actual completed
 * practice - never a Morning message during Evening/Anytime, never a
 * Stretch message for a Meditation completion, or vice versa in either
 * dimension. Callers must call this exactly once per completion (e.g.
 * via a lazy useState initializer, or inside the one interval callback
 * that detects natural completion) and hold the returned string for as
 * long as the completion screen stays mounted - this function itself
 * does not memoize; calling it again picks again. An unrecognised/
 * missing (journey, practice) combination - including every Anytime/
 * Evening practice not yet built - falls back to the same honest,
 * generic line getBreathingAcknowledgement's own fallback already uses,
 * never a crash and never silently borrowing a different journey's or
 * practice's real copy.
 * @param {{ journey: 'morning'|'anytime'|'evening', practice: 'breathing'|'stretching'|'meditation'|'routine' }} params
 * @returns {string}
 */
export const getCompletionGreeting = ({ journey, practice }) => {
  const pool = COMPLETION_GREETINGS[journey]?.[practice];
  if (!pool) return BREATHING_ACKNOWLEDGEMENT_FALLBACK;
  const storageKey = completionGreetingKey(journey, practice);
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

/**
 * Backward-compatible wrapper over getCompletionGreeting - Breathe.jsx
 * (already approved and physical-iPhone-tested) keeps calling this exact
 * name/signature unchanged. An unrecognised/missing journey falls back to
 * the 'anytime' breathing pool (matching this module's own existing
 * getOutcomeMessage default), never a crash.
 * @param {'morning'|'anytime'|'evening'} [journey]
 * @returns {string}
 */
export const getBreathingCompletionGreeting = (journey) =>
  getCompletionGreeting({ journey: COMPLETION_GREETINGS[journey] ? journey : 'anytime', practice: 'breathing' });

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

// Shared guided-media completion — one general-purpose pool, used
// identically regardless of launch context (Morning/Anytime/Evening/
// Library/Direct all show the SAME message text; only the surrounding
// visual tone and actions vary by context - see
// mediaCompletionPresentation.js and BetaVideoModal.jsx's own
// `completionContext` prop). Deliberately general enough to apply across
// Breathing/Stretching/Meditation/Grounding/Reflection/Affirmations/Calm &
// Support and every other genuine guided wellness video - never shown for
// Sleep Soundscapes (looping media never fires the natural `ended` event
// this pool is gated on) or onboarding/QA/admin content (BetaVideoModal's
// callers there never pass a completionContext at all).
const MEDIA_COMPLETION_MESSAGES = [
  'Thank you for taking this time.',
  'You made space for yourself.',
  'A mindful moment well spent.',
  'We hope this brought you some calm.',
  'You gave yourself time to reset.',
  'Carry what felt helpful with you.',
  'Come back whenever you need.',
  'You showed up for yourself today.',
  'Even a few mindful minutes matter.',
  'Take this feeling into what comes next.'
];

// Fisher-Yates - a genuinely random ORDER each cycle, not just a random
// pick each call (which is what getCompletionGreeting's own simpler
// avoid-immediate-repeat mechanism does, and is not strong enough for "show
// all ten before a new cycle").
const shuffle = (list) => {
  const shuffled = [...list];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const MEDIA_MESSAGE_BAG_KEY = 'moonlight_media_completion_bag';
const MEDIA_MESSAGE_LAST_KEY = 'moonlight_media_completion_last_message';

/**
 * Picks one message for a genuine natural completion of a guided media
 * item (BetaVideoModal.jsx's own shared completion overlay). A small
 * shuffled-bag cycle, not simple unrestricted random selection: draws
 * messages one at a time from a locally-persisted, pre-shuffled "bag"
 * (localStorage, never sensitive data, never a database write) so all ten
 * messages are shown before any one repeats, and reshuffles a fresh bag
 * only once the current one is exhausted - guarding against the new bag's
 * own first pick repeating the immediately-previous message shown at the
 * old bag's end. Callers must call this exactly once per genuine natural
 * completion (never during render, never twice for the same completion -
 * BetaVideoModal.jsx guards this via its own hasEnded transition) and hold
 * the returned string for as long as the completion overlay stays
 * mounted. Degrades safely with no localStorage: still returns a real,
 * freshly-shuffled pick every call, just without the "no repeat until
 * exhausted" guarantee across calls.
 * @returns {string}
 */
export const getMediaCompletionMessage = () => {
  const pool = MEDIA_COMPLETION_MESSAGES;
  let bag = [];
  let lastMessage = null;
  try {
    const storedBag = localStorage.getItem(MEDIA_MESSAGE_BAG_KEY);
    bag = storedBag ? JSON.parse(storedBag) : [];
    lastMessage = localStorage.getItem(MEDIA_MESSAGE_LAST_KEY);
  } catch {
    bag = [];
    lastMessage = null;
  }
  // Defensive against a stale persisted bag no longer matching this pool
  // (e.g. the pool itself was ever edited) - never crashes, never shows a
  // message this pool doesn't actually contain.
  bag = Array.isArray(bag) ? bag.filter((message) => pool.includes(message)) : [];
  if (bag.length === 0) {
    bag = shuffle(pool);
    if (bag.length > 1 && bag[0] === lastMessage) {
      [bag[0], bag[1]] = [bag[1], bag[0]];
    }
  }
  const [next, ...rest] = bag;
  try {
    localStorage.setItem(MEDIA_MESSAGE_BAG_KEY, JSON.stringify(rest));
    localStorage.setItem(MEDIA_MESSAGE_LAST_KEY, next);
  } catch {
    // best-effort only - a completion still gets a real message either way
  }
  return next;
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
