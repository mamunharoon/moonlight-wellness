// WakeWise — Beta Video Preview (localhost testing pass).
//
// TEMPORARY LOCAL MANIFEST — not a database table. The app has no
// content model for video yet (audioLibrary.js is audio-only, gated by
// Plus subscription, and still fully comingSoon). This file exists only
// because sixty-five narrated exercise videos (E02-E30, A01-A06, B01-B05,
// F01-F03, G01-G04, M01-M05, S01-S05, SL01-SL08) are live in Storage
// today and need a minimal, typed, isolated place to map an id -> title ->
// object path, plus two audio-only interactive-ambient-music loops
// (IB01, IS01 - see their own entries below) that share this exact same
// id/storagePath/signed-URL mechanism but are never narrated exercises
// and are deliberately excluded from Library (mediaCatalog.js's
// INTERACTIVE_ONLY_IDS). When a real "exercises" table exists, replace this file with a
// query and delete it — nothing outside src/lib/betaVideo*.js and
// BetaVideoModal.jsx should ever import it directly.
//
// SL01-SL08 (Sleep Sounds) are the one series here that was never "beta"
// content at all - they ship straight into the real Prepare for Rest
// step of the evening-wind-down journey, presented as an ordinary
// WakeWise feature (no "Watch:"-adjacent beta framing beyond the row
// component itself, no beta badge). They live in this same manifest and
// go through this same signed-URL Edge Function purely for
// infrastructure reuse: get-beta-video-url has never actually checked
// profiles.beta_access (that check was removed from every id here long
// before SL01-SL08 existed - see that function's own header comment) so
// reusing it introduces no new exposure. A separate endpoint would
// duplicate the identical JWT-verification + signing logic for no
// behavioural difference.
//
// `storagePath` is an object path inside the private `wellness-videos`
// bucket (bucket root, includes the `exercises/`/`faststart-v1/`/
// `faststart-v2/` folder) — never a public URL. It is only ever sent to
// the get-beta-video-url Edge Function, which is the one place allowed
// to turn it into a short-lived signed URL. Object names are exactly
// what's in Storage today (verified via `supabase db query --linked`
// against storage.objects for every id, not assumed from any spec) —
// not renamed, typos and double extensions included.
//
// Every path below is a Fast Start (moov-before-mdat) remux of the
// original `exercises/` object, never re-encoded - see
// get-beta-video-url/index.ts's own header comment for what faststart-v1
// vs faststart-v2 means (which remux batch, not a quality difference).
// Every original `exercises/` object remains in Storage for rollback.
//
// @typedef {Object} BetaVideoEntry
// @property {string} id            - stable id sent to the Edge Function (E02-E30, A01-A06, B01-B05, F01-F03, G01-G04, M01-M05, S01-S05, SL01-SL08)
// @property {string} title         - exercise/video title shown on the beta card. Distinct
//                                     from Support.jsx's "I feel overwhelmed" mood-card copy
//                                     (E02's filename concept, "OverwhelmedMind") - that mood
//                                     label stays as-is; this is the exercise's own title.
// @property {string} storagePath   - object path within the private `wellness-videos` bucket
// @property {string} description   - short, non-clinical one-liner for the beta card
// @property {string} [durationLabel] - optional short duration badge (e.g. "5 min"), shown by
//                                       BetaVideoRow only when provided; only SL01-SL08 set this
// @property {string} [musicVariantId] - id of this entry's own pre-mixed "-MUSIC" sibling
//                                        entry (see docs/background-music-specification.md),
//                                        only when one has actually been produced and
//                                        registered below - resolvePlaybackId/
//                                        shouldShowMusicToggle in backgroundMusicSelection.js
//                                        fall back to the plain id whenever this is absent
//                                        or doesn't resolve to a real entry

