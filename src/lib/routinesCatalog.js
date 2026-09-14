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
    accent: 'border-l-primary'
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
    accent: 'border-l-secondary'
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
    accent: 'border-l-tertiary'
  }
];

export const ROUTINE_SECTIONS = ['Morning', 'Daytime', 'Evening'];
