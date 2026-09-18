# WakeWise — Background Music: Complete Media Audit and Asset-Production Manifest (Phase B)

Companion to `docs/background-music-specification.md` (architecture decision, mixing spec, licensing requirements — all still in force and not repeated in full here). This document is the concrete, per-item inventory that spec asked for: what exists today, what's eligible, what Mamun needs to produce, and exactly what filename/Storage destination each new file goes to.

**No music asset (licensed or placeholder) is bundled, uploaded, generated, or claimed as licensed by this phase.** Every "proposed" filename below is a planning artifact only — nothing at that path exists in Storage yet, and no code references it (see the engineering summary at the end of this document for exactly what *is* wired today).

---

## 1. Source of truth

This audit covers the one *live, playable* media catalogue: `src/lib/betaVideoManifest.js` (65 ids: `E02`–`E30`, `A01`–`A06`, `B01`–`B05`, `F01`–`F03`, `G01`–`G04`, `M01`–`M05`, `S01`–`S05`, `SL01`–`SL08`), enriched with category/placement metadata by `src/lib/mediaCatalog.js`. All 65 objects are verified to exist in the private `wellness-videos` Storage bucket today (see `betaVideoManifest.js`'s own header comment — object paths were checked against `storage.objects` directly, not assumed).

`docs/audio-content-specification.md`'s 39 sessions are a **separate, not-yet-live** catalogue (`audioLibrary.js` / `AudioLibrary.jsx` / `AudioCategory.jsx` / `AudioDetails.jsx` are explicit stubs — "No audio plays yet" per those pages' own doc comments, confirmed by code inspection this phase). That catalogue has no real Storage assets and no player wired up at all, so it is **out of scope for a background-music variant** until it goes live — nothing here treats it as eligible today. Where a session name overlaps conceptually (e.g. its own "Loving Kindness" / "Guided Reflection" background-sound picks), this document notes it as a *precedent for the recommended background type*, not as the same asset.

**Duration policy — do not fabricate.** This codebase has an established rule against estimating video duration from filename or file size (`durationCache.js`'s own doc comment: an earlier size-based estimate was off by 3x and the approach was discarded). Verified real durations exist for only 10 of the 65 ids (the ones already meditation-tagged in `mediaCatalog.js`'s `MEDITATION_METADATA`). **Every `-MUSIC` variant's duration must exactly match its corresponding existing narration file's own real runtime — measured by opening that file, not guessed.** Where a verified duration is already known it's listed below for convenience; everywhere else, "match existing file" is the actual instruction.

---

## 2. Category-level eligibility and recommended background type

| Category | Eligible for music? | Recommended background type |
|---|---|---|
| Morning | Yes | **Light Uplifting Morning Bed** — soft acoustic guitar/piano, gentle mid-tempo, brightening tone |
| Positive Energy & Confidence | Yes | **Warm Uplifting Bed** — subtle rhythmic pulse, brighter major-key tone |
| Calm & Support | Yes | **Calm Ambient Pad** — soft sustained pads, minimal movement, no percussion |
| Breathing | Yes | **Minimal Textural Bed** — steady drone/pad only, no rhythmic pulse (must never fight the spoken breath-count cadence) |
| Gratitude & Reflection | Yes | **Warm Reflective Bed** — soft piano/strings, gentle sustained tone |
| Evening Wind-Down | Yes | **Calm Evening Bed** — slow pads, warm low tones, minimal movement (two items have a documented nature-texture precedent — see notes) |
| Stretching | Yes | Morning items: **Light Uplifting Acoustic Bed**. Evening/general items: **Calm Ambient Pad** |
| Sleep Soundscapes | **No — excluded, hard requirement** | N/A — the background sound already *is* the content; layering music on top would compete with, not support, the existing ambience |

