// Evening Wind-Down — Reflection/Gratitude question configuration.
//
// Extracted from Reflection.jsx/Gratitude.jsx (Phase 3 review-mode work)
// so the active tap-first journey and the new completed-review pages
// (ReflectionReview.jsx/GratitudeReview.jsx) share exactly one source of
// question wording, prompt ids, preset option lists, and guidance
// mappings — they can never drift apart from each other. Pure data only:
// no side effects, no imports beyond nothing, safe to import from any
// context (active journey, review, or a future test) without pulling in
// React, routing, or Supabase.
//
// Byte-for-byte the same content that previously lived inline in
// Reflection.jsx/Gratitude.jsx - this extraction does not change a single
// word of copy, option, or guidance id. Each page's own SESSION_ID/
// STEP_ID/accent/backFallback/write-behaviour stay local to that page
// (page-specific wiring, not question configuration), unchanged.
export const REFLECTION_PROMPTS = [
  {
    id: 'went-well',
    label: 'What went well today?',
    layout: 'rows',
    options: [
      'Reached a small milestone',
      'Had a peaceful moment',
      'Had a meaningful conversation',
      'Stayed calm in a difficult moment',
      'Got outside or moved',
      'Helped someone',
      'Handled a difficult task',
      'Simply got through the day'
    ],
    guidance: [
      { id: 'E10', blurb: 'A guided reflection to close out your day.' },
      { id: 'M05', blurb: 'A guided meditation for quiet reflection.' }
    ]
  },
  {
    id: 'challenged',
    label: 'What challenged you today?',
    options: [
      'Too much to do',
      'Difficult conversation',
      'Low energy',
      'Worry or uncertainty',
      'Trouble staying focused',
      'Felt rushed',
      'Plans changed',
      'Something personal'
    ],
    guidance: [
      { id: 'E17', blurb: 'A guided video to release built-up stress.' },
      { id: 'E16', blurb: 'A guided video to ease a racing mind or a tight chest.' }
    ]
  },
  {
    id: 'release',
    label: 'What are you ready to release?',
    options: [
      "Today's stress",
      "A worry I'm carrying",
      "What I can't control",
      'A mistake I made',
      'Comparing myself to others',
      'An unfinished task',
      "Tension I'm holding",
      'Not sure yet'
    ],
    guidance: [
      { id: 'E19', blurb: "A guided video to help you release what isn't yours to carry." },
      { id: 'E21', blurb: 'A guided video for gentle self-compassion.' }
    ]
  }
];

// Evening completed-review — derives which of {a saved preset, a saved
// custom answer, nothing saved} a stored response string represents for
// a given question. Pure and genuinely unit-testable (no React, no DOM) -
// the same derivation the active journey's own PromptStepper.jsx already
// performs inline (`selectedOption`/`currentValue`), extracted here so
// EveningReviewQuestion.jsx's read-only presentation can be exercised
// with real function calls in tests rather than only source-string
// assertions, per the completed-review work's own "behavioural tests
// where practical" requirement.
export const resolveSavedAnswerDisplay = (prompt, savedValue) => {
  const trimmed = (savedValue ?? '').trim();
  const hasValue = trimmed.length > 0;
  const selectedOption = prompt?.options?.find((opt) => opt === trimmed) ?? null;
  const isCustomAnswer = hasValue && !selectedOption;
  return { trimmed, hasValue, selectedOption, isCustomAnswer };
};

export const GRATITUDE_PROMPTS = [
  {
    id: 'appreciated-moment',
    label: 'Name one moment you appreciated today.',
    options: [
      'Morning stillness',
      'A comforting meal',
      'Kindness from someone',
      'A song that lifted me',
      'Feeling at home',
      'A moment of relief',
      'Fresh air or movement',
      'A quiet pause'
    ],
    guidance: [
      { id: 'E23', blurb: 'A guided video for a quiet moment of gratitude.' },
      { id: 'M04', blurb: 'A guided meditation for gratitude.' }
    ]
  },
  {
    id: 'who-made-better',
    label: 'Who made your day better?',
    options: [
      'Partner or family',
      'Friend',
      'Colleague',
      'Someone who helped',
      'Someone who listened',
      'A kind stranger',
      'My community',
      'I supported myself'
    ],
    guidance: [
      { id: 'M03', blurb: 'A guided loving kindness meditation.' }
    ]
  },
  {
    id: 'grateful-now',
    label: 'What are you grateful for right now?',
    options: [
      'This quiet moment',
      'Someone who cares about me',
      'A place where I feel safe',
      'Something that made me smile',
      'A small comfort',
      'A fresh start tomorrow',
      'My own effort today',
      'Simply being here'
    ],
    guidance: [
      { id: 'A05', blurb: 'A guided affirmation video for a grateful moment.' }
    ]
  }
];

// Build 15 — Edit Tonight's Responses (EditEveningResponses.jsx). One
// combined, ordered list spanning both sections so a single controller
// page/route can own ONE draft across all six questions (approved
// correction: two independently-mounted Edit pages would lose a
// Reflection draft the moment navigation crossed into Gratitude, since
// that would unmount the page holding it). Each entry keeps its own
// `stepId` so the eventual batch save can address the correct
// routine_responses row - REFLECTION_PROMPTS/GRATITUDE_PROMPTS
// themselves are untouched, this is a derived, read-only combination.
export const EVENING_EDIT_PROMPTS = [
  ...REFLECTION_PROMPTS.map((prompt) => ({ ...prompt, stepId: 'reflection', accent: 'reflection' })),
  ...GRATITUDE_PROMPTS.map((prompt) => ({ ...prompt, stepId: 'gratitude', accent: 'gratitude' }))
];

/**
 * Edit Tonight's Responses — pure diff between the originally-loaded
 * answers and the in-memory draft, used both to decide "is there
 * anything unsaved" (Cancel/exit confirmation) and to build the exact
 * payload for one atomic batch save. Deliberately excludes:
 *   - unchanged values (draft === original, trimmed) - never re-saved;
 *   - blank drafts (trimmed to '') - Build 15 Edit does not support
 *     clearing an answer to blank (approved scope: "replace, not
 *     remove" - see routineResponses.js's own deleteRoutineResponse for
 *     the separate explicit-clear path this deliberately does not use).
 * A blank draft on a prompt that already had a saved answer is simply
 * not included in the save payload - the original answer is left
 * exactly as it was, never silently deleted.
 */
export const computeChangedEntries = (original, draft, prompts) => {
  const changed = [];
  for (const prompt of prompts) {
    const draftValue = (draft?.[prompt.id] ?? '').trim();
    const originalValue = (original?.[prompt.id] ?? '').trim();
    if (draftValue && draftValue !== originalValue) {
      changed.push({ stepId: prompt.stepId, promptId: prompt.id, response: draftValue });
    }
  }
  return changed;
};
