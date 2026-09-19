// Plain-English step names, shared by ProgressIndicator.jsx (its own
// visible tab labels) and ReviewModeBanner (via any page's currentStep.id)
// - kept in its own non-component file so both can import it without
// tripping the react-refresh/only-export-components rule ProgressIndicator
// itself is bound by.
const STEP_LABELS = {
  // morning-routine
  alarm: 'Alarm',
  affirmation: 'Affirm',
  stretch: 'Stretch',
  breathe: 'Breathe',
  intention: 'Intend',
  complete: 'Done',
  // evening-wind-down
  windDown: 'Wind Down',
  reflection: 'Reflect',
  gratitude: 'Gratitude',
  breathing: 'Breathe',
  sleepPreparation: 'Rest',
  completion: 'Done',
};

export const getStepLabel = (stepId) => STEP_LABELS[stepId] ?? stepId;
