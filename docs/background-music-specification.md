# WakeWise — Background Music: Architecture Decision and Asset Specification

Planning document, now joined by real (asset-gated, feature-flagged) engineering — see §4. **No music asset (licensed or placeholder) is bundled, uploaded, or streamed by any phase of this work.** For the complete per-item media inventory, eligibility list, and the exact asset-production manifest for CapCut, see `docs/background-music-asset-manifest.md` (Phase B) — this document stays the architecture/mixing/licensing reference; that one is the concrete "what to produce, and where it goes" companion.

## 1. Architecture decision: pre-mixed, not dual-track

Reaffirms the recommendation from the earlier playback-architecture review, now made a firm decision:

**Music is pre-mixed into each exercise's master audio/video file at production time. WakeWise does not build a runtime dual-track (separate narration + separate music) player.**

Why this still holds, re-verified against the current codebase:

- The player is `BetaVideoModal.jsx` — one native `<video>` element per exercise, used by all 12 guided-exercise pages (Support, Meditate, Library, PrepareForRest, Reflection, Grounding, MorningStart, MorningFlow, IntentionSetup, Breathe, Affirmation, Beta). A second, independently-playing `<audio>` element would need its own play/pause/seek/error state machine kept in lockstep with the existing one — real engineering and real risk (iOS Safari/WKWebView audio-session and autoplay-gesture quirks are exactly where dual-media-element apps most often break) for a codebase that has zero existing infrastructure for it today.
- Every required behaviour in §5 of this doc (stop on completion/back-navigation/route-change/modal-close/unmount, pause/resume follows the exercise, never two tracks at once) is **already fully satisfied** by the existing single-`<video>`-element architecture, because there would only ever be one media element playing one track. A dual-track system would have to build all of that from scratch, for a codebase that doesn't need it.
- No licensed music asset exists yet, so there is nothing to validate a dual-track player against today regardless.

This decision can be revisited later if a real product need for independent runtime music/voice volume control emerges — see §4 for exactly what would have to change.

**Scope note (Phase C):** this decision governs *narrated* exercises played through `BetaVideoModal.jsx`. A small number of screens have no narration at all — the interactive breathing cycle on `/evening-breathing` and `/quiet-breathing` — so there is nothing to pre-mix a music bed *into*, and no dual-track-in-lockstep risk to avoid, because there is no first track to stay in lockstep with. Those two screens use one dedicated `<audio>` element of their own (`InteractiveBreathingMusic.jsx`), playing a standalone ambient loop, never narration. See §4 Phase C below for what that ships.

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

## 4. Framework shipped — now includes real (asset-gated) selection logic, not just a scaffold

**Phase 1 (prior):**
- `src/lib/musicPreference.js` — `getMusicPreference()` / `setMusicPreference(enabled)`, localStorage-persisted, **defaults to off**. Mirrors `reducedMotionPreference.js`'s exact shape (independent preference — reduced motion is never read as an audio signal, and vice versa, per the explicit requirement not to conflate the two).