**Morning/Evening breathing *stages* specifically (as asked for by name):**
- **Morning** breathing stage = `/breathe` (`Breathe.jsx`) → uses `E08`, `E28`, `B01`–`B05` (all in scope below, Breathing category).
- **Evening** breathing stage = `/evening-breathing` (`EveningBreathing.jsx`) → **has no existing video/narration asset of any kind** — confirmed by source inspection (no `useProtectedVideo`, no `BetaVideoModal` import; it's a pure animated breathing-ring timer, same as `QuietBreathing.jsx`). There is nothing to remix a music bed into and nothing to fall back to either — **not eligible, not applicable**, not a gap this phase can close (would require commissioning an entirely new narrated asset, out of scope for a music-only phase).

---

## 3. Full 65-id inventory

Filenames are exactly what's live today (typos/double-extensions preserved, per `betaVideoManifest.js`'s own header note). Proposed `-MUSIC` filenames follow one clean, unambiguous new convention — `WW_<ID>_<Slug>_MusicBed_v1.mp4` — deliberately not reusing the inconsistent `_Music_`/`_BackgroundMusic_`/plain naming already present across the existing files (several already-live filenames contain "Music"/"BackgroundMusic" in their own name; this is an artifact of the original production/editing process, not evidence that a second, separate music-bed variant already exists — every id below currently has exactly one file, and that one file is untouched, unchanged, and remains the "without music" default regardless of what its own filename happens to contain).

All proposed variants land in the same bucket/folder as everything else: **`exercises/` in the private `wellness-videos` Storage bucket.**

### Morning

| ID | Title | Existing filename (unchanged) | Proposed `-MUSIC` filename | Background type |
|---|---|---|---|---|
| E06 | Gentle Awakening | `WW_E06_GentleAwakening_Gratitude_v3.mp3.mp4` | `WW_E06_GentleAwakening_MusicBed_v1.mp4` | Light Uplifting Morning Bed |
| E07 | Morning Gratitude | `WW_E07_MorningGratitude_Music_v2.mp3.mp4` | `WW_E07_MorningGratitude_MusicBed_v1.mp4` | Light Uplifting Morning Bed |
| E13 | Morning Focus | `WW_E13_MorningFocus_BackgroundMusic_v1.mp3.mp4` | `WW_E13_MorningFocus_MusicBed_v1.mp4` | Light Uplifting Morning Bed |
| E15 | A Fresh Start | `WW_E15_AFreshStart_BackgroundMusic_v1.mp3.mp4` | `WW_E15_AFreshStart_MusicBed_v1.mp4` | Light Uplifting Morning Bed |
| F01 | Deep Work | `WW_F01_DeepWork_v1.mp4.mp4` | `WW_F01_DeepWork_MusicBed_v1.mp4` | Light Uplifting Morning Bed *(verify narration is actually present before mixing — title suggests this may already be closer to the ambient "Focus" style in `audio-content-specification.md`, which explicitly excludes music beds; confirm by ear first)* |
| F02 | Study | `WW_F02_Study.mp4.mp4` | `WW_F02_Study_MusicBed_v1.mp4` | Same caveat as F01 |
| F03 | Concentration | `WW_F03_Concentration_v1.mp4.mp4` | `WW_F03_Concentration_MusicBed_v1.mp4` | Same caveat as F01 |

### Positive Energy & Confidence

| ID | Title | Existing filename | Proposed `-MUSIC` filename | Background type |
|---|---|---|---|---|
| E11 | Positive Energy | `WW_E11_PositiveEnergy_Music_v1.mp3.mp4` | `WW_E11_PositiveEnergy_MusicBed_v1.mp4` | Warm Uplifting Bed |
| E12 | Confidence Builder | `WW_E12_ConfidenceBuilder_Portrait_v1.png.mp4` | `WW_E12_ConfidenceBuilder_MusicBed_v1.mp4` | Warm Uplifting Bed |
| E14 | Motivation Boost | `WW_E14_MotivationBoost_BackgroundMusic_v2.mp3.mp4` | `WW_E14_MotivationBoost_MusicBed_v1.mp4` | Warm Uplifting Bed |
| E24 | Confidence | `WW_E24_Confidence_BackgroundMusic_v1.mp3.mp4` | `WW_E24_Confidence_MusicBed_v1.mp4` | Warm Uplifting Bed |
| A01 | Confidence Affirmations | `WW_A01_Confidence_v1.mp4.mp4` | `WW_A01_ConfidenceAffirmations_MusicBed_v1.mp4` | Warm Uplifting Bed |
| A04 | Motivation Affirmations | `WW_A04_Motivation_v1.mp4.mp4` | `WW_A04_MotivationAffirmations_MusicBed_v1.mp4` | Warm Uplifting Bed |

