// Home.jsx redesign — "Your Next Step" unified recommendation card.
//
// Pure content resolution, kept separate from Home.jsx for direct Vitest
// coverage (matching greeting.js/routineCardState.js's own established
// pattern - see either file's own header comment). Exactly one lookup per
// (period, cardState, morningDaypart) combination, per the approved copy.
// `stepName` for the in-progress state is always supplied by the caller
// from the existing canonical session registry (stepLabels.js's
// getStepLabel, reading sessionRegistry.js's own step ids) - never
// hard-coded here.
//
// `supportingText` is always present - every state (not-started, in-
// progress, completed) has its own one-sentence body, shown to first-time
// and returning users alike. Revision: the not-started sentence was
// originally gated behind isFirstTime (an "explanation" shown once), but
// that made a returning user's card ambiguous about what the action
// actually does - the sentence is the minimum context connecting the
// recommended action to its benefit, not a repeat of Introduction's fuller
// walkthrough, so it stays for every visit. A first-time vs returning
// distinction still exists elsewhere (Introduction's own full explanation
// is gated on profiles.introduction_completed_version, unchanged) - it no
// longer has any bearing on this card's copy.

export const MORNING_DAYPART = Object.freeze({
  MORNING: 'morning',
  AFTERNOON: 'afternoon',
  EVENING_NIGHT: 'evening-night'
});

// F2 (pre-Build-15 usability pass) — found live: both off-hours variants
// (afternoon, evening/night) branded the full Morning routine as a
// "reset" ("Start a Daytime Reset" / "Start a Gentle Reset"), colliding
// with "Gentle Reset" - the name already reserved for the real, separate,
// short standalone breathing experience (Routines.jsx/RoutineDetail.jsx's
// Anytime entry). Tapping either button here still launches the complete
// Morning routine (handleMorningAction, unchanged) - only the copy
// mislabeled what it actually does. Both off-hours variants now use the
// same approved copy (there is no meaningful difference between
// "afternoon" and "evening/night" framing once neither is allowed to call
// itself a reset) - the daypart split itself is untouched, matching the
// approved "correct copy only, no route/handler change" scope.
// Morning Visual Uplift (Phase 6) — the MORNING daypart variant's own
// eyebrow/explanation/duration/buttonLabel are the exact approved copy
// from the Stitch-direction Morning Home redesign ("MORNING RESET" /
// "A gentle start for a positive day." / "5–10 min" / "Begin Morning
// Reset"), replacing the longer, more explanatory originals per the
// approved "reduce text and cognitive load" objective. AFTERNOON/
// EVENING_NIGHT are untouched (not covered by the approved mock, and this
// pass is scoped to the default/morning-daypart card only) - each keeps
// its own original eyebrow/duration alongside its own pre-existing
// title/explanation/buttonLabel, exactly as before this change.
const MORNING_NOT_STARTED_BY_DAYPART = {
  [MORNING_DAYPART.MORNING]: {
    eyebrow: 'MORNING RESET',
    title: 'Start your Morning Reset',
    explanation: 'A gentle start for a positive day.',
    duration: '5–10 min',
    buttonLabel: 'Begin Morning Reset'
  },
  [MORNING_DAYPART.AFTERNOON]: {
    eyebrow: 'YOUR NEXT STEP',
    title: 'Revisit your morning routine',
    explanation: 'Move through intention, stretching, breathing, meditation and affirmation at your own pace.',
    duration: 'About 5–10 minutes, plus optional meditation',
    buttonLabel: 'Start Morning Routine'
  },
  [MORNING_DAYPART.EVENING_NIGHT]: {
    eyebrow: 'YOUR NEXT STEP',
    title: 'Revisit your morning routine',
    explanation: 'Move through intention, stretching, breathing, meditation and affirmation at your own pace.',
    duration: 'About 5–10 minutes, plus optional meditation',
    buttonLabel: 'Start Morning Routine'
  }
};

/**
 * @param {Object} args
 * @param {'morning'|'evening'} args.period - the currently SELECTED pill (Home.jsx's own activePeriod), never the raw clock.
 * @param {'not-started'|'in-progress'|'completed'|'finished-partially'} args.cardState - this routine's own resolveRoutineCardState() result. Phase 9 — Truthful Journey Outcomes: 'finished-partially' is the honest counterpart to 'completed' - reached today, but not every displayed stage genuinely completed (any skipped/ended-early/not-reached stage). Reuses the SAME exact heading/supporting-line copy as the matching journey's final screen (SessionComplete.jsx/EveningComplete.jsx, Part 7), so the two surfaces never disagree.
 * @param {'morning'|'afternoon'|'evening-night'} [args.morningDaypart] - required only when period === 'morning' && cardState === 'not-started'; ignored otherwise.
 * @param {string} [args.stepName] - required only when cardState === 'in-progress' (getStepLabel(...) - the plain current-step name).
 * @returns {{ eyebrow: string, title: string, supportingText: string, duration: string|null, buttonLabel: string }}
 */
