# Evening Wind-Down — navigation and colour-contrast fix

Root-cause analysis and exact calculations behind the Build 10 remediation.

## Root cause

The evening flow's atmosphere (`AtmosphereManager` → `Gradient.jsx`) cross-fades between four named sky phases. Two are used by the wind-down session:

- **Dusk** (`EveningWindDown`, `Reflection`): `mist-dim (#9CA0B8) → dawn (#F2A785) → ember (#E08A4F) → dusk (#1B1E38)`.
- **Moonlight** (`Gratitude`, `EveningBreathing`, `PrepareForRest`, `EveningComplete`): `ink (#0D0E1A) → dusk (#1B1E38) → moonlight-dim (#7C87B8)`.

Both gradients pass through a genuinely **light** band — Dusk's peach/ember middle, Moonlight's light blue-lavender bottom. The app's text tokens (`--color-on-surface: #dae2fd`, `--color-on-surface-variant: #dac1bb`) are light colours designed for the app's normal near-black background. Over the gradient's light bands, light-on-light is the failure mode the report described ("insufficient contrast," "too faint").

`Gradient.jsx`'s own "legibility scrim" (`rgba(0,0,0,0.05)` to `rgba(0,0,0,0.22)`) was nowhere near dark enough to compensate.

## Contrast calculations (manual sRGB → WCAG relative luminance)

Verified against the two lightest points in the gradient — Dusk's peach `#F2A785` and Moonlight's lightest stop `#7C87B8` — since a fix that only holds at the darkest point isn't a fix.

| Scrim | Worst-case background luminance | on-surface (#dae2fd) contrast | on-surface-variant (#dac1bb) contrast |
|---|---|---|---|
| Original (0.05–0.22) | ~0.40–0.47 (barely darkened) | ~1.6–1.9:1 (fails) | ~1.4–1.7:1 (fails) |
| New (0.55–0.65) | ~0.040–0.084 | ~5.2–10.5:1 | ~4.7–7.0:1 |

Both text tokens clear the 4.5:1 normal-text floor at every tested point once the scrim is strengthened, with margin.

**Low-opacity text is a separate failure the scrim alone cannot fix.** A text colour rendered at partial opacity displays as a *blend* toward the background (`displayed = colour·α + background·(1−α)`), so making the background darker does not rescue very low α — e.g. `on-surface-variant` at 40% opacity over the *new, darkened* peach background still only measures **~2.0:1**. Every low-opacity text instance found in the evening flow (`ProgressIndicator`'s `/40 /30 /20`, `PromptStepper`'s `/60 /40` counter and placeholder) was bumped to full opacity rather than left to the scrim.

## What changed

| File | Change |
|---|---|
| `src/components/stage3/Gradient.jsx` | Legibility scrim strengthened to `rgba(0,0,0,0.55)–rgba(0,0,0,0.65)`. Affects every phase (also `Stage3Preview.jsx`, a QA gallery — strictly an improvement there too). |
| `src/components/BackButton.jsx` | New optional `confirmTitle`/`confirmMessage` props (defaults unchanged — every existing caller is unaffected). |
| `src/components/evening/EveningSceneShell.jsx` | The evening back button gets `!bg-black/55 !border-white/40` (glass-panel's default 5%-white panel was the "too faint" opening-screen arrow), plus the exact confirmation copy: "Leave evening routine?" / "Your unsaved progress may be lost." |
| `src/components/ProgressIndicator.jsx` | Evening-only (`sessionId === 'evening-wind-down'`) branch: inactive/separator/completed steps move off fragile low-opacity onto full-opacity tokens. Morning's indicator is untouched — it never had this problem (always renders on the app's plain dark background). |
| `src/components/evening/PromptStepper.jsx` | Step counter and textarea placeholder to full opacity; Previous/Skip button borders to `!border-white/40` (only user of this component is Reflection/Gratitude, both evening — no session check needed). |
| `src/pages/EveningBreathing.jsx` | Skip button border, same treatment. |

## Navigation — findings

Every pre-completion screen (`EveningWindDown`, `Reflection`, `Gratitude`, `EveningBreathing`, `PrepareForRest`, `EveningComplete`) already passed `showBack` with a correctly chained `backFallback` (each pointing at the step before it) — this was a **visibility** problem, not a missing-button problem. `BackButton`'s existing `goBack()` (via `NavigationHistoryContext`) already returns to the real previous step when one exists in this app instance's history, matching "back returns to the previous step" without new code. Its existing active-routine guard already shows a confirmation before leaving an in-progress step — matching "provide a close/exit path" without a second, separate icon; a redundant second control was judged unnecessary rather than "required" (the task's own qualifier).

`Library` was confirmed to need no back button — it's a bottom-nav tab, unaffected by any of this.

## What still needs real-device verification

- Exact on-screen rendering (my contrast numbers are manual WCAG calculations, not a rendered/measured screenshot from a real display).
- iOS edge-swipe-back gesture — unrelated to this fix (same router-wide native-config gap already flagged in the prior DEV phase); nothing evening-specific to add here.
