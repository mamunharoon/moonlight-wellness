// WakeWise — Beta Video Preview (localhost testing pass).
//
// TEMPORARY LOCAL MANIFEST — not a database table. The app has no
// content model for video yet (audioLibrary.js is audio-only, gated by
// Plus subscription, and still fully comingSoon). This file exists only
// because fifty-two beta exercise videos (E02-E30, A01-A06, B01-B05,
// F01-F03, G01-G04, M01-M05) are live in Storage today and need a
// minimal, typed, isolated place to map an id -> title -> object path. When a real "exercises" table exists, replace this file with a
// query and delete it — nothing outside src/lib/betaVideo*.js and
// BetaVideoModal.jsx should ever import it directly.
//
// `storagePath` is an object path inside the private `wellness-videos`
// bucket (bucket root, includes the `exercises/` folder) — never a
// public URL. It is only ever sent to the get-beta-video-url Edge
// Function, which is the one place allowed to turn it into a short-lived
// signed URL. Object names are exactly what's in Storage today (verified
// via `supabase db query --linked` against storage.objects for every id,
// not assumed from any spec) — not renamed, typos and double extensions
// included.
//
// @typedef {Object} BetaVideoEntry
// @property {string} id            - stable id sent to the Edge Function (E02-E30, A01-A06, B01-B05, F01-F03, G01-G04, M01-M05)
// @property {string} title         - exercise/video title shown on the beta card. Distinct
//                                     from Support.jsx's "I feel overwhelmed" mood-card copy
//                                     (E02's filename concept, "OverwhelmedMind") - that mood
//                                     label stays as-is; this is the exercise's own title.
// @property {string} storagePath   - object path within the private `wellness-videos` bucket
// @property {string} description   - short, non-clinical one-liner for the beta card