### Calm & Support

| ID | Title | Existing filename | Proposed `-MUSIC` filename | Background type |
|---|---|---|---|---|
| E02 | Overwhelmed Mind | `WW_E02_OverwhelmedMind_Final_v2.mp4Use.mp4` | `WW_E02_OverwhelmedMind_MusicBed_v1.mp4` | Calm Ambient Pad |
| E03 | Instant Calm | `WW_E03_InstantCalm_v3.mp4.mp4` | `WW_E03_InstantCalm_MusicBed_v1.mp4` | Calm Ambient Pad *(verified 100s narration)* |
| E09 | Mindful Pause | `WW_E09_MindfulPause_Music_v1.mp3.mp4` | `WW_E09_MindfulPause_MusicBed_v1.mp4` | Calm Ambient Pad |
| E16 | Anxiety Relief | `WW_E16_AnxietyRelief_BackgroundMusic_v1.mp3.mp4` | `WW_E16_AnxietyRelief_MusicBed_v1.mp4` | Calm Ambient Pad |
| E17 | Stress Reset | `WW_E17_StressReset_BackgroundMusic_v1.mp3.mp4` | `WW_E17_StressReset_MusicBed_v1.mp4` | Calm Ambient Pad |
| E18 | Finding Balance | `WW_E18_FindingBalance_BackgroundMusic_v1.mp3.mp4` | `WW_E18_FindingBalance_MusicBed_v1.mp4` | Calm Ambient Pad |
| E19 | Letting Go | `WW_E19_LettingGo_BackgroundMusic_v1.mp3.mp4` | `WW_E19_LettingGo_MusicBed_v1.mp4` | Calm Ambient Pad |
| G01 | Five Senses | `WW_G01_FiveSenses_v1.mp4.mp4` | `WW_G01_FiveSenses_MusicBed_v1.mp4` | Calm Ambient Pad |
| G02 | Muscle Relaxation | `WW_G02_MuscleRelaxation_v1.mp4.mp4` | `WW_G02_MuscleRelaxation_MusicBed_v1.mp4` | Calm Ambient Pad |
| G03 | Body Awareness | `WW_G03_BodyAwareness_v1.mp4.mp4` | `WW_G03_BodyAwareness_MusicBed_v1.mp4` | Calm Ambient Pad |
| G04 | Sensory Reset | `WW_G04_SensoryReset_v1.mp4.mp4` | `WW_G04_SensoryReset_MusicBed_v1.mp4` | Calm Ambient Pad |

### Breathing

| ID | Title | Existing filename | Proposed `-MUSIC` filename | Background type |
|---|---|---|---|---|
| E08 | Deep Breathing | `WW_E08_DeepBreathing_v2.mp4.mp4` | `WW_E08_DeepBreathing_MusicBed_v1.mp4` | Minimal Textural Bed *(verified 120s narration)* |
| E28 | Mindful Breathing | `WW_E28_MindfulBreathing_v2.mp4.mp4` | `WW_E28_MindfulBreathing_MusicBed_v1.mp4` | Minimal Textural Bed |
| B01 | Deep Breathing Practice | `WW_B01_DeepBreathing_Mobile_Background_v1.png.mp4` | `WW_B01_DeepBreathingPractice_MusicBed_v1.mp4` | Minimal Textural Bed |
| B02 | Box Breathing | `WW_B02_BoxBreathing_v1.mp4.mp4` | `WW_B02_BoxBreathing_MusicBed_v1.mp4` | Minimal Textural Bed *(verified 180s narration)* |
| B03 | 4-7-8 Breathing | `WW_B03_478Breathing_v1.mp4.mp4` | `WW_B03_478Breathing_MusicBed_v1.mp4` | Minimal Textural Bed |
| B04 | Coherent Breathing | `WW_B04_CoherentBreathing_v1.mp4.mp4` | `WW_B04_CoherentBreathing_MusicBed_v1.mp4` | Minimal Textural Bed |
| B05 | Alternate Nostril Breathing | `WW_B05_althernativeNostrilBreathing_v1.mp4.mp4` | `WW_B05_AlternateNostrilBreathing_MusicBed_v1.mp4` | Minimal Textural Bed |

