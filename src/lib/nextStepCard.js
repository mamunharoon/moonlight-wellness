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
const MORNING_NOT_STARTED_BY_DAYPART = {
  [MORNING_DAYPART.MORNING]: {
    title: 'Start your Morning Reset',
    explanation: 'Begin with today’s intention, then move through gentle stretching, grounding and a closing affirmation.',
    buttonLabel: 'Begin My Morning'
  },
  [MORNING_DAYPART.AFTERNOON]: {
    title: 'Revisit your morning routine',
    explanation: 'Move through intention, stretching, breathing, meditation and affirmation at your own pace.',
    buttonLabel: 'Start Morning Routine'
  },
  [MORNING_DAYPART.EVENING_NIGHT]: {
    title: 'Revisit your morning routine',
    explanation: 'Move through intention, stretching, breathing, meditation and affirmation at your own pace.',
    buttonLabel: 'Start Morning Routine'
  }
};

/**
 * @param {Object} args
 * @param {'morning'|'evening'} args.period - the currently SELECTED pill (Home.jsx's own activePeriod), never the raw clock.
 * @param {'not-started'|'in-progress'|'completed'} args.cardState - this routine's own resolveRoutineCardState() result.
 * @param {'morning'|'afternoon'|'evening-night'} [args.morningDaypart] - required only when period === 'morning' && cardState === 'not-started'; ignored otherwise.
 * @param {string} [args.stepName] - required only when cardState === 'in-progress' (getStepLabel(...) - the plain current-step name).
 * @returns {{ eyebrow: string, title: string, supportingText: string, duration: string|null, buttonLabel: string }}
 */
export const resolveNextStepCard = ({ period, cardState, morningDaypart, stepName }) => {
  if (period === 'morning') {
    if (cardState === 'completed') {
      return {
        eyebrow: 'YOUR MORNING',
        title: 'Your Morning Reset is complete',
        supportingText: 'You’ve set your direction for today.',
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
      eyebrow: 'YOUR NEXT STEP',
      title: variant.title,
      supportingText: variant.explanation,
      // Journey Embedding — the optional Meditate/Meditation step (2, 5 or
      // 10 minutes, user's own choice, skippable to zero) can extend the
      // routine beyond the old flat "About 5–10 minutes" range, which is
      // now inaccurate at the high end for anyone who takes it. Never
      // states a recommended duration as the maximum possible total (the
      // 10-minute meditation choice would make that claim false) -
      // "plus optional meditation" names the addition without pretending
      // to total it, matching the approved copy exactly.
      duration: 'About 5–10 minutes, plus optional meditation',
      buttonLabel: variant.buttonLabel
    };
  }

  // period === 'evening' - no daypart variation, per the approved design.
  if (cardState === 'completed') {
    return {
      eyebrow: 'YOUR EVENING',
      title: 'Your Evening Wind-Down is complete',
      supportingText: 'You’ve taken time to close the day gently.',
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
  return {
    eyebrow: 'YOUR NEXT STEP',
    title: 'Begin your Evening Wind-Down',
    supportingText: 'Reflect on your day, release what you no longer need and prepare gently for rest.',
    duration: 'About 5–10 minutes, plus optional meditation',
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
