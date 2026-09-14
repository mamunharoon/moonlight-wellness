// Mobile navigation repair, Phase 3: shared routine catalogue data,
// extracted out of Routines.jsx so both it and RoutineDetail.jsx can
// import the same source of truth without Routines.jsx exporting a
// non-component value (react-refresh/only-export-components requires a
// component file to export components only, for Fast Refresh to work).
export const ROUTINES = [
  {
    id: 'rise-reset',
    category: 'Morning Awakening',
    title: 'Rise & Reset',
    duration: '5 min',
    description: 'Curated sequence featuring a gentle morning affirmation, light muscle stretching, and grounding breath.',
    accent: 'border-l-primary'
  },
  {
    id: 'gentle-reset',
    category: 'Midday Anchors',
    title: 'Gentle Reset',
    duration: '1 min',
    description: 'Quick, on-the-spot breathing visualizer to lower heart rate and restore mental clarity during active work.',
    accent: 'border-l-secondary'
  },
  {
    id: 'wind-down',
    category: 'Nightrest',
    title: 'Begin Wind-Down',
    duration: '10 min',
    description: 'Wind down with brief, personal gratitude journal logging, calming breathing loops, and sleep soundscapes.',
    accent: 'border-l-tertiary'
  }
];
