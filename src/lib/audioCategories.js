// WakeWise — Audio Architecture, Phase C1 — top-level content categories.
import { CATEGORY_ICON_MAP } from './audioIcons';

export const AUDIO_CATEGORIES = [
  { id: 'breathing', label: 'Breathing', description: 'Guided breathing patterns to calm the body and mind.' },
  { id: 'meditation', label: 'Meditation', description: 'Guided meditations for presence, awareness, and reflection.' },
  { id: 'affirmations', label: 'Affirmations', description: 'Short spoken affirmations for a specific mindset.' },
  { id: 'grounding', label: 'Grounding', description: "Sensory techniques to reconnect with the present moment." },
  { id: 'stretching', label: 'Stretching', description: 'Guided stretch sequences for common tension areas.' },
  { id: 'sleep', label: 'Sleep', description: 'Soundscapes to support falling and staying asleep.' },
  { id: 'focus', label: 'Focus', description: 'Background audio for deep work and studying.' },
  { id: 'emergency-calm', label: 'Emergency Calm', description: 'Fast-acting audio for moments of acute stress.' }
].map((category) => ({ ...category, icon: CATEGORY_ICON_MAP[category.id] }));

export const getCategoryById = (categoryId) => AUDIO_CATEGORIES.find((c) => c.id === categoryId);
