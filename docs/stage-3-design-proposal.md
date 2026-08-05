# Solas — Stage 3 Experience Design Foundation

*Architecture and experience-design proposal. Not an implementation spec — the foundation for Stitch design work.*

## Thesis

MindBloom's lesson was expensive but simple: people did not stop using it because it lacked features. They stopped because it asked them to *read* when what they needed was to *feel*.

Stage 3 rebuilds Solas as an experience first and a product second — closer to the fifteen seconds before sleep than to a dashboard. Directed as if Headspace, Calm, and Apple Health shared one design team.

---

## 1. Emotional Design Principles

Six commitments. Every later decision in this document is a specific application of one of these.

1. **Silence is a feature.** Every empty pixel is deliberate. If a screen doesn't need to say something, it says nothing at all.
2. **One question per screen.** A screen that asks two things is asking too much of someone who is trying to unwind. Split it.
3. **Time of day is the palette.** Colour isn't decoration — it's the app telling you, wordlessly, exactly where you are in your day.
4. **Motion is breath, not decoration.** Everything moves the way a person breathes: slow in, slower out. Nothing bounces. Nothing rushes.
5. **Invite, never instruct.** Copy speaks like a companion, not a manager. "Take a breath" beats "Complete Task" every time.
6. **Progress is felt, not counted.** No streaks, no percentage bars for the soul. Growth shows up as a softer transition, never a bigger number.

---

## 2. User Journeys

Not funnels. Solas only needs to know a person in three states.

**The first seven days** (new arrival)
Discover → Onboard (~70s) → First morning ritual → First evening ritual → Day 3 quiet pulse (optional) → Day 7 bloom (unscored celebration)

**An ordinary day** (returning, no drama)
Wake (sunrise ritual) → Silence (app fully recedes, no pings) → Dusk prompt (once, gentle) → Evening ritual → Sleep (screen dims itself)

**Coming back after a gap** (re-engagement, no guilt)
Reopen → One warm line ("Good to see you," never "you missed 12 days") → Same Home, nothing reset, nothing punitive

---

## 3. Onboarding

