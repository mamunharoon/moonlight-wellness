// WakeWise — Audio Architecture, Phase C1 — narration voice types.
export const VOICE_TYPES = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'neutral', label: 'Neutral' }
];

export const getVoiceLabel = (voiceType) =>
  VOICE_TYPES.find((v) => v.id === voiceType)?.label ?? voiceType;
