// WakeWise — Audio Architecture, Phase C1 — the content catalogue.
//
// This is the framework, not the content: every entry below is real
// metadata (title, description, duration, difficulty, voice, ambience)
// but `comingSoon: true` on every single one, because no audio has
// been produced yet (out of scope for this phase — see audioEngine.js
// and AudioPlayerPlaceholder.jsx, which stay silent no-ops). When real
// audio ships, flipping `comingSoon` to false per entry is the only
// change needed here — everything else (routing, cards, gating) already
// works against this exact shape.
//
// `premium` is set per entry as a first product judgment call, not a
// hard rule: Emergency Calm is entirely free deliberately (crisis
// tools shouldn't sit behind a paywall) — see the final report's
// recommendations. Everything else is free-vs-Plus mixed for variety.
//
// Sleep entries are the one category where `icon`/`backgroundType`
// intentionally match the entry itself (the "Rain" track's background
// *is* rain) rather than inheriting the category icon like every other
// entry does.
import { CATEGORY_ICON_MAP, BACKGROUND_ICON_MAP } from './audioIcons';
import { validateAudioEntry } from './audioMetadata';

const categoryIcon = (category) => CATEGORY_ICON_MAP[category];

const AUDIO_LIBRARY = [
  // --- Breathing ---
  { id: 'breathing-deep-breathing', title: 'Deep breathing', description: 'A slow, full-lung breathing pattern to settle the nervous system.', icon: categoryIcon('breathing'), category: 'breathing', duration: 3, difficulty: 'beginner', voiceType: 'female', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'breathing-box-breathing', title: 'Box breathing', description: 'Equal-count inhale, hold, exhale, hold — a steadying rhythm used by high-performers.', icon: categoryIcon('breathing'), category: 'breathing', duration: 5, difficulty: 'intermediate', voiceType: 'male', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'breathing-4-7-8', title: '4-7-8 breathing', description: 'A structured inhale-hold-exhale ratio designed to ease the body toward sleep.', icon: categoryIcon('breathing'), category: 'breathing', duration: 5, difficulty: 'beginner', voiceType: 'female', backgroundType: 'none', premium: true, comingSoon: true },
  { id: 'breathing-coherent', title: 'Coherent breathing', description: 'Steady five-second inhales and exhales to bring heart rate into a calm rhythm.', icon: categoryIcon('breathing'), category: 'breathing', duration: 10, difficulty: 'intermediate', voiceType: 'neutral', backgroundType: 'none', premium: true, comingSoon: true },
  { id: 'breathing-alternate-nostril', title: 'Alternate nostril breathing', description: 'A traditional pranayama technique that balances focus and calm.', icon: categoryIcon('breathing'), category: 'breathing', duration: 10, difficulty: 'advanced', voiceType: 'male', backgroundType: 'none', premium: true, comingSoon: true },

  // --- Meditation ---
  { id: 'meditation-mindfulness', title: 'Mindfulness', description: 'An open-awareness meditation for noticing thoughts without following them.', icon: categoryIcon('meditation'), category: 'meditation', duration: 10, difficulty: 'beginner', voiceType: 'female', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'meditation-body-scan', title: 'Body scan', description: "A guided pass through the body to release tension you didn't know you were holding.", icon: categoryIcon('meditation'), category: 'meditation', duration: 15, difficulty: 'intermediate', voiceType: 'male', backgroundType: 'none', premium: true, comingSoon: true },
  { id: 'meditation-loving-kindness', title: 'Loving kindness', description: 'A compassion practice extending goodwill to yourself and others.', icon: categoryIcon('meditation'), category: 'meditation', duration: 15, difficulty: 'intermediate', voiceType: 'female', backgroundType: 'forest', premium: true, comingSoon: true },
  { id: 'meditation-gratitude', title: 'Gratitude', description: "A short reflection on what's going well right now.", icon: categoryIcon('meditation'), category: 'meditation', duration: 5, difficulty: 'beginner', voiceType: 'neutral', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'meditation-guided-reflection', title: 'Guided reflection', description: 'An open-ended, prompt-led meditation for processing the day.', icon: categoryIcon('meditation'), category: 'meditation', duration: 20, difficulty: 'advanced', voiceType: 'female', backgroundType: 'ocean', premium: true, comingSoon: true },

  // --- Affirmations ---
  { id: 'affirmations-confidence', title: 'Confidence', description: 'Short spoken lines to reinforce a sense of capability.', icon: categoryIcon('affirmations'), category: 'affirmations', duration: 2, difficulty: 'beginner', voiceType: 'male', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'affirmations-calmness', title: 'Calmness', description: 'Gentle statements to lower reactivity in a stressful moment.', icon: categoryIcon('affirmations'), category: 'affirmations', duration: 2, difficulty: 'beginner', voiceType: 'female', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'affirmations-focus', title: 'Focus', description: 'Brief cues to re-anchor attention on the task at hand.', icon: categoryIcon('affirmations'), category: 'affirmations', duration: 1, difficulty: 'beginner', voiceType: 'neutral', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'affirmations-motivation', title: 'Motivation', description: "Energizing lines to start a task you've been putting off.", icon: categoryIcon('affirmations'), category: 'affirmations', duration: 2, difficulty: 'intermediate', voiceType: 'male', backgroundType: 'none', premium: true, comingSoon: true },
  { id: 'affirmations-gratitude', title: 'Gratitude', description: 'Simple statements of appreciation to shift perspective.', icon: categoryIcon('affirmations'), category: 'affirmations', duration: 1, difficulty: 'beginner', voiceType: 'female', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'affirmations-self-worth', title: 'Self-worth', description: 'Affirming language for moments of self-doubt.', icon: categoryIcon('affirmations'), category: 'affirmations', duration: 3, difficulty: 'intermediate', voiceType: 'neutral', backgroundType: 'none', premium: true, comingSoon: true },

  // --- Grounding ---
  { id: 'grounding-five-senses', title: 'Five senses technique', description: 'Notice five things you can see, hear, touch, smell, and taste to anchor into the present.', icon: categoryIcon('grounding'), category: 'grounding', duration: 3, difficulty: 'beginner', voiceType: 'female', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'grounding-muscle-relaxation', title: 'Muscle relaxation', description: 'Progressive tensing and releasing of muscle groups to discharge physical stress.', icon: categoryIcon('grounding'), category: 'grounding', duration: 10, difficulty: 'intermediate', voiceType: 'male', backgroundType: 'none', premium: true, comingSoon: true },
  { id: 'grounding-body-awareness', title: 'Body awareness', description: 'A gentle scan to reconnect with physical sensation during a stressful moment.', icon: categoryIcon('grounding'), category: 'grounding', duration: 5, difficulty: 'beginner', voiceType: 'neutral', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'grounding-sensory-reset', title: 'Sensory reset', description: 'A short exercise using touch and breath to interrupt a spiral of anxious thoughts.', icon: categoryIcon('grounding'), category: 'grounding', duration: 3, difficulty: 'beginner', voiceType: 'female', backgroundType: 'none', premium: false, comingSoon: true },

  // --- Stretching ---
  { id: 'stretching-neck-release', title: 'Neck release', description: 'Slow, guided neck stretches to ease tension from screen time.', icon: categoryIcon('stretching'), category: 'stretching', duration: 3, difficulty: 'beginner', voiceType: 'female', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'stretching-shoulder-release', title: 'Shoulder release', description: 'A short sequence to loosen tight shoulders and upper traps.', icon: categoryIcon('stretching'), category: 'stretching', duration: 5, difficulty: 'beginner', voiceType: 'male', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'stretching-upper-back', title: 'Upper-back stretch', description: 'Guided movement to counter a hunched, seated posture.', icon: categoryIcon('stretching'), category: 'stretching', duration: 5, difficulty: 'intermediate', voiceType: 'neutral', backgroundType: 'none', premium: true, comingSoon: true },
  { id: 'stretching-morning-flow', title: 'Morning flow', description: 'A gentle full-body sequence to wake up the body.', icon: categoryIcon('stretching'), category: 'stretching', duration: 10, difficulty: 'beginner', voiceType: 'female', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'stretching-evening-flow', title: 'Evening flow', description: 'A slow wind-down stretch sequence to prepare the body for rest.', icon: categoryIcon('stretching'), category: 'stretching', duration: 10, difficulty: 'beginner', voiceType: 'male', backgroundType: 'none', premium: true, comingSoon: true },

  // --- Sleep --- (icon/backgroundType intentionally match the sound itself)
  { id: 'sleep-rain', title: 'Rain', description: 'Steady rainfall to mask distracting noise and ease you toward sleep.', icon: BACKGROUND_ICON_MAP.rain, category: 'sleep', duration: 20, difficulty: 'beginner', voiceType: 'neutral', backgroundType: 'rain', premium: false, comingSoon: true },
  { id: 'sleep-ocean-waves', title: 'Ocean waves', description: 'A slow, repeating wave rhythm for deep relaxation.', icon: BACKGROUND_ICON_MAP.ocean, category: 'sleep', duration: 20, difficulty: 'beginner', voiceType: 'neutral', backgroundType: 'ocean', premium: false, comingSoon: true },
  { id: 'sleep-forest-sounds', title: 'Forest sounds', description: 'Birdsong and rustling leaves for a calm, natural backdrop.', icon: BACKGROUND_ICON_MAP.forest, category: 'sleep', duration: 15, difficulty: 'beginner', voiceType: 'neutral', backgroundType: 'forest', premium: true, comingSoon: true },
  { id: 'sleep-white-noise', title: 'White noise', description: 'A flat, full-spectrum hiss that evens out background noise.', icon: BACKGROUND_ICON_MAP['white-noise'], category: 'sleep', duration: 20, difficulty: 'beginner', voiceType: 'neutral', backgroundType: 'white-noise', premium: false, comingSoon: true },
  { id: 'sleep-pink-noise', title: 'Pink noise', description: 'A softer, deeper variant of white noise, often easier to sleep through.', icon: BACKGROUND_ICON_MAP['pink-noise'], category: 'sleep', duration: 20, difficulty: 'intermediate', voiceType: 'neutral', backgroundType: 'pink-noise', premium: true, comingSoon: true },
  { id: 'sleep-brown-noise', title: 'Brown noise', description: 'A deep, rumbling noise profile popular for sustained focus and sleep.', icon: BACKGROUND_ICON_MAP['brown-noise'], category: 'sleep', duration: 20, difficulty: 'intermediate', voiceType: 'neutral', backgroundType: 'brown-noise', premium: true, comingSoon: true },
  { id: 'sleep-fireplace', title: 'Fireplace', description: 'A crackling fire for a warm, cozy wind-down.', icon: BACKGROUND_ICON_MAP.fireplace, category: 'sleep', duration: 15, difficulty: 'beginner', voiceType: 'neutral', backgroundType: 'fireplace', premium: true, comingSoon: true },
  { id: 'sleep-wind', title: 'Wind', description: 'A steady, sweeping wind ambience.', icon: BACKGROUND_ICON_MAP.wind, category: 'sleep', duration: 15, difficulty: 'beginner', voiceType: 'neutral', backgroundType: 'wind', premium: false, comingSoon: true },

  // --- Focus ---
  { id: 'focus-deep-work', title: 'Deep work', description: 'Sustained ambient audio for uninterrupted, high-concentration work.', icon: categoryIcon('focus'), category: 'focus', duration: 20, difficulty: 'intermediate', voiceType: 'neutral', backgroundType: 'brown-noise', premium: true, comingSoon: true },
  { id: 'focus-study', title: 'Study', description: 'Steady background audio tuned for reading and studying.', icon: categoryIcon('focus'), category: 'focus', duration: 20, difficulty: 'beginner', voiceType: 'neutral', backgroundType: 'white-noise', premium: false, comingSoon: true },
  { id: 'focus-concentration', title: 'Concentration', description: 'A neutral audio bed to support sustained attention.', icon: categoryIcon('focus'), category: 'focus', duration: 15, difficulty: 'beginner', voiceType: 'neutral', backgroundType: 'none', premium: false, comingSoon: true },

  // --- Emergency Calm --- (deliberately all free — see file header comment)
  { id: 'emergency-calm-panic-reduction', title: 'Panic reduction', description: 'A fast, guided sequence to interrupt a panic response.', icon: categoryIcon('emergency-calm'), category: 'emergency-calm', duration: 3, difficulty: 'beginner', voiceType: 'female', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'emergency-calm-anxiety-relief', title: 'Anxiety relief', description: 'Short guided breathing and grounding to ease acute anxiety.', icon: categoryIcon('emergency-calm'), category: 'emergency-calm', duration: 5, difficulty: 'beginner', voiceType: 'male', backgroundType: 'none', premium: false, comingSoon: true },
  { id: 'emergency-calm-stress-reduction', title: 'Stress reduction', description: 'A brief reset for moments of acute stress.', icon: categoryIcon('emergency-calm'), category: 'emergency-calm', duration: 3, difficulty: 'beginner', voiceType: 'neutral', backgroundType: 'none', premium: false, comingSoon: true }
];

if (import.meta.env.DEV) {
  AUDIO_LIBRARY.forEach(validateAudioEntry);
}

export const getAllAudioEntries = () => AUDIO_LIBRARY;

export const getAudioEntriesByCategory = (categoryId) =>
  AUDIO_LIBRARY.filter((entry) => entry.category === categoryId);

export const getAudioEntryById = (entryId) =>
  AUDIO_LIBRARY.find((entry) => entry.id === entryId);
