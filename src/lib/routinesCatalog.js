// Mobile navigation repair, Phase 3: shared routine catalogue data,
// extracted out of Routines.jsx so both it and RoutineDetail.jsx can
// import the same source of truth without Routines.jsx exporting a
// non-component value (react-refresh/only-export-components requires a
// component file to export components only, for Fast Refresh to work).
//
// Daily Journey & Content Architecture: `section` groups the Routines
// Hub into the required Morning/Daytime/Evening sections; `sessionId`
// (when set) is this routine's Session Engine id, so Routines.jsx can
// show a genuine in-progress/complete badge per card instead of a
// static list — `null` for Gentle Reset, which (like Support's flows)
// has never been Session-Engine-tracked; `stepCount` matches
// RoutineDetail.jsx's own `steps` array length for each routine (the
// same "Step X of N" the routine's own step pages already show), kept
// here so the Routines Hub card can display step count without
// duplicating RoutineDetail's step list.
//
// `accentColor` (Circadian Colors, Build 16) — a raw CSS custom-property
// reference, not a Tailwind `border-l-*` class: Routines.jsx's card is a
// `.glass-panel` element, and .glass-panel's own plain-CSS `border`
// shorthand (index.css) sits later in the compiled stylesheet than any
// Tailwind utility (it isn't inside @layer utilities) - the exact same
// "silently wins over a same-specificity class every time" gotcha
// Home.jsx's own Today's Rhythm cards already worked around with an
// inline style, found live here too (a `border-l-4 ${accent}` class was
// being completely overridden, both its width AND its color, back down
// to .glass-panel's own 1px neutral border). Routines.jsx applies this
// via an inline style for exactly the same reason.
export const ROUTINES = [
  {
    id: 'rise-reset',
    section: 'Morning',
    sessionId: 'morning-routine',
    category: 'Morning Awakening',
    title: 'Rise & Reset',
    duration: '5 min',
    stepCount: 5,
    description: 'Curated sequence featuring a gentle morning affirmation, light muscle stretching, and grounding breath.',
    // Circadian Colors — dawn gold, matching every other Morning surface
    // (Home.jsx's own Morning pill, Introduction.jsx's welcome card).
    accentColor: 'var(--color-gratitude-accent)'
  },
  {
    id: 'gentle-reset',
    section: 'Daytime',
    sessionId: null,
    category: 'Midday Anchors',
    title: 'Gentle Reset',
    duration: '1 min',
    stepCount: 1,
    description: 'Quick, on-the-spot breathing visualizer to lower heart rate and restore mental clarity during active work.',
    // Circadian Colors — sage/mint, matching every other pause/breathing
    // surface (Introduction.jsx's own welcome card for this exact routine).
    accentColor: 'var(--color-tertiary)'
  },
  {
    id: 'wind-down',
    section: 'Evening',
    sessionId: 'evening-wind-down',
    category: 'Nightrest',
    title: 'Begin Wind-Down',
    duration: '10 min',
    stepCount: 5,
    description: 'Wind down with brief, personal gratitude journal logging, calming breathing loops, and sleep soundscapes.',
    // Circadian Colors — twilight lavender, matching every other
    // Evening/sleep surface (Home.jsx's own Evening pill,
    // Introduction.jsx's welcome card).
    accentColor: 'var(--color-evening-accent)'
  }
];

export const ROUTINE_SECTIONS = ['Morning', 'Daytime', 'Evening'];