/** @type {BetaVideoEntry[]} */
export const BETA_VIDEO_MANIFEST = [
  {
    id: 'E02',
    title: 'Overwhelmed Mind',
    storagePath: 'faststart-v1/WW_E02_OverwhelmedMind_Final_v2.mp4Use_faststart.mp4',
    description: 'Too much at once. A guided video to help you set some of it down.'
  },
  {
    id: 'E03',
    title: 'Instant Calm',
    storagePath: 'faststart-v1/WW_E03_InstantCalm_v3.mp4_faststart.mp4',
    description: 'A fast, guided reset for your nervous system.'
  },
  {
    id: 'E04',
    title: 'Release Tension',
    storagePath: 'faststart-v2/WW_E04_ReleaseTension_Portrait_v2png_faststart.mp4',
    description: 'A short guided sequence to let go of physical tension.'
  },
  {
    id: 'E05',
    title: 'Night-time Calm',
    storagePath: 'faststart-v2/WW_E05_NightTimeCalm_v2.mp4_faststart.mp4',
    description: 'A slow wind-down video to ease you toward sleep.'
  },
  {
    id: 'E06',
    title: 'Gentle Awakening',
    storagePath: 'faststart-v2/WW_E06_GentleAwakening_Gratitude_v3.mp3_faststart.mp4',
    description: 'A soft guided start to ease into your morning.'
  },
  {
    id: 'E07',
    title: 'Morning Gratitude',
    storagePath: 'faststart-v1/WW_E07_MorningGratitude_Music_v2.mp3_faststart.mp4',
    description: 'A short guided moment to set a grateful tone for the day.'
  },
  {
    id: 'E08',
    title: 'Deep Breathing',
    storagePath: 'faststart-v1/WW_E08_DeepBreathing_v2.mp4_faststart.mp4',
    description: 'A guided deep-breathing video to center yourself.'
  },
  {
    id: 'E09',
    title: 'Mindful Pause',
    storagePath: 'faststart-v1/WW_E09_MindfulPause_Music_v1.mp3_faststart.mp4',
    description: 'A brief guided pause to reset your attention.'
  },
  {
    id: 'E10',
    title: 'Evening Reflection',
    storagePath: 'faststart-v1/WW_E10_EveningReflection_Music_v1.mp3_faststart.mp4',
    description: 'A guided reflection to close out your day.'
  },
  {
    id: 'E11',
    title: 'Positive Energy',
    storagePath: 'faststart-v2/WW_E11_PositiveEnergy_Music_v1.mp3_faststart.mp4',
    description: 'A guided video to lift your energy and mood.'
  },
  {
    id: 'E12',
    title: 'Confidence Builder',
    storagePath: 'faststart-v1/WW_E12_ConfidenceBuilder_Portrait_v1.png_faststart.mp4',
    description: 'A guided video to help you feel steady and self-assured.'
  },
  {
    id: 'E13',
    title: 'Morning Focus',
    storagePath: 'faststart-v2/WW_E13_MorningFocus_BackgroundMusic_v1.mp3_faststart.mp4',
    description: 'A guided video to sharpen your focus for the day ahead.'
  },
  {
    id: 'E14',
    title: 'Motivation Boost',
    storagePath: 'faststart-v1/WW_E14_MotivationBoost_BackgroundMusic_v2.mp3_faststart.mp4',
    description: 'A guided video to help you find momentum this morning.'
  },
  {
    id: 'E15',
    title: 'A Fresh Start',
    storagePath: 'faststart-v1/WW_E15_AFreshStart_BackgroundMusic_v1.mp3_faststart.mp4',
    description: 'A guided video for a clean, hopeful start to your day.'
  },
  {
    id: 'E16',
    title: 'Anxiety Relief',
    storagePath: 'faststart-v1/WW_E16_AnxietyRelief_BackgroundMusic_v1.mp3_faststart.mp4',
    description: 'A guided video to ease a racing mind or a tight chest.'
  },
  {
    id: 'E17',
    title: 'Stress Reset',
    storagePath: 'faststart-v1/WW_E17_StressReset_BackgroundMusic_v1.mp3_faststart.mp4',
    description: 'A guided video to release built-up stress.'
  },
  {
    id: 'E18',
    title: 'Finding Balance',
    storagePath: 'faststart-v1/WW_E18_FindingBalance_BackgroundMusic_v1.mp3_faststart.mp4',
    description: 'A guided video to help you feel steady and centered.'
  },
  {
    id: 'E19',
    title: 'Letting Go',
    storagePath: 'faststart-v1/WW_E19_LettingGo_BackgroundMusic_v1.mp3_faststart.mp4',
    description: "A guided video to help you release what isn't yours to carry."
  },
  {
    id: 'E20',
    title: 'Quieting the Mind',
    storagePath: 'faststart-v1/WW_E20_QuietingTheMind_BackgroundMusic_v1.mp3_faststart.mp4',
    description: 'A guided video to quiet a busy mind before rest.'
  },
  {
    id: 'E21',
    title: 'Self Compassion',
    storagePath: 'faststart-v1/WW_E21_SelfCompassion_BackgroundMusic_v1.mp3_faststart.mp4',
    description: 'A guided video for gentle self-compassion.'
  },
  {
    id: 'E22',
    title: 'Inner Strength',
    storagePath: 'faststart-v1/WW_E22_InnerStrength_Mobile_Background_v1.png_faststart.mp4',
    description: 'A guided video to help you feel your own inner strength.'
  },
  {
    id: 'E23',
    title: 'Gratitude',
    storagePath: 'faststart-v1/WW_E23_Gratitude_Mobile_Background_v1.png_faststart.mp4',
    description: 'A guided video for a quiet moment of gratitude.'
  },
  {
    id: 'E24',
    title: 'Confidence',
    storagePath: 'faststart-v1/WW_E24_Confidence_BackgroundMusic_v1.mp3_faststart.mp4',
    description: 'A guided video to help you feel confident and capable.'
  },
  {
    id: 'E25',
    title: 'Hope and Healing',
    storagePath: 'faststart-v1/WW_E25_HopeAndHealing_BackgroundMusic_v1.mp3_faststart.mp4',
    description: 'A guided video for hope and healing.'
  },
  {
    id: 'E26',
    title: 'Self Acceptance',
    storagePath: 'faststart-v1/WW_E26_SelfAcceptance_BackgroundMusic_v1.mp3_faststart.mp4',
    description: 'A guided video to help you feel accepted, just as you are.'
  },
  {
    id: 'E27',
    title: 'Deep Relaxation',
    storagePath: 'faststart-v1/WW_E27_DeepRelaxation_BackgroundMusic_v1.mp3_faststart.mp4',
    description: 'A guided video for deep physical relaxation.'
  },
  {
    id: 'E28',
    title: 'Mindful Breathing',
    storagePath: 'faststart-v1/WW_E28_MindfulBreathing_v2.mp4_faststart.mp4',
    description: 'A guided video for slow, mindful breathing.'
  },
  {
    id: 'E29',
    title: 'Patience',
    storagePath: 'faststart-v1/WW_E29_Patience_BackgroundMusic_v1.mp3_faststart.mp4',
    description: 'A guided video to help you find patience.'
  },
  {
    id: 'E30',
    title: 'Peaceful Sleep',
    storagePath: 'faststart-v1/WW_E30_PeacefulSleep_v1.mp4_faststart.mp4',
    description: 'A guided video to ease you into peaceful sleep.'
  },
  {
    id: 'A01',
    title: 'Confidence Affirmations',
    storagePath: 'faststart-v1/WW_A01_Confidence_v1.mp4_faststart.mp4',
    description: 'A guided affirmation video to help you feel confident and capable.'
  },
  {
    id: 'A02',
    title: 'Calmness Affirmations',
    storagePath: 'faststart-v1/WW_A02_Calmness_v1.mp4_faststart.mp4',
    description: 'A guided affirmation video to help you feel calm and settled.'
  },
  {
    id: 'A03',
    title: 'Focus Affirmations',
    storagePath: 'faststart-v1/WW_A03_Focus_v1.mp4_faststart.mp4',
    description: 'A guided affirmation video to help sharpen your focus.'
  },
  {
    id: 'A04',
    title: 'Motivation Affirmations',
    storagePath: 'faststart-v1/WW_A04_Motivation_v1.mp4_faststart.mp4',
    description: 'A guided affirmation video to help you find momentum.'
  },
  {
    id: 'A05',
    title: 'Gratitude Affirmations',
    storagePath: 'faststart-v1/WW_A05_Gratitude_v2.mp4_faststart.mp4',
    description: 'A guided affirmation video for a grateful moment.'
  },
  {
    id: 'A06',
    title: 'Self-Worth Affirmations',
    storagePath: 'faststart-v1/WW_A06_SelfWorth_BackgroundMusic_v1.mp3_faststart.mp4',
    description: 'A guided affirmation video to help you feel worthy, just as you are.'
  },
  {
    id: 'B01',
    title: 'Deep Breathing Practice',
    storagePath: 'faststart-v1/WW_B01_DeepBreathing_Mobile_Background_v1.png_faststart.mp4',
    description: 'A guided video for a deep breathing practice.'
  },
  {
    id: 'B02',
    title: 'Box Breathing',
    storagePath: 'faststart-v1/WW_B02_BoxBreathing_v1.mp4_faststart.mp4',
    description: 'A guided video for box breathing.'
  },
  {
    id: 'B03',
    title: '4-7-8 Breathing',
    storagePath: 'faststart-v1/WW_B03_478Breathing_v1.mp4_faststart.mp4',
    description: 'A guided video for 4-7-8 breathing.'
  },
  {
    id: 'B04',
    title: 'Coherent Breathing',
    storagePath: 'faststart-v1/WW_B04_CoherentBreathing_v1.mp4_faststart.mp4',
    description: 'A guided video for coherent breathing.'
  },
  {
    id: 'B05',
    title: 'Alternate Nostril Breathing',
    // Storage object name uses "althernativeNostril" (typo, as uploaded) -
    // preserved exactly; the app-facing title uses the recognised
    // technique name "Alternate Nostril Breathing" regardless.
    storagePath: 'faststart-v1/WW_B05_althernativeNostrilBreathing_v1.mp4_faststart.mp4',
    description: 'A guided video for alternate nostril breathing.'
  },
  {
    // Interactive-ambient-music loop, not a narrated exercise - audio-only
    // (.m4a, no video track), used exclusively by
    // InteractiveAmbientMusic.jsx as the shared background bed for
    // EveningBreathing.jsx/QuietBreathing.jsx/Breathe.jsx's own silent
    // Inhale/Hold/Exhale timers (see docs/background-music-specification.md
    // §3a and docs/background-music-asset-manifest.md for the full audit -
    // "audio-only AAC/.m4a" was confirmed safe end-to-end there).
    // v2 (replaces the v1 synthetic pad): a real musical source, provided
    // as MP3 (192kbps/48kHz/stereo, measured -17.0 LUFS/-6.2 dBFS true
    // peak) and converted to AAC-LC/.m4a in one pass - a single static
    // +1.0 dB gain (no dynamics processing, no fades, duration untouched)
    // to land at exactly -16.0 LUFS, AAC-encoded at ~195kbps. Final
    // measured: AAC-LC, stereo, 48kHz, 60.048s (unchanged from source),
    // -16.0 LUFS integrated, -5.2 dBFS true peak. The MP4 container's own
    // edit list preserves the exact source sample count (2,882,304 @
    // 48kHz) with no encoder priming/padding audible at the boundary at
    // the file level - native <audio loop> gapless behavior at that
    // boundary is still browser/engine-dependent and was not verified
    // against real hardware playback; treat perceptual loop-seam
    // smoothness as unconfirmed until checked on a physical device.
    // Deliberately excluded from MEDIA_CATALOG/Library (see
    // mediaCatalog.js's own INTERACTIVE_ONLY_IDS) - this is never a
    // user-selectable "Watch" row, only an internal getBetaVideoById()
    // lookup target for eligibility-checking.
    id: 'IB01',
    title: 'Interactive Breathing Loop',
    storagePath: 'faststart-v1/WW_IB01_InteractiveBreathingLoop_MusicBed_v2_faststart.m4a',
    description: 'Ambient background loop for interactive breathing/grounding timers.'
  },
  {
    id: 'F01',
    title: 'Deep Work',
    storagePath: 'faststart-v1/WW_F01_DeepWork_v1.mp4_faststart.mp4',
    description: 'A guided video to help you settle into deep, focused work.'
  },
  {
    id: 'F02',
    title: 'Study',
    storagePath: 'faststart-v1/WW_F02_Study.mp4_faststart.mp4',
    description: 'A guided video to help you focus while studying.'
  },
  {
    id: 'F03',
    title: 'Concentration',
    storagePath: 'faststart-v1/WW_F03_Concentration_v1.mp4_faststart.mp4',
    description: 'A guided video to help you sharpen your concentration.'
  },
  {
    id: 'G01',
    title: 'Five Senses',
    storagePath: 'faststart-v1/WW_G01_FiveSenses_v1.mp4_faststart.mp4',
    description: 'A guided video to ground yourself through your five senses.'
  },
  {
    id: 'G02',
    title: 'Muscle Relaxation',
    storagePath: 'faststart-v1/WW_G02_MuscleRelaxation_v1.mp4_faststart.mp4',
    description: 'A guided video for progressive muscle relaxation.'
  },
  {
    id: 'G03',
    title: 'Body Awareness',
    storagePath: 'faststart-v1/WW_G03_BodyAwareness_v1.mp4_faststart.mp4',
    description: 'A guided video to help you reconnect with your body.'
  },
  {
    id: 'G04',
    title: 'Sensory Reset',
    storagePath: 'faststart-v1/WW_G04_SensoryReset_v1.mp4_faststart.mp4',
    description: 'A guided video for a quick sensory reset.'
  },
  {
    id: 'M01',
    title: 'Mindfulness Meditation',
    storagePath: 'faststart-v1/WW_M01_MindfulnessMeditation_v1.mp4_faststart.mp4',
    description: 'A guided mindfulness meditation.'
  },
  {
    id: 'M02',
    title: 'Body Scan',
    storagePath: 'faststart-v1/WW_M02_BodyScan_v1.mp4_faststart.mp4',
    description: 'A guided body scan meditation.'
  },
  {
    id: 'M03',
    title: 'Loving Kindness',
    storagePath: 'faststart-v1/WW_M03_LovingKindness_v1.mp4_faststart.mp4',
    description: 'A guided loving kindness meditation.'
  },
  {
    id: 'M04',
    title: 'Gratitude Meditation',
    storagePath: 'faststart-v1/WW_M04_GratitudeMeditation_v1.mp4_faststart.mp4',
    description: 'A guided meditation for gratitude.'
  },
  {
    id: 'M05',
    title: 'Guided Reflection',
    storagePath: 'faststart-v1/WW_M05_GuidedReflection_v1.mp4_faststart.mp4',
    description: 'A guided meditation for quiet reflection.'
  },
  {
    // S01-MUSIC (the pre-mixed narrated+music variant) was removed here -
    // that approach no longer represents the approved architecture
    // (interactive-only ambient loops, IB01/IS01, never mixed into a
    // narrated video). The original, narration-only entry below is exactly
    // what it was before S01-MUSIC ever existed - untouched storagePath,
    // no musicVariantId. WW_S01_NeckRelease_MusicBed_v2.mp4 itself is left
    // in Storage, unreferenced by any code path, per the explicit
    // instruction not to delete it.
    id: 'S01',
    title: 'Neck Release',
    storagePath: 'faststart-v1/WW_S01_NeckRelease_v1.mp4_faststart.mp4',
    description: 'A guided video to release tension in your neck.'
  },
  {
    id: 'S02',
    title: 'Shoulder Release',
    storagePath: 'faststart-v1/WW_S02_ShoulderRelease_v1.mp4_faststart.mp4',
    description: 'A guided video to release tension in your shoulders.'
  },
  {
    id: 'S03',
    title: 'Upper-Back Stretch',
    storagePath: 'faststart-v1/WW_S03_UpperBackStretch_v1.mp4_faststart.mp4',
    description: 'A guided video to stretch your upper back.'
  },
  {
    id: 'S04',
    title: 'Morning Flow',
    storagePath: 'faststart-v1/WW_S04_MorningFlow_v1.mp4_faststart.mp4',
    description: 'A guided morning stretching flow.'
  },
  {
    id: 'S05',
    title: 'Evening Flow',
    storagePath: 'faststart-v1/WW_S05_EveningFlow_v1.mp4_faststart.mp4',
    description: 'A guided evening stretching flow.'
  },
  {
    // Interactive-ambient-music loop for MorningFlow.jsx's own silent
    // 4-exercise stretch timer - same role as IB01 above, distinct asset
    // (slightly brighter/warmer track), never mixed into any narrated
    // S01-S05 video. v2 (replaces the v1 synthetic pad): source MP3
    // measured -13.8 LUFS/-1.6 dBFS true peak, converted to AAC-LC/.m4a in
    // one pass with a single static -2.2 dB gain (no dynamics processing,
    // no fades, duration untouched) to land at exactly -16.0 LUFS. Final
    // measured: AAC-LC, stereo, 48kHz, 60.072s (unchanged from source),
    // -16.0 LUFS integrated, -3.9 dBFS true peak, exact source sample
    // count preserved via the MP4 edit list. See IB01's own comment above
    // for the shared caveat on native <audio loop> gapless behavior at the
    // boundary - not verified against real hardware playback. Also
    // excluded from MEDIA_CATALOG/Library - see mediaCatalog.js's
    // INTERACTIVE_ONLY_IDS.
    id: 'IS01',
    title: 'Interactive Stretching Loop',
    storagePath: 'faststart-v1/WW_IS01_InteractiveStretchingLoop_MusicBed_v2_faststart.m4a',
    description: 'Ambient background loop for the interactive stretching timer.'
  },
  {
    id: 'SL01',
    title: 'Rain',
    storagePath: 'faststart-v1/WW_SL01_Rain_v1_faststart.mp4',
    description: 'Settle into the steady rhythm of gentle rain.',
    durationLabel: '5 min'
  },
  {
    id: 'SL02',
    title: 'Ocean Waves',
    storagePath: 'faststart-v1/WW_SL02_OceanWaves_Preview_v1_faststart.mp4',
    description: 'Rest with slow waves meeting a quiet shore.',
    durationLabel: '5 min'
  },
  {
    id: 'SL03',
    title: 'Forest Ambience',
    storagePath: 'faststart-v1/WW_SL03_ForestAmbience_v1_faststart.mp4',
    description: 'Unwind among soft woodland sounds.',
    durationLabel: '5 min'
  },
  {
    id: 'SL04',
    title: 'Fireplace',
    storagePath: 'faststart-v1/WW_SL04_Fireplace_v1_faststart.mp4',
    description: 'Relax beside the warmth of a gently crackling fire.',
    durationLabel: '5 min'
  },
  {
    id: 'SL05',
    title: 'Gentle Wind',
    // Storage object name has a doubled extension (".mp4.mp4", as
    // uploaded) - preserved exactly.
    storagePath: 'faststart-v1/WW_SL05_Wind_v1.mp4_faststart.mp4',
    description: 'Drift off with a soft breeze across an open meadow.',
    durationLabel: '5 min'
  },
  {
    id: 'SL06',
    title: 'White Noise',
    storagePath: 'faststart-v1/WW_SL06_WhiteNoise_v1.mp4_faststart.mp4',
    description: 'A steady sound to soften surrounding distractions.',
    durationLabel: '5 min'
  },
  {
    id: 'SL07',
    title: 'Pink Noise',
    storagePath: 'faststart-v1/WW_SL07_PinkNoise_v1.mp4_faststart.mp4',
    description: 'A balanced, gentle sound for restful sleep.',
    durationLabel: '5 min'
  },
  {
    id: 'SL08',
    title: 'Brown Noise',
    storagePath: 'faststart-v1/WW_SL08_BrownNoise_v1.mp4_faststart.mp4',
    description: 'A deeper, softer sound for calm and focus.',
    durationLabel: '5 min'
  },
  // Introduction guide videos - see mediaCatalog.js's INTERACTIVE_ONLY_IDS
  // (I01/I02 are added there too): never a Library-browsable "Watch" row,
  // only reachable via getBetaVideoById() from Introduction.jsx itself.
  // Verified live against storage.objects (name, mimetype, size) before
  // use - single ".mp4" extension, not the double-extension pattern seen
  // on several older exercise uploads above.
  {
    id: 'I01',
    title: 'Why WakeWise',
    storagePath: 'faststart-v1/WW_I01_WelcomeToWakeWise_v1_faststart.mp4',
    description: 'A brief introduction to the purpose of WakeWise and how it can support your daily wellbeing.'
  },
  {
    id: 'I02',
    title: 'How to Use WakeWise',
    storagePath: 'faststart-v1/WW_I02_HowToUseWakeWise_v1_faststart.mp4',
    description: 'A quick guide to Morning, Evening, calming practices and the Library.'
  }
];

export const getBetaVideoById = (id) => BETA_VIDEO_MANIFEST.find((entry) => entry.id === id);
