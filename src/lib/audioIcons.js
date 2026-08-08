// WakeWise — Audio Architecture, Phase C1 — icon registry.
//
// Single source of truth mapping audio-domain concepts to icon names
// from the icon font already used everywhere else in the app (see any
// existing `material-symbols-outlined` usage, e.g. Settings.jsx) — no
// new icon package is introduced.
export const AUDIO_ICONS = {
  breathing: 'air',
  meditation: 'self_improvement',
  affirmations: 'record_voice_over',
  grounding: 'foundation',
  stretching: 'accessibility_new',
  sleep: 'bedtime',
  focus: 'center_focus_strong',
  'emergency-calm': 'health_and_safety',

  gratitude: 'volunteer_activism',
  heart: 'favorite',
  moon: 'bedtime',
  sun: 'wb_sunny',
  star: 'star',
  water: 'water_drop',
  wind: 'air',
  tree: 'park',

  none: 'block',
  rain: 'water_drop',
  ocean: 'waves',
  forest: 'park',
  fireplace: 'local_fire_department',
  'white-noise': 'graphic_eq',
  'pink-noise': 'graphic_eq',
  'brown-noise': 'graphic_eq',

  play: 'play_arrow',
  pause: 'pause',
  premium: 'workspace_premium',
  comingSoon: 'schedule',
  lock: 'lock'
};

export const CATEGORY_ICON_MAP = {
  breathing: AUDIO_ICONS.breathing,
  meditation: AUDIO_ICONS.meditation,
  affirmations: AUDIO_ICONS.affirmations,
  grounding: AUDIO_ICONS.grounding,
  stretching: AUDIO_ICONS.stretching,
  sleep: AUDIO_ICONS.sleep,
  focus: AUDIO_ICONS.focus,
  'emergency-calm': AUDIO_ICONS['emergency-calm']
};

export const BACKGROUND_ICON_MAP = {
  none: AUDIO_ICONS.none,
  rain: AUDIO_ICONS.rain,
  ocean: AUDIO_ICONS.ocean,
  forest: AUDIO_ICONS.forest,
  fireplace: AUDIO_ICONS.fireplace,
  wind: AUDIO_ICONS.wind,
  'white-noise': AUDIO_ICONS['white-noise'],
  'pink-noise': AUDIO_ICONS['pink-noise'],
  'brown-noise': AUDIO_ICONS['brown-noise']
};

export const getIcon = (name) => AUDIO_ICONS[name] ?? 'music_note';
