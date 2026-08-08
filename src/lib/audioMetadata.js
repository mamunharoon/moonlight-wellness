// WakeWise — Audio Architecture, Phase C1 — shared vocabulary + a
// dev-time completeness check for audioLibrary.js entries.
//
// validateAudioEntry never throws — a malformed entry should still
// render (missing fields fall back sensibly wherever they're read) —
// it only warns loudly in the console so a future content addition
// that's missing a field is caught during development, not silently
// half-rendered in production.
export const DIFFICULTY_LEVELS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' }
];

export const getDifficultyLabel = (difficulty) =>
  DIFFICULTY_LEVELS.find((d) => d.id === difficulty)?.label ?? difficulty;

export const AUDIO_ENTRY_FIELDS = [
  'id',
  'title',
  'description',
  'icon',
  'category',
  'duration',
  'difficulty',
  'voiceType',
  'backgroundType',
  'premium',
  'comingSoon'
];

export const validateAudioEntry = (entry) => {
  const missing = AUDIO_ENTRY_FIELDS.filter((field) => entry[field] === undefined);
  if (missing.length > 0) {
    console.error(`Audio entry "${entry.id ?? '(no id)'}" is missing: ${missing.join(', ')}`);
  }
  return missing.length === 0;
};
