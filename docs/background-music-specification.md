# WakeWise — Background Music: Architecture Decision and Asset Specification

Planning and scaffold-only document. **No music asset (licensed or placeholder) is bundled, uploaded, or streamed by this phase.** The only code shipped alongside this doc is `src/lib/musicPreference.js` — a persisted on/off preference with no audio behaviour wired to it yet (see §4).

## 1. Architecture decision: pre-mixed, not dual-track

Reaffirms the recommendation from the earlier playback-architecture review, now made a firm decision:

**Music is pre-mixed into each exercise's master audio/video file at production time. WakeWise does not build a runtime dual-track (separate narration + separate music) player.**

Why this still holds, re-verified against the current codebase:

- The player is `BetaVideoModal.jsx` — one native `<video>` element per exercise, used by all 12 guided-exercise pages (Support, Meditate, Library, PrepareForRest, Reflection, Grounding, MorningStart, MorningFlow, IntentionSetup, Breathe, Affirmation, Beta). A second, independently-playing `<audio>` element would need its own play/pause/seek/error state machine kept in lockstep with the existing one — real engineering and real risk (iOS Safari/WKWebView audio-session and autoplay-gesture quirks are exactly where dual-media-element apps most often break) for a codebase that has zero existing infrastructure for it today.
- Every required behaviour in §5 of this doc (stop on completion/back-navigation/route-change/modal-close/unmount, pause/resume follows the exercise, never two tracks at once) is **already fully satisfied** by the existing single-`<video>`-element architecture, because there would only ever be one media element playing one track. A dual-track system would have to build all of that from scratch, for a codebase that doesn't need it.
- No licensed music asset exists yet, so there is nothing to validate a dual-track player against today regardless.

This decision can be revisited later if a real product need for independent runtime music/voice volume control emerges — see §4 for exactly what would have to change.

## 2. What "Music on/off" means under this architecture

Because music is baked into the same audio track as narration, there is no runtime volume/mute knob that can turn "music" off while leaving narration untouched — muting the one track mutes both.

**The only way a "Music off" option can genuinely work is two separate media variants per music-eligible exercise:**
- `<id>` (existing): narration/ambience only, no music bed — today's default, unchanged.
- `<id>-music` (new): the same narration/ambience, remixed with the music bed under it.

The "Music on/off" control, when built, is an **asset-selection switch**, not a live audio control: on = request the `-music` variant's `storagePath`; off = request the existing plain variant. `BetaVideoModal`/`requestBetaVideoUrl` already resolve one `entry.id` to one signed URL — supporting this needs only an extra manifest field (§4), not a new player.

If, when assets are actually produced, a per-category "always/never has a music variant" split turns out simpler than a global toggle (e.g. Sleep Soundscapes always get music, Breathing never does), that's a legitimate simplification of this same asset-selection approach — still not a reason to build a dual-track player.

## 3. Asset-production specification

For whoever produces/licenses the music beds. Applies per exercise that gets a `-music` variant (§2) — most naturally the narrated categories already carrying a `Background Sound` field in `docs/audio-content-specification.md` (Loving Kindness → Forest, Guided Reflection → Ocean, etc.), not the already-ambient Sleep/Focus soundscapes (their background sound **is** the content, not an addition to narration).

| Parameter | Specification |
|---|---|
| **Level under narration** | Music bed at **−18 dB to −24 dB relative to narration peak level**, or equivalently mixed so narration stays intelligible at typical mobile-speaker/earbud volume without the listener needing to raise device volume. Narration must always read as clearly louder — this is a hard requirement, not a suggestion. |
| **Fade-in** | 2–3 second linear or equal-power fade-in, starting at the exercise's opening line (not before) so the very first spoken word is never masked by music arriving at full level. |
| **Fade-out** | 3–4 second fade-out beginning with the closing line, reaching silence by (or just after) the video/audio file's natural end — never an abrupt cut. |
| **Looping** | Music bed must loop seamlessly for any exercise whose narration runs longer than one pass of the source loop (no audible seam/click at the loop point). Ambient/Sleep-style pure-loop content (already out of scope per §3 header) uses the player's native `loop` attribute instead — no new work there. |
| **Loudness target** | Integrated loudness **−16 LUFS** for the finished mixed file (Apple/Spotify-typical mobile target), true peak ≤ −1 dBTP, to avoid clipping and to sit consistently alongside the app's existing non-music narration files. |
| **Format/encoding** | Match the existing pipeline exactly: encode into the same H.264/AAC `.mp4` container every other `BETA_VIDEO_MANIFEST` entry uses — no new container/codec, no separate audio-only distribution format. |
| **Licensing** | Every music bed needs a **commercial-use license appropriate for a paid subscription wellness app**: a royalty-free library license with an explicit commercial/app clause, or a custom work-for-hire with full buyout, in both cases **perpetual and worldwide** (matching the app's own AU-and-beyond distribution). No track may be used under a personal/non-commercial, attribution-only (unless attribution is contractually acceptable and tracked), or ambiguous license. Retain the license document/receipt per track — this is normal App Store/legal due diligence, not unique to WakeWise. |

## 4. Framework shipped this phase

- `src/lib/musicPreference.js` — `getMusicPreference()` / `setMusicPreference(enabled)`, localStorage-persisted, **defaults to off**. Mirrors `reducedMotionPreference.js`'s exact shape (independent preference — reduced motion is never read as an audio signal, and vice versa, per the explicit requirement not to conflate the two).
- Nothing else. No UI toggle is wired into `BetaVideoModal.jsx` yet, and no manifest field for a music variant exists yet — building either now would be a non-functional control with nothing real behind it (there is no `-music` variant of anything to switch to), which is explicitly out of scope ("do not fake final validation without actual audio assets").

**To finish this feature once real, licensed assets exist:**
1. Produce `-music` variants per §3 for the chosen exercise set; upload alongside existing files in the private `wellness-videos` bucket.
2. Add one field to each eligible `BETA_VIDEO_MANIFEST` entry, e.g. `musicStoragePath` (optional — absent means "no music variant produced for this exercise").
3. In `BetaVideoModal.jsx`, when `entry.musicStoragePath` exists, show a small "Music" on/off row (reading `getMusicPreference()`); resolve `requestBetaVideoUrl` against `musicStoragePath` instead of `storagePath` when the preference is on, otherwise unchanged. No other player logic changes — pause/resume/stop-on-navigation/no-double-track are already correct by construction (§1).
4. Persist the toggle change via `setMusicPreference()` immediately on tap, same as `reducedMotionPreference`'s existing toggle in `Settings.jsx`.

## 5. Required playback behaviour — status under this architecture

| Requirement | Status |
|---|---|
| Music stops on exercise completion, back navigation, route change, modal close, unmount | **Already satisfied**, unchanged — one media element, already fully torn down by `BetaVideoModal`'s existing unmount cleanup effect. |
| Pause/resume follows the exercise | **Already satisfied** — pausing the one `<video>` pauses everything, since music isn't a separate element. |
| Narration clearly louder than music | **Asset-production requirement** (§3), not player code — enforced at mix time, not runtime. |
| Never two tracks start simultaneously | **Structurally guaranteed** — still one media element, one active `BetaVideoModal` instance at a time (existing invariant, unchanged). |
| Reduced-motion preference respected where relevant, never conflated with audio preference | `musicPreference.js` is fully independent of `reducedMotionPreference.js` — neither reads the other. |