/** @type {BetaVideoEntry[]} */
export const BETA_VIDEO_MANIFEST = [
  {
    id: 'E02',
    title: 'Overwhelmed Mind',
    storagePath: 'exercises/WW_E02_OverwhelmedMind_Final_v2.mp4Use.mp4',
    description: 'Too much at once. A guided video to help you set some of it down.'
  },
  {
    id: 'E03',
    title: 'Instant Calm',
    storagePath: 'exercises/WW_E03_InstantCalm_v3.mp4.mp4',
    description: 'A fast, guided reset for your nervous system.'
  },
  {
    id: 'E04',
    title: 'Release Tension',
    storagePath: 'exercises/WW_E04_ReleaseTension_Portrait_v2png.mp4',
    description: 'A short guided sequence to let go of physical tension.'
  },
  {
    id: 'E05',
    title: 'Night-time Calm',
    storagePath: 'exercises/WW_E05_NightTimeCalm_v2.mp4.mp4',
    description: 'A slow wind-down video to ease you toward sleep.'
  },
  {
    id: 'E06',
    title: 'Gentle Awakening',
    storagePath: 'exercises/WW_E06_GentleAwakening_Gratitude_v3.mp3.mp4',
    description: 'A soft guided start to ease into your morning.'
  },
  {
    id: 'E07',
    title: 'Morning Gratitude',
    storagePath: 'exercises/WW_E07_MorningGratitude_Music_v2.mp3.mp4',
    description: 'A short guided moment to set a grateful tone for the day.'
  },
  {
    id: 'E08',
    title: 'Deep Breathing',
    storagePath: 'exercises/WW_E08_DeepBreathing_v2.mp4.mp4',
    description: 'A guided deep-breathing video to center yourself.'
  },
  {
    id: 'E09',
    title: 'Mindful Pause',
    storagePath: 'exercises/WW_E09_MindfulPause_Music_v1.mp3.mp4',
    description: 'A brief guided pause to reset your attention.'
  },
  {
    id: 'E10',
    title: 'Evening Reflection',
    storagePath: 'exercises/WW_E10_EveningReflection_Music_v1.mp3.mp4',
    description: 'A guided reflection to close out your day.'
  },
  {
    id: 'E11',
    title: 'Positive Energy',
    storagePath: 'exercises/WW_E11_PositiveEnergy_Music_v1.mp3.mp4',
    description: 'A guided video to lift your energy and mood.'
  },
  {
    id: 'E12',
    title: 'Confidence Builder',
    storagePath: 'exercises/WW_E12_ConfidenceBuilder_Portrait_v1.png.mp4',
    description: 'A guided video to help you feel steady and self-assured.'
  },
  {
    id: 'E13',
    title: 'Morning Focus',
    storagePath: 'exercises/WW_E13_MorningFocus_BackgroundMusic_v1.mp3.mp4',
    description: 'A guided video to sharpen your focus for the day ahead.'
  },
  {
    id: 'E14',
    title: 'Motivation Boost',
    storagePath: 'exercises/WW_E14_MotivationBoost_BackgroundMusic_v2.mp3.mp4',
    description: 'A guided video to help you find momentum this morning.'
  },
  {
    id: 'E15',
    title: 'A Fresh Start',
    storagePath: 'exercises/WW_E15_AFreshStart_BackgroundMusic_v1.mp3.mp4',
    description: 'A guided video for a clean, hopeful start to your day.'
  },
  {
    id: 'E16',
    title: 'Anxiety Relief',
    storagePath: 'exercises/WW_E16_AnxietyRelief_BackgroundMusic_v1.mp3.mp4',
    description: 'A guided video to ease a racing mind or a tight chest.'
  },
  {
    id: 'E17',
    title: 'Stress Reset',
    storagePath: 'exercises/WW_E17_StressReset_BackgroundMusic_v1.mp3.mp4',
    description: 'A guided video to release built-up stress.'
  },
  {
    id: 'E18',
    title: 'Finding Balance',
    storagePath: 'exercises/WW_E18_FindingBalance_BackgroundMusic_v1.mp3.mp4',
    description: 'A guided video to help you feel steady and centered.'
  },
  {
    id: 'E19',
    title: 'Letting Go',
    storagePath: 'exercises/WW_E19_LettingGo_BackgroundMusic_v1.mp3.mp4',
    description: "A guided video to help you release what isn't yours to carry."
  },
  {
    id: 'E20',
    title: 'Quieting the Mind',
    storagePath: 'exercises/WW_E20_QuietingTheMind_BackgroundMusic_v1.mp3.mp4',
    description: 'A guided video to quiet a busy mind before rest.'
  },
  {
    id: 'E21',
    title: 'Self Compassion',
    storagePath: 'exercises/WW_E21_SelfCompassion_BackgroundMusic_v1.mp3.mp4',
    description: 'A guided video for gentle self-compassion.'
  },
  {
    id: 'E22',
    title: 'Inner Strength',
    storagePath: 'exercises/WW_E22_InnerStrength_Mobile_Background_v1.png.mp4',
    description: 'A guided video to help you feel your own inner strength.'
  },
  {
    id: 'E23',
    title: 'Gratitude',
    storagePath: 'exercises/WW_E23_Gratitude_Mobile_Background_v1.png.mp4',
    description: 'A guided video for a quiet moment of gratitude.'
  },
  {
    id: 'E24',
    title: 'Confidence',
    storagePath: 'exercises/WW_E24_Confidence_BackgroundMusic_v1.mp3.mp4',
    description: 'A guided video to help you feel confident and capable.'
  },
  {
    id: 'E25',
    title: 'Hope and Healing',
    storagePath: 'exercises/WW_E25_HopeAndHealing_BackgroundMusic_v1.mp3.mp4',
    description: 'A guided video for hope and healing.'
  },
  {
    id: 'E26',
    title: 'Self Acceptance',
    storagePath: 'exercises/WW_E26_SelfAcceptance_BackgroundMusic_v1.mp3.mp4',
    description: 'A guided video to help you feel accepted, just as you are.'
  },
  {
    id: 'E27',
    title: 'Deep Relaxation',
    storagePath: 'exercises/WW_E27_DeepRelaxation_BackgroundMusic_v1.mp3.mp4',
    description: 'A guided video for deep physical relaxation.'
  },
  {
    id: 'E28',
    title: 'Mindful Breathing',
    storagePath: 'exercises/WW_E28_MindfulBreathing_v2.mp4.mp4',
    description: 'A guided video for slow, mindful breathing.'
  },
  {
    id: 'E29',
    title: 'Patience',
    storagePath: 'exercises/WW_E29_Patience_BackgroundMusic_v1.mp3.mp4',
    description: 'A guided video to help you find patience.'
  },
  {
    id: 'E30',
    title: 'Peaceful Sleep',
    storagePath: 'exercises/WW_E30_PeacefulSleep_v1.mp4.mp4',
    description: 'A guided video to ease you into peaceful sleep.'
  },
  {
    id: 'A01',
    title: 'Confidence Affirmations',
    storagePath: 'exercises/WW_A01_Confidence_v1.mp4.mp4',
    description: 'A guided affirmation video to help you feel confident and capable.'
  },
  {
    id: 'A02',
    title: 'Calmness Affirmations',
    storagePath: 'exercises/WW_A02_Calmness_v1.mp4.mp4',
    description: 'A guided affirmation video to help you feel calm and settled.'
  },
  {
    id: 'A03',
    title: 'Focus Affirmations',
    storagePath: 'exercises/WW_A03_Focus_v1.mp4.mp4',
    description: 'A guided affirmation video to help sharpen your focus.'
  },
  {
    id: 'A04',
    title: 'Motivation Affirmations',
    storagePath: 'exercises/WW_A04_Motivation_v1.mp4.mp4',
    description: 'A guided affirmation video to help you find momentum.'
  },
  {
    id: 'A05',
    title: 'Gratitude Affirmations',
    storagePath: 'exercises/WW_A05_Gratitude_v2.mp4.mp4',
    description: 'A guided affirmation video for a grateful moment.'
  },
  {
    id: 'A06',
    title: 'Self-Worth Affirmations',
    storagePath: 'exercises/WW_A06_SelfWorth_BackgroundMusic_v1.mp3.mp4',
    description: 'A guided affirmation video to help you feel worthy, just as you are.'
  },
  {
    id: 'B01',
    title: 'Deep Breathing Practice',
    storagePath: 'exercises/WW_B01_DeepBreathing_Mobile_Background_v1.png.mp4',
    description: 'A guided video for a deep breathing practice.'
  },
  {
    id: 'B02',
    title: 'Box Breathing',
    storagePath: 'exercises/WW_B02_BoxBreathing_v1.mp4.mp4',
    description: 'A guided video for box breathing.'
  },
  {
    id: 'B03',
    title: '4-7-8 Breathing',
    storagePath: 'exercises/WW_B03_478Breathing_v1.mp4.mp4',
    description: 'A guided video for 4-7-8 breathing.'
  },
  {
    id: 'B04',
    title: 'Coherent Breathing',
    storagePath: 'exercises/WW_B04_CoherentBreathing_v1.mp4.mp4',
    description: 'A guided video for coherent breathing.'
  },
  {
    id: 'B05',
    title: 'Alternate Nostril Breathing',
    // Storage object name uses "althernativeNostril" (typo, as uploaded) -
    // preserved exactly; the app-facing title uses the recognised
    // technique name "Alternate Nostril Breathing" regardless.
    storagePath: 'exercises/WW_B05_althernativeNostrilBreathing_v1.mp4.mp4',
    description: 'A guided video for alternate nostril breathing.'
  },
  {
    id: 'F01',
    title: 'Deep Work',
    storagePath: 'exercises/WW_F01_DeepWork_v1.mp4.mp4',
    description: 'A guided video to help you settle into deep, focused work.'
  },
  {
    id: 'F02',
    title: 'Study',
    storagePath: 'exercises/WW_F02_Study.mp4.mp4',
    description: 'A guided video to help you focus while studying.'
  },
  {
    id: 'F03',
    title: 'Concentration',
    storagePath: 'exercises/WW_F03_Concentration_v1.mp4.mp4',
    description: 'A guided video to help you sharpen your concentration.'
  },
  {
    id: 'G01',
    title: 'Five Senses',
    storagePath: 'exercises/WW_G01_FiveSenses_v1.mp4.mp4',
    description: 'A guided video to ground yourself through your five senses.'
  },
  {
    id: 'G02',
    title: 'Muscle Relaxation',
    storagePath: 'exercises/WW_G02_MuscleRelaxation_v1.mp4.mp4',
    description: 'A guided video for progressive muscle relaxation.'
  },
  {
    id: 'G03',
    title: 'Body Awareness',
    storagePath: 'exercises/WW_G03_BodyAwareness_v1.mp4.mp4',
    description: 'A guided video to help you reconnect with your body.'
  },
  {
    id: 'G04',
    title: 'Sensory Reset',
    storagePath: 'exercises/WW_G04_SensoryReset_v1.mp4.mp4',
    description: 'A guided video for a quick sensory reset.'
  },
  {
    id: 'M01',
    title: 'Mindfulness Meditation',
    storagePath: 'exercises/WW_M01_MindfulnessMeditation_v1.mp4.mp4',
    description: 'A guided mindfulness meditation.'
  },
  {
    id: 'M02',
    title: 'Body Scan',
    storagePath: 'exercises/WW_M02_BodyScan_v1.mp4.mp4',
    description: 'A guided body scan meditation.'
  },
  {
    id: 'M03',
    title: 'Loving Kindness',
    storagePath: 'exercises/WW_M03_LovingKindness_v1.mp4.mp4',
    description: 'A guided loving kindness meditation.'
  },
  {
    id: 'M04',
    title: 'Gratitude Meditation',
    storagePath: 'exercises/WW_M04_GratitudeMeditation_v1.mp4.mp4',
    description: 'A guided meditation for gratitude.'
  },
  {
    id: 'M05',
    title: 'Guided Reflection',
    storagePath: 'exercises/WW_M05_GuidedReflection_v1.mp4.mp4',
    description: 'A guided meditation for quiet reflection.'
  }
];

export const getBetaVideoById = (id) => BETA_VIDEO_MANIFEST.find((entry) => entry.id === id);