Five screens, **~55–70 seconds total**. No questionnaire, no permissions wall up front, no feature walkthrough. Two facts (when you rise, when you rest) and one word (what you're holding today) — each answer feeds the next screen so nothing is asked twice.

| Scene | Purpose | Emotion | Layout | Interaction | Transition | Duration |
|---|---|---|---|---|---|---|
| 1 · Welcome | Set the tone before asking anything | Curiosity, calm | Full-bleed dusk gradient, centred wordmark, one line | Tap anywhere | Gradient drifts on, unbroken | 8–12s |
| 2 · Wake time | Learn one fact — when they rise | Agency | Oversized time value, sun-path arc behind it, no keyboard | Drag the arc, or tap ends to nudge 5 min | Arc becomes the literal sunrise in Morning flow | 10–15s |
| 3 · Bedtime | Learn the other fact — when they rest | Ease | Mirror of Scene 2, moon-path arc, indigo tones | Same drag gesture | Arc dissolves into the intention card | 10–15s |
| 4 · Intention | One word to anchor the day | Clarity | Four large mood cards — Calm / Focus / Rest / write your own | Single tap selects, card blooms | Card shrinks into the persistent chip | 10–15s |
| 5 · Ready | Close the loop, hand back control | Trust | One assembled sentence ("Waking gently at 7:30, holding Calm."), one button | Single tap | Fades directly to Home, no tour | 8–10s |

---

## 4. Daily Flow

Home is a moment, not a dashboard. There is no grid of cards.

| Screen | Purpose | Emotion | Layout | Interaction | Transition | Duration |
|---|---|---|---|---|---|---|
| Today (Home) | Answer "what's my one thing right now" | Orientation | Full-screen time-of-day gradient *is* the dashboard; one greeting line, one thumb-sized primary card, intention chip small and quiet | Tap the one card to enter its ritual — everything else is inert | Card lifts and expands to fill the screen, becoming the next flow | 5–10s glance |

---

## 5. Evening Flow

Four scenes that lower the temperature of the day — literally, the sky keeps darkening in real time across the ritual.

| Scene | Purpose | Emotion | Layout | Interaction | Transition | Duration |
|---|---|---|---|---|---|---|
| 1 · Invitation | Signal the day is closing | Relief | Sky visibly darkens across the visit, one line, one button | Tap "Begin" | Gradient continues, unbroken | 5–8s |
| 2 · Gratitude | One reflective sentence, not a journal app | Warmth | Single generous text field, serif placeholder, "Skip" always visible | Type or skip — never required | Text folds away, screen dims further | 20–45s |
| 3 · Breath | Physiologically downshift before sleep | Surrender | One expanding/contracting circle, no counters | Passive — follow the circle, quiet early-exit tap | Circle contracts to a point of light, becomes the moon | 60–90s |
| 4 · Goodnight | Close the ritual definitively | Peace | Near-black, one soft moon, one word | None required | Fades to black, app recedes | 5s |

---

## 6. Morning Flow

The opposite of a buzzer. Light arrives before sound; every scene can be skipped by someone in a genuine hurry.

| Scene | Purpose | Emotion | Layout | Interaction | Transition | Duration |
|---|---|---|---|---|---|---|
| 1 · Wake | Replace the jarring alarm feeling | Gentle arousal | Full-bleed sunrise gradient animating in real time, large time readout | Tap to acknowledge, or swipe for 5 more minutes | Gradient keeps brightening | 5–10s |
| 2 · Stretch *(optional)* | Physical transition into the day | Aliveness | Same breathing-circle language, warm-toned; skip always visible | Passive follow, or skip | Circle becomes the sun disc | 60–120s |
| 3 · Intention | Reconnect with the day's anchor | Purpose | The onboarding word, large, serif, centred, editable | Tap to keep, tap to change | Word settles into the persistent chip | 10–15s |
| 4 · Begin | Release into the day | Readiness | One line, one button | Single tap | Fades to Home | 5s |

---

## 7. Check-in Flow

A pulse, not a survey. Weekly at most, folded into an evening ritual already happening — never a standalone form, never a red badge.

| Scene | Purpose | Emotion | Layout | Interaction | Transition | Duration |
|---|---|---|---|---|---|---|
| 1 · Mood | A single felt pulse | Honesty | One horizontal gradient scale, cool to warm — no numbers, no emoji, no star rating | One drag or tap, auto-submits (no "Submit" button) | Scale dissolves into a one-line acknowledgment | 10–15s |
| 2 · Acknowledged | Close the loop with warmth, not data | Being heard | A single sentence written for the temperature just given — never a chart or number shown back | Tap to dismiss | Fades back into the evening ritual | 5–8s |

---

## 8. Recommendation Flow

Earned, not pushed. No "Discover" tab, no notification badge, no algorithmic feed.

| Screen | Purpose | Emotion | Layout | Interaction | Transition | Duration |
|---|---|---|---|---|---|---|
| Woven-in suggestion | One relevant nudge, earned by real context (e.g. three quiet evenings without a breath exercise) | Being understood | Appears inline inside an existing flow, never a popup or interstitial | Tap to accept (flows straight into it), or tap away (dismisses for that context, no repeat nagging) | Accept extends the current ritual; decline continues it unchanged | 5–8s to read/decide |

---

## 9. Celebration Flow

Rare, felt, unscored. Reserved for real thresholds — a first ritual, a first week, a return after absence — never a daily ping.

| Screen | Purpose | Emotion | Layout | Interaction | Transition | Duration |
|---|---|---|---|---|---|---|
| Threshold bloom | Mark a real milestone with feeling, not a statistic | Warm pride | Full-bleed warm bloom of light (ember-toned), one affirming sentence in the display serif — no streak count, no share sheet, no confetti | Tap to continue, whenever ready | Bloom softens and fades into Home | 8–12s |

---

## 10. Animation Principles

- **Base rhythm** — 4s inhale / 6s exhale drives every expand-or-contract motion in the product, not just literal breathing screens (a card lifting into a ritual, light gathering for celebration).
- **UI transitions** — 240–450ms, `cubic-bezier(0.4, 0, 0.2, 1)`. Never spring or bounce outside celebration.
- **Sky continuity** — gradients animate across screen boundaries so time-of-day reads as one unbroken sky, never a slideshow cut.
- **Celebration only** — one soft spring release (the bloom), used nowhere else, so it stays rare and means something.
- **Reduced motion** — breathing keeps its pacing through an opacity pulse instead of scale; gradient sweeps cross-fade instead of drifting.

---

## 11. Typography

Two voices that never share a screen as equals — one is always the whisper, one is the instruction.

- **Felt** — a warm literary serif, italic, reserved for moments that should be felt: onboarding, the intention word, celebration copy.
- **Structural / body** — a clean humanist-geometric sans for everything operational: headings, primary actions, body copy.
- **Utility** — system monospace for durations, timestamps, scene markers, set in tabular figures.
- Large sizes, generous line-height (~1.6 body, ~1.15–1.2 display), short lines (~60 characters max) — reading effort is exactly what Stage 3 removes. No paragraph on a ritual screen should take longer to read than the breath it accompanies.

---

## 12. Colour Palette

Colour is the clock. Dark is the primary experience, not a toggle — Solas is worn at dusk more than glanced at midday.

**Night — primary**

| Token | Hex | Use |
|---|---|---|
| Ink | `#0D0E1A` | Base |
| Dusk | `#1B1E38` | Surface |
| Moonlight | `#B8C4F0` | Night accent |
| Dawn | `#F2A785` | Morning accent |
| Ember | `#E08A4F` | Celebration, used sparingly |
| Mist | `#EDEAE3` | Primary text on dark |

**Day — accessible companion** (paper, never stark productivity-app white)

| Token | Hex | Use |
|---|---|---|
| Paper | `#F7F5F0` | Base |
| Cloud | `#FFFFFF` | Surface |
| Moonlight, deepened | `#4C5A9E` | Accent, AA on paper |
| Dawn, deepened | `#C05F30` | Accent, AA on paper |
| Ink | `#1B1E38` | Primary text on light |

No red anywhere in the system. Errors and gentle alerts speak in Ember — nothing in a calm app should look like it's on fire.

---

## 13. Spacing System

An 8-point grid (4 / 8 / 16 / 24 / 32 / 48 / 64 / 96), spent generously.

- **Touch targets** — 56px minimum, 64px+ for the one primary action on any screen.
- **Column** — single column throughout, ~420px max content width. One-hand phone reach, never a tablet-style multi-column dashboard.
- **Screen margin** — 24–32px minimum at every edge, before any component's own padding — nearly double a typical productivity app, because negative space is doing emotional work.

---

## 14. Accessibility

A mood-lit interface is only trustworthy if it's still legible, still operable, still readable at any text size.

- **Contrast** — WCAG AA minimum held everywhere, including inside the dark palette; Moonlight and Dawn accents checked against Ink and Dusk directly.
- **Reduced motion** — a full alternate motion language (opacity, haptics) rather than just "animations off."
- **Non-visual pacing** — every timed ritual carries a haptic or audio cue, so pacing never depends on sight alone.
- **Dynamic type** — text reflows at any system size without breaking the one-screen-one-message layout.
- **Screen readers** — decorative gradients and motion marked as such; the one line of copy per screen is always the accessible label.

---

## 15. Mobile Interaction Patterns

Built for one thumb, half-asleep, in low light — not a person at a desk.

- **Thumb zone** — primary actions anchor in the bottom third; never top-right, never a hamburger to reach across for.
- **Gestures over forms** — drag an arc for time, swipe to snooze, tap to accept. Typing reserved for the one optional gratitude line.
- **One navigation depth** — no modals stacked on modals. A flow either *is* the screen, or it isn't there.
- **Haptics** — a light tap per breath cycle, a soft double-tap on ritual completion, one warm pulse for celebration.
- **Interruption-safe** — a call or notification mid-ritual doesn't restart it; resuming returns to the same emotional moment, not a blank form.

---

*Everything Stitch designs from here should be checked against one question: does this still feel like the fifteen seconds before sleep?*