export const resolveNextStepCard = ({ period, cardState, morningDaypart, stepName }) => {
  if (period === 'morning') {
    if (cardState === 'completed') {
      return {
        eyebrow: 'YOUR MORNING',
        title: 'Morning Reset complete',
        supportingText: 'You made time to begin your day with intention.',
        duration: null,
        buttonLabel: 'Repeat Morning Routine'
      };
    }
    if (cardState === 'finished-partially') {
      return {
        eyebrow: 'YOUR MORNING',
        title: 'Morning Reset finished',
        supportingText: 'Every intentional moment still matters.',
        duration: null,
        buttonLabel: 'Repeat Morning Routine'
      };
    }
    if (cardState === 'in-progress') {
      return {
        eyebrow: 'YOUR NEXT STEP',
        title: 'Continue where you left off',
        supportingText: `You're on ${stepName}—your next step is ready.`,
        duration: null,
        buttonLabel: 'Continue Morning Routine'
      };
    }
    const variant = MORNING_NOT_STARTED_BY_DAYPART[morningDaypart] ?? MORNING_NOT_STARTED_BY_DAYPART[MORNING_DAYPART.MORNING];
    return {
      eyebrow: variant.eyebrow,
      title: variant.title,
      supportingText: variant.explanation,
      duration: variant.duration,
      buttonLabel: variant.buttonLabel
    };
  }

  // period === 'evening' - no daypart variation, per the approved design.
  if (cardState === 'completed') {
    return {
      eyebrow: 'YOUR EVENING',
      title: 'Evening Wind-Down complete',
      supportingText: 'You gave yourself time to close the day gently.',
      duration: null,
      buttonLabel: 'Repeat Evening Routine'
    };
  }
  if (cardState === 'finished-partially') {
    return {
      eyebrow: 'YOUR EVENING',
      title: 'Evening Wind-Down finished',
      supportingText: 'Take the calm you created into the night.',
      duration: null,
      buttonLabel: 'Repeat Evening Routine'
    };
  }
  if (cardState === 'in-progress') {
    return {
      eyebrow: 'YOUR NEXT STEP',
      title: 'Continue where you left off',
      supportingText: `You're on ${stepName}—your next step is ready.`,
      duration: null,
      buttonLabel: 'Continue Evening Wind-Down'
    };
  }
  // Evening copy simplification — the duration/"plus optional meditation"
  // sentence is removed (every Evening activity is user-directed and
  // skippable, so singling out Meditation as "optional" was misleading -
  // Reflect/Gratitude/Breathe are exactly as skippable). `duration: null`
  // matches every other Evening card state above, which already omit it;
  // Home.jsx's own `{card.duration && (...)}` guard already renders
  // nothing for a falsy value - no other change needed there. Morning's
  // own MORNING_NOT_STARTED_BY_DAYPART entries (afternoon/evening-night
  // daypart variants of the MORNING card, unrelated to this Evening card)
  // keep their own untouched duration text.
  return {
    eyebrow: 'YOUR NEXT STEP',
    title: 'Begin your Evening Wind-Down',
    supportingText: 'Reflect on your day, release what you no longer need and prepare gently for rest.',
    duration: null,
    buttonLabel: 'Begin Evening Wind-Down'
  };
};

/**
 * Which of Morning's three not-started daypart variants applies, from
 * Home.jsx's own already-resolved `timeState` ('before-wake'/'daytime-
 * morning'/'daytime'/'evening'/'night'). 'before-wake' folds into
 * 'morning' (chronologically still the morning daypart, just ahead of the
 * user's configured alarm - showing a clear, actionable next step here is
 * exactly this redesign's own goal, replacing the old passive "still
 * resting" screen). 'evening' and 'night' both fold into the combined
 * evening/night variant, matching the approved copy's own "during the
 * evening/night" wording verbatim.
 */
export const resolveMorningDaypart = (timeState) => {
  if (timeState === 'daytime') return MORNING_DAYPART.AFTERNOON;
  if (timeState === 'evening' || timeState === 'night') return MORNING_DAYPART.EVENING_NIGHT;
  return MORNING_DAYPART.MORNING;
};
