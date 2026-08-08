// WakeWise — Audio Architecture, Phase C1 — supported session lengths.
export const DURATION_OPTIONS = [
  { id: '1-min', minutes: 1, label: '1 minute' },
  { id: '2-min', minutes: 2, label: '2 minutes' },
  { id: '3-min', minutes: 3, label: '3 minutes' },
  { id: '5-min', minutes: 5, label: '5 minutes' },
  { id: '10-min', minutes: 10, label: '10 minutes' },
  { id: '15-min', minutes: 15, label: '15 minutes' },
  { id: '20-min', minutes: 20, label: '20 minutes' }
];

export const formatDuration = (minutes) =>
  DURATION_OPTIONS.find((d) => d.minutes === minutes)?.label ?? `${minutes} min`;

export const isSupportedDuration = (minutes) =>
  DURATION_OPTIONS.some((d) => d.minutes === minutes);