### Gratitude & Reflection

| ID | Title | Existing filename | Proposed `-MUSIC` filename | Background type |
|---|---|---|---|---|
| E04 | Release Tension | `WW_E04_ReleaseTension_Portrait_v2png.mp4` | `WW_E04_ReleaseTension_MusicBed_v1.mp4` | Warm Reflective Bed *(verified 110s narration)* |
| E21 | Self Compassion | `WW_E21_SelfCompassion_BackgroundMusic_v1.mp3.mp4` | `WW_E21_SelfCompassion_MusicBed_v1.mp4` | Warm Reflective Bed |
| E22 | Inner Strength | `WW_E22_InnerStrength_Mobile_Background_v1.png.mp4` | `WW_E22_InnerStrength_MusicBed_v1.mp4` | Warm Reflective Bed |
| E23 | Gratitude | `WW_E23_Gratitude_Mobile_Background_v1.png.mp4` | `WW_E23_Gratitude_MusicBed_v1.mp4` | Warm Reflective Bed |
| E25 | Hope and Healing | `WW_E25_HopeAndHealing_BackgroundMusic_v1.mp3.mp4` | `WW_E25_HopeAndHealing_MusicBed_v1.mp4` | Warm Reflective Bed |
| E26 | Self Acceptance | `WW_E26_SelfAcceptance_BackgroundMusic_v1.mp3.mp4` | `WW_E26_SelfAcceptance_MusicBed_v1.mp4` | Warm Reflective Bed |
| E29 | Patience | `WW_E29_Patience_BackgroundMusic_v1.mp3.mp4` | `WW_E29_Patience_MusicBed_v1.mp4` | Warm Reflective Bed |
| A02 | Calmness Affirmations | `WW_A02_Calmness_v1.mp4.mp4` | `WW_A02_CalmnessAffirmations_MusicBed_v1.mp4` | Warm Reflective Bed |
| A03 | Focus Affirmations | `WW_A03_Focus_v1.mp4.mp4` | `WW_A03_FocusAffirmations_MusicBed_v1.mp4` | Warm Reflective Bed |
| A05 | Gratitude Affirmations | `WW_A05_Gratitude_v2.mp4.mp4` | `WW_A05_GratitudeAffirmations_MusicBed_v1.mp4` | Warm Reflective Bed |
| A06 | Self-Worth Affirmations | `WW_A06_SelfWorth_BackgroundMusic_v1.mp3.mp4` | `WW_A06_SelfWorthAffirmations_MusicBed_v1.mp4` | Warm Reflective Bed |

### Evening Wind-Down

