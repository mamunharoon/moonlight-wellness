// WakeWise — Self-Guided Meditation — sound choices (IM01/IM02/No Music).
//
// Three mutually exclusive choices, replacing the earlier single Background
// music On/Off model. 'none' is a UI-level sentinel id (native radios need a
// concrete string value for every option, including "no selection") -
// toControllerSoundId translates it to `null`, the value
// meditationSessionController.js/meditationAudioController.js actually
// understand as "no track". IM01/IM02 are both registered, guest-allowlisted
// interactive ambient beds (see betaVideoManifest.js and
// supabase/functions/_shared/betaVideoUrlAccess.ts) - this module carries no
// media-resolution logic of its own, only the display/selection data.
export const MEDITATION_SOUNDS = [
  { id: 'IM01', label: 'Gentle Ambient', description: 'Soft atmospheric background music' },
  { id: 'IM02', label: 'Soft Piano', description: 'Slow, spacious piano for a quiet pause' },
  { id: 'none', label: 'No Music', description: 'Continue in silence' }
];

export const getMeditationSoundById = (id) => MEDITATION_SOUNDS.find((sound) => sound.id === id) || null;

export const isValidMeditationSoundId = (id) => MEDITATION_SOUNDS.some((sound) => sound.id === id);

// Style-aware suggested defaults (product-approved pairing) - applied only
// while the user has not yet made an explicit sound choice for this setup
// visit (see SelfGuidedMeditation.jsx's own `soundExplicit` flag). A
// restored Meditate-Again/Choose-Another-Meditation preset, or any future
// restored authenticated preference, counts as an explicit choice and is
// never overridden by this table - it's consulted only for a genuinely
// fresh setup (or once style changes while nothing explicit has been picked
// yet).
export const SUGGESTED_SOUND_ID_BY_STYLE_ID = {
  quiet: 'IM02',
  'breath-awareness': 'IM01',
  'mindful-pause': 'IM01',
  'body-awareness': 'IM02',
  'loving-kindness': 'IM02'
};

// Fallback for a style id this table doesn't recognise (should not happen
// given MEDITATION_STYLES is the only source of style ids, but never throw
// over a missing mapping) - Gentle Ambient, the same value every "invalid/
// obsolete stored value" case below also resolves to.
const FALLBACK_SUGGESTED_SOUND_ID = 'IM01';

export const getSuggestedSoundIdForStyle = (styleId) => SUGGESTED_SOUND_ID_BY_STYLE_ID[styleId] || FALLBACK_SUGGESTED_SOUND_ID;

// UI sentinel ('IM01' | 'IM02' | 'none' | anything invalid) -> the value the
// audio layer understands ('IM01' | 'IM02' | null). An invalid/unrecognised
// id is treated the same as 'none' (never silently falls through to a
// track id the resolver hasn't validated).
export const toControllerSoundId = (uiSoundId) => (uiSoundId === 'IM01' || uiSoundId === 'IM02' ? uiSoundId : null);