**Phase B (this phase) — see `docs/background-music-asset-manifest.md` §5 for the full engineering-vs-asset completion breakdown:**
- `src/lib/backgroundMusicSelection.js` — `resolvePlaybackId()` (the actual asset-selection switch this doc described in §2, now real code), `isMusicEligibleEntry()` (hard Sleep-Soundscape exclusion, id-prefix based so it holds even for callers that don't pass a `category` field), `shouldShowMusicToggle()`.
- `src/lib/featureFlags.js` — a `backgroundMusic` flag, defaulting off, gating the in-player toggle independently of the user's own saved preference.
- `src/components/BetaVideoModal.jsx` — resolves which id to request (`playbackId`) once, before the signed-URL fetch, never mid-playback; shows the "Music" toggle only pre-playback, only when the flag is on and a real `musicVariantId` is registered for that entry.
- Still true: **no manifest entry has a `musicVariantId` yet** (renamed from this doc's original `musicStoragePath` suggestion — see the asset-manifest doc for why an id-based field fits this codebase's existing id-based Edge Function contract better than a raw path). The toggle is therefore structurally inert for every real user today, regardless of the feature flag — building the selection/fallback engineering now, ahead of real assets, is what let it be fully unit-tested without "faking final validation without actual audio assets": every test asserts behaviour *given* a hypothetical variant, never claims one exists.

**Phase C (this phase) — non-narrated interactive breathing screens:**
- `src/lib/backgroundMusicSelection.js` — `isInteractiveMusicEligible()`, a second, simpler eligibility function for screens with no narration to fall back to (feature flag + a `musicVariantId` that actually resolves to a registered catalogue entry, nothing more).
- `src/components/InteractiveBreathingMusic.jsx` (new, shared) — the single dedicated `<audio>` element for these screens: defaults off, uses the same persisted `musicPreference.js` key, starts only from a real toggle tap (never seeded from the stored preference on mount, since these screens have no separate "Begin" gesture the way `BetaVideoModal.jsx` does — see the component's own doc comment for the full autoplay-policy reasoning), low default volume (0.35), native seamless looping, and full teardown (pause + release the element) on Skip, Continue, Back, route change, routine-stage change, sign-out, and unmount. A duplicate-tap/remount guard (`isBusyRef`) prevents two overlapping play attempts. A load/playback failure shows one small, unobtrusive line and otherwise never blocks the breathing cycle.
- Wired identically into both `EveningBreathing.jsx` and `QuietBreathing.jsx` — confirmed this phase to be structurally identical non-narrated uses of `BreathingRing`, so one shared component and one reserved id (`IB01`) serve both rather than two independent, drifting copies. `Breathe.jsx` (Morning's own breathing step) was confirmed to already use narrated video content and deliberately does **not** get this independent player, per the "never place an independent audio player beneath content that already contains narration" rule. `MorningFlow.jsx` was confirmed to have no breathing cycle of any kind.
- Still true: `IB01` is not yet a registered catalogue entry, so `isInteractiveMusicEligible` is unconditionally false and the component renders nothing for any real user today — see the asset-manifest doc's new §6 first-production-batch table for what has to be produced to change that.

**To finish this feature once real, licensed assets exist** (see the asset-manifest doc's §5 for the authoritative engineering-vs-asset line, and its §6 for exactly which items to produce first). This is a checklist of controlled engineering and deployment actions, not a "flip a switch" step — every item below is a genuine, reviewable change, not a no-op:
1. Produce `-MUSIC` variants (or, for `IB01`, the new standalone loop) per §3 above and the asset-manifest doc's per-item table; upload each finished file to the private `wellness-videos` bucket — a real Storage write, done deliberately and reviewed per file, not automatic.
2. Register the music variant id in the catalogue/manifest: add a new `BETA_VIDEO_MANIFEST` entry for each produced variant (its own id, e.g. `E02-MUSIC` or `IB01`, its own `storagePath`) and, for narrated items, set `musicVariantId` on the corresponding existing entry — a genuine code change and PR, not configuration.
3. Update the signed-URL Edge Function's accepted mapping (`EXERCISE_PATHS` in `supabase/functions/get-beta-video-url`) to include each new id, if it is not already covered. Confirmed this phase to be a plain `Map<string,string>` lookup with no format validation on the key, so a new id fits without changing the function's own logic — but the map itself still needs the new entry added.
4. Deploy that Edge Function to DEV (a genuine Supabase deployment action against the DEV project — deliberately not done by this phase or by "just enabling a flag").
5. Enable the feature flag (`backgroundMusic: true` in `featureFlags.js`, or a per-device override for staged QA) once ready for real users to see the toggle.
6. Verify in both a browser session and on a physical iPhone — WKWebView autoplay/gesture behaviour cannot be fully trusted from desktop-browser testing alone — that the toggle appears, plays, loops, and cleans up correctly before treating the feature as live.

None of the above is "no engineering code change is needed." Every one of these is a controlled engineering or deployment action that needs its own review, the same as any other production change — the fallback-safe design only means a *missing or not-yet-registered* asset degrades safely (no toggle shown, no error), not that turning one on is automatic.

## 5. Required playback behaviour — status under this architecture

| Requirement | Status |
|---|---|
| Music stops on exercise completion, back navigation, route change, modal close, unmount | **Already satisfied**, unchanged — one media element, already fully torn down by `BetaVideoModal`'s existing unmount cleanup effect. |
| Pause/resume follows the exercise | **Already satisfied** — pausing the one `<video>` pauses everything, since music isn't a separate element. |
| Narration clearly louder than music | **Asset-production requirement** (§3), not player code — enforced at mix time, not runtime. |
| Never two tracks start simultaneously | **Structurally guaranteed** — still one media element, one active `BetaVideoModal` instance at a time (existing invariant, unchanged). |
| Reduced-motion preference respected where relevant, never conflated with audio preference | `musicPreference.js` is fully independent of `reducedMotionPreference.js` — neither reads the other. |
| Interactive breathing screens (no narration to protect) | Out of scope for this table — see the Phase C scope note in §1 and the Phase C bullets in §4; `InteractiveBreathingMusic.jsx` implements its own equivalent guarantees (single element, defaults off, full teardown on every exit path, duplicate-tap guard, silent fallback) for its one dedicated `<audio>` element. |