| ID | Title | Existing filename | Proposed `-MUSIC` filename | Background type |
|---|---|---|---|---|
| E05 | Night-time Calm | `WW_E05_NightTimeCalm_v2.mp4.mp4` | `WW_E05_NightTimeCalm_MusicBed_v1.mp4` | Calm Evening Bed |
| E10 | Evening Reflection | `WW_E10_EveningReflection_Music_v1.mp3.mp4` | `WW_E10_EveningReflection_MusicBed_v1.mp4` | Calm Evening Bed |
| E20 | Quieting the Mind | `WW_E20_QuietingTheMind_BackgroundMusic_v1.mp3.mp4` | `WW_E20_QuietingTheMind_MusicBed_v1.mp4` | Calm Evening Bed |
| E27 | Deep Relaxation | `WW_E27_DeepRelaxation_BackgroundMusic_v1.mp3.mp4` | `WW_E27_DeepRelaxation_MusicBed_v1.mp4` | Calm Evening Bed *(verified 155s narration)* |
| E30 | Peaceful Sleep | `WW_E30_PeacefulSleep_v1.mp4.mp4` | `WW_E30_PeacefulSleep_MusicBed_v1.mp4` | Calm Evening Bed |
| M01 | Mindfulness Meditation | `WW_M01_MindfulnessMeditation_v1.mp4.mp4` | `WW_M01_MindfulnessMeditation_MusicBed_v1.mp4` | Calm Evening Bed *(verified 215s narration)* |
| M02 | Body Scan | `WW_M02_BodyScan_v1.mp4.mp4` | `WW_M02_BodyScan_MusicBed_v1.mp4` | Calm Evening Bed *(verified 227s narration)* |
| M03 | Loving Kindness | `WW_M03_LovingKindness_v1.mp4.mp4` | `WW_M03_LovingKindness_MusicBed_v1.mp4` | Calm Evening Bed — **or Forest-textured**, per `audio-content-specification.md`'s own explicit pick for its analogous `meditation-loving-kindness` session *(verified 204s narration)* |
| M04 | Gratitude Meditation | `WW_M04_GratitudeMeditation_v1.mp4.mp4` | `WW_M04_GratitudeMeditation_MusicBed_v1.mp4` | Calm Evening Bed *(verified 216s narration)* |
| M05 | Guided Reflection | `WW_M05_GuidedReflection_v1.mp4.mp4` | `WW_M05_GuidedReflection_MusicBed_v1.mp4` | Calm Evening Bed — **or Ocean-textured**, per `audio-content-specification.md`'s own explicit pick for its analogous `meditation-guided-reflection` session *(verified 212s narration)* |

### Stretching

| ID | Title | Existing filename | Proposed `-MUSIC` filename | Background type |
|---|---|---|---|---|
| S01 | Neck Release | `WW_S01_NeckRelease_v1.mp4.mp4` | `WW_S01_NeckRelease_MusicBed_v1.mp4` | Calm Ambient Pad |
| S02 | Shoulder Release | `WW_S02_ShoulderRelease_v1.mp4.mp4` | `WW_S02_ShoulderRelease_MusicBed_v1.mp4` | Calm Ambient Pad |
| S03 | Upper-Back Stretch | `WW_S03_UpperBackStretch_v1.mp4.mp4` | `WW_S03_UpperBackStretch_MusicBed_v1.mp4` | Calm Ambient Pad |
| S04 | Morning Flow | `WW_S04_MorningFlow_v1.mp4.mp4` | `WW_S04_MorningFlow_MusicBed_v1.mp4` | Light Uplifting Acoustic Bed |
| S05 | Evening Flow | `WW_S05_EveningFlow_v1.mp4.mp4` | `WW_S05_EveningFlow_MusicBed_v1.mp4` | Calm Ambient Pad |

### Sleep Soundscapes — **excluded, no `-MUSIC` variant of any kind**

| ID | Title | Existing filename | Music variant? |
|---|---|---|---|
| SL01 | Rain | `WW_SL01_Rain_v1.mp4` | **Never** — already the content itself |
| SL02 | Ocean Waves | `WW_SL02_OceanWaves_Preview_v1.mp4` | **Never** |
| SL03 | Forest Ambience | `WW_SL03_ForestAmbience_v1.mp4` | **Never** |
| SL04 | Fireplace | `WW_SL04_Fireplace_v1.mp4` | **Never** |
| SL05 | Gentle Wind | `WW_SL05_Wind_v1.mp4.mp4` | **Never** |
| SL06 | White Noise | `WW_SL06_WhiteNoise_v1.mp4.mp4` | **Never** |
| SL07 | Pink Noise | `WW_SL07_PinkNoise_v1.mp4.mp4` | **Never** |
| SL08 | Brown Noise | `WW_SL08_BrownNoise_v1.mp4.mp4` | **Never** |

### Evening Breathing stage — no asset exists to remix

`/evening-breathing` (`EveningBreathing.jsx`) has no video/narration file at all today (pure animated timer). Not included above; nothing to produce for this phase.

---

