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
export const getOutcomeMessage = (outcome, journey = JOURNEY.ANYTIME, dateKey) => {
  const rotatingSet = ROTATING_MESSAGES[journey]?.[outcome];
  if (rotatingSet) return pickVariant(rotatingSet, dateKey);

  const single = SINGLE_MESSAGES[journey]?.[outcome];
  if (single) return single;

  // Defensive fallback only - every real (journey, outcome) pair this app
  // actually uses is covered above; this never claims completion either.
  return { headline: 'Session paused.', body: 'Would you like to continue?' };
};