## 4. CapCut production workflow (per eligible item)

1. Open the **existing, unchanged** narration file in CapCut (the "Existing filename" column above) and note its exact runtime.
2. Add a new audio track underneath the existing narration track. Import the licensed music bed matching that item's recommended background type (§2/§3).
3. Trim/loop the music bed to exactly match the narration file's runtime from step 1 — no shorter, no longer.
4. Apply a 2–3 second fade-in starting at the video's opening line (never before it), and a 3–4 second fade-out beginning with the closing line, reaching silence by/just after the file's natural end. (`docs/background-music-specification.md` §3 — unchanged, repeated here only as a checklist item.)
5. Set the music bed's level so it sits **−18 dB to −24 dB relative to the narration's peak level** — narration must always read as clearly louder.
6. Export at the same resolution/frame rate as the source, encoded H.264/AAC `.mp4` (matching every other file in this manifest — no new container/codec).
7. Confirm integrated loudness ≈ **−16 LUFS**, true peak ≤ **−1 dBTP**, on the finished export.
8. Name the export exactly per the "Proposed `-MUSIC` filename" column above.
9. Retain the license/receipt for the music bed used — every track needs a perpetual, worldwide, commercial-use license (§3 of the spec doc — this has not changed and is not optional).
10. Upload to the private `wellness-videos` bucket, `exercises/` folder — same location as every existing file, nothing new to configure in Storage itself.

**Do not upload anything until it has gone through steps 4–7 above** — an unmixed or unfaded file at a `-MUSIC` path would be picked up as-is the moment a maintainer wires its id into the manifest.

---

## 5. Engineering completion vs. asset/content completion — the explicit line

**Shipped and fully tested this phase (engineering complete):**
- `src/lib/backgroundMusicSelection.js` — `isMusicEligibleEntry`, `resolvePlaybackId`, `shouldShowMusicToggle`: pure, unit-tested selection/fallback logic. Excludes Sleep Soundscapes unconditionally (id-prefix guard, not just a `category` check — safe even for `Beta.jsx`'s raw-manifest entries, which lack a `category` field entirely).
- `src/lib/featureFlags.js` — new `backgroundMusic` flag, defaulting **off**, independent of the user's own saved preference.
- `src/components/BetaVideoModal.jsx` — resolves `playbackId` once (before the signed-URL fetch, never mid-playback), shows an in-player "Music" toggle only pre-playback and only when the flag is on AND a real, registered `musicVariantId` exists for that entry. Falls back to the existing narration id whenever any single condition fails.
- `src/lib/musicPreference.js` (already shipped in the prior phase) — persisted, localStorage-backed, defaults off.

**Not shipped, and cannot be until real assets exist (content/asset completion, not engineering):**
- No `musicVariantId` is set on any of the 65 real manifest entries. The toggle is therefore **structurally unable to render for any real user today**, regardless of the feature flag — this is intentional, not an oversight.
- No `-MUSIC` file exists in Storage for any id.
- No Edge Function change — `supabase/functions/get-beta-video-url`'s `EXERCISE_PATHS` map is untouched. Nothing in this phase touches Supabase in any way.

**To actually turn a produced asset on, once it exists** (unchanged from the prior spec doc's own §4, restated for clarity):
1. Upload the finished `-MUSIC` file per §4 above.
2. Add a new entry to `BETA_VIDEO_MANIFEST` for it (e.g. `{ id: 'E02-MUSIC', storagePath: 'exercises/WW_E02_OverwhelmedMind_MusicBed_v1.mp4', title: ..., description: ... }`) and set `musicVariantId: 'E02-MUSIC'` on the existing `E02` entry.
3. Add that same new id to the Edge Function's `EXERCISE_PATHS` map (a genuine Supabase deploy — deliberately not done by this phase).
4. Optionally flip `backgroundMusic: true` in `featureFlags.js` (or leave it as a per-device QA override) once ready for real users to see the toggle.

No step above requires touching `resolvePlaybackId`, `BetaVideoModal.jsx`, or any other engineering already shipped this phase — the fallback-safe design means turning content on is purely additive.
