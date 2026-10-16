# Phase 2C — Free vs. WakeWise Plus Access Specification

**Status: SPECIFICATION APPROVED AND COMPLETE.** Every catalogue entry is
now classified (§3) — no unclassified entries remain. Implementation and
sandbox purchase validation are **outstanding** — neither has started.
Phase 2C gating is **not active** anywhere in this codebase as of this
document. See the Implementation Checklist at the end before any of this
becomes code.

Baseline this specification was written against: branch
`phase2b-revenuecat-entitlements`, commit `ecef8bf456b28ae485d104a5e115ed3e450f4d8b`.

Every content decision below is grounded in the actual, currently-shipped
catalogue (`src/lib/mediaCatalog.js`, `src/lib/betaVideoManifest.js`,
`src/lib/breathingPatterns.js`) and the actual, currently-shipped
recommendation engines (`src/lib/meditationRecommendations.js`,
`src/lib/anytimeResetRecommendations.js`) — not invented content or
hypothetical future features.

---

## 1. What stays Free regardless of subscription — unchanged, not a Phase 2C decision

Sign-in requirements are untouched by this specification (`OnboardingGate.jsx`
still governs guest vs. signed-in access exactly as today). Within a signed-in
account, these are **not** part of the Plus/Free split at all:

- Full Morning journey (Stretch → Breathe → optional Meditate → Affirmation)
- Full Evening journey (Wind-Down → Reflection → Gratitude → Breathing →
  optional Meditate → Prepare for Rest)
- Anytime Reset (the full 3-step wizard, every path)
- Personalisation (intentions, custom intention text, rhythm/wake-time/bedtime)
- Reminders (in-app notification settings, native morning reminder)
- Progress/Momentum (`MomentumPanel` on completion screens)
- Interactive Ambient Music (`IB01`/`IS01`/`IM01`/`IM02`) and the Introduction
  video `I01` — already guest-allowed by existing, separate design
  (`GUEST_ALLOWED_IDS`, `supabase/functions/_shared/betaVideoUrlAccess.ts`)

These are the core daily-use loop. Restricting any of them would remove the
product's reason to use the app before ever subscribing, and none of them
were part of what this specification was asked to gate.

---

## 2. Breathing patterns (`src/lib/breathingPatterns.js`) — 5 total

| id | Label | Classification |
|---|---|---|
| `morning` | 4-4-6 Breathing | **Free** — Morning journey's own default |
| `evening` | 4-7-8 Breathing | **Free** — Evening journey's own default |
| `quiet` | 4-4-8 Breathing | **Free** — already unrestricted (`QuietBreathing.jsx`) |
| `box` | Box Breathing | **Free** — amended this round |
| `coherent` | Coherent Breathing | Plus |

All 5 classified. None omitted.

---

## 3. Full catalogue classification (73 real video entries)

### 3a. Out of scope — interactive/intro utility content, not part of this policy (6 entries)

Excluded from `MEDIA_CATALOG` entirely (`INTERACTIVE_ONLY_IDS` in
`mediaCatalog.js`) — never Library-browsable, never reached through any
recommendation engine, never carries a `premium` flag, and out of scope for
this specification:

| id | Title | Existing access | Reason it stays out of scope |
|---|---|---|---|
| IB01 | Interactive Breathing Loop | Guest-allowed | Ambient loop underlying the interactive breathing timer, not standalone narrated content — never carries a `premium` flag, never in `MEDIA_CATALOG` |
| IS01 | Interactive Stretching Loop | Guest-allowed | Same role as IB01, for the stretching timer |
| IM01 | Interactive Meditation Music Bed | Guest-allowed | Same role as IB01, for self-guided meditation |
| IM02 | Interactive Meditation Soft Piano | Guest-allowed | Same role as IB01, for self-guided meditation |
| I01 | Why WakeWise | Guest-allowed | Intro content needed to understand the app before signing up — must stay reachable pre-signup, so it is deliberately excluded from any Plus/Free decision, not merely defaulted to Free |
| I02 | How to Use WakeWise | Sign-in required, not guest-allowed | Also intro/how-to content — existing rule requires sign-in (no first-use welcome role, per `betaVideoUrlAccess.ts`'s own comment) but is **not** and has never been Plus-gated; this specification does not change that |

**Confirmed**: nothing in this specification alters any of the six rows
above. Intro/how-to content (I01, I02) remains reachable under its existing
sign-in rule exactly as today — I01 pre-signup, I02 once signed in, neither
ever behind a Plus check. The four interactive ambient loops (IB01, IS01,
IM01, IM02) remain guest-allowed exactly as today. All six are excluded
from `MEDIA_CATALOG` by the app's own existing `INTERACTIVE_ONLY_IDS` set,
independent of anything decided in §3b/§3c/§3d below.

### 3b. Classified — Free (19 entries)

The original 17 are required by a journey default, a recommendation
engine's need-coverage (verified so no need in `Meditate.jsx` or
`AnytimeReset.jsx` can return a Plus-only result with no free alternative
— see §5), or a named shortcut. G01 and A02 were added in the §3d
classification round below, as starter representatives for two categories
that otherwise had zero Free presence anywhere in this specification —
not required by any route, an intentional "no category left at zero"
extension of the same principle:

| id | Title | Why free |
|---|---|---|
| S04 | Morning Flow | Morning journey default stretch |
| S05 | Evening Flow | Evening journey default stretch |
| S01 | Neck Release | Anytime `body-reset` need — sole free coverage, without it that need has zero free results |
| E03 | Instant Calm | Anytime's own named shortcut; covers meditation `calm` and Anytime `calm`/`not-sure` |
| E04 | Release Tension | Sole match for meditation need `stress-relief` — no alternative exists |
| E11 | Positive Energy | Anytime `energy` need — sole free coverage |
| E23 | Gratitude | Anytime `better-mood` need — sole free coverage |
| E30 | Peaceful Sleep | Evening Prepare-for-Rest wind-down default |
| B02 | Box Breathing (video) | Sole match for meditation need `focus` — no alternative exists |
| M01 | Mindfulness Meditation | Meditation need `mindfulness` |
| M02 | Body Scan | Sole non-redundant coverage for meditation need `deep-relaxation` |
| M03 | Loving Kindness | Sole match for meditation need `self-compassion` — no alternative exists |
| M04 | Gratitude Meditation | Sole match for meditation need `gratitude` — no alternative exists |
| F01 | Deep Work | Anytime `focus` need — sole free coverage |
| SL01 | Rain | Sleep starter set |
| SL04 | Fireplace | Sleep starter set |
| SL06 | White Noise | Sleep starter set |
| G01 | Five Senses | Grounding category had zero Free representation otherwise; a simple, well-known starter technique |
| A02 | Calmness Affirmations | Affirmation-video category had zero Free representation otherwise; thematically pairs with the already-free `calm` need |

### 3c. Classified — Plus (48 entries)

The original 25 are Plus as pure catalogue breadth/variety within a
category that already has approved Free coverage. The 23 added in the §3d
classification round below follow the same principle: each is additional
breadth in a category where at least one Free starter (either from the
original 25, or from §3b's G01/A02 additions) already exists.

| id | Title | Category |
|---|---|---|
| E05 | Night-time Calm | Evening Wind-Down variety |
| E08 | Deep Breathing | Meditation variety |
| E10 | Evening Reflection | Evening Wind-Down variety |
| E13 | Morning Focus | Anytime `focus` variety |
| E14 | Motivation Boost | Anytime `energy` variety |
| E17 | Stress Reset | Anytime `stress-relief` variety |
| E20 | Quieting the Mind | Evening Wind-Down variety |
| E27 | Deep Relaxation | Meditation + Evening Wind-Down + Anytime `calm` variety (one entry, three contexts, Plus in all) |
| A01 | Confidence Affirmations | Anytime `better-mood` variety |
| A04 | Motivation Affirmations | Anytime `energy` variety |
| A05 | Gratitude Affirmations | Anytime `better-mood` variety |
| B04 | Coherent Breathing (video) | Anytime `calm` variety |
| F03 | Concentration | Anytime `focus` variety |
| G02 | Muscle Relaxation | Anytime `stress-relief` variety |
| G04 | Sensory Reset | Anytime `stress-relief`/`not-sure` variety |
| M05 | Guided Reflection | Meditation variety |
| S02 | Shoulder Release | Stretching variety |
| S03 | Upper-Back Stretch | Stretching variety |
| SL02 | Ocean Waves | Sleep variety |
| SL03 | Forest Ambience | Sleep variety |
| SL05 | Gentle Wind | Sleep variety |
| SL07 | Pink Noise | Sleep variety |
| SL08 | Brown Noise | Sleep variety |
| SL09 | Soothing Birds | Sleep variety |
| SL10 | Rustling Leaves | Sleep variety |
| E02 | Overwhelmed Mind | General emotional-support variety — Evening/Anytime already have 5 approved-Free E-series entries (E03, E04, E11, E23, E30) |
| E06 | Gentle Awakening | Same as E02 |
| E07 | Morning Gratitude | Same as E02 |
| E09 | Mindful Pause | Same as E02 |
| E12 | Confidence Builder | Same as E02 |
| E15 | A Fresh Start | Same as E02 |
| E16 | Anxiety Relief | Same as E02 |
| E18 | Finding Balance | Same as E02 |
| E19 | Letting Go | Same as E02 |
| E21 | Self Compassion | Same as E02 |
| E22 | Inner Strength | Same as E02 |
| E24 | Confidence | Same as E02 |
| E25 | Hope and Healing | Same as E02 |
| E26 | Self Acceptance | Same as E02 |
| E28 | Mindful Breathing | Same as E02 |
| E29 | Patience | Same as E02 |
| A03 | Focus Affirmations | A02 already covers the Affirmation-video starter role |
| A06 | Self-Worth Affirmations | Same as A03 |
| B01 | Deep Breathing Practice | B02 (already Free) already covers the breathing-video starter role |
| B03 | 4-7-8 Breathing (video) | Same as B01 — distinct from the already-Free `evening` breathing *pattern* (different feature, no naming conflict) |
| B05 | Alternate Nostril Breathing | Same as B01 |
| F02 | Study | F01 (already Free) already covers the focus-video starter role |
| G03 | Body Awareness | G01 already covers the grounding starter role |

### 3d. Classification complete — no unclassified entries remain

All 25 entries previously listed here have been classified and moved into
§3b (2 entries: G01, A02) and §3c (23 entries) above, per owner approval.
Every real catalogue entry now has exactly one classification.

### Full accounting

5 breathing patterns + 73 video manifest entries = 78 total catalogue items.
6 out of scope (§3a) + 19 Free (§3b) + 48 Plus (§3c) + 0 unclassified (§3d)
+ 5 breathing patterns (§2) = 78. Every item accounted for exactly once.
Verified programmatically against the real manifest — no omissions, no
duplicates, no fabricated ids.

---

## 4. Journey completion — traced and confirmed free-completable

- **Morning**: Stretch (S04, free) → Breathe (`morning` pattern, free) →
  optional Meditate (`MorningMeditate.jsx` — non-narrated self-guided timer,
  **zero catalogue dependency**, unaffected by any of the above regardless)
  → Affirmation (`Affirmation.jsx` uses `intentionAffirmations.js` text,
  confirmed zero `mediaCatalog` dependency) → Session Complete (no media).
- **Evening**: Evening Flow (S05, free) → Reflection/Gratitude (text) →
  Evening Breathing (`evening` pattern, free) → optional Evening Meditate
  (same self-guided timer, zero catalogue dependency) → Prepare for Rest
  (Sleep Soundscapes: SL01/SL04/SL06 free; Wind-Down: E30 free) → Evening
  Complete.
- **Anytime Reset**: every one of its 7 needs (`calm`, `focus`, `energy`,
  `stress-relief`, `body-reset`, `quiet-time`, `better-mood`) plus
  `not-sure` has at least one Free result (verified per-need in §3b); the
  three quick-reset shortcuts (Breathe, Meditate, Instant Calm/E03) are all
  free regardless of any recommendation.

No free journey path can present a compulsory Plus item.

---

## 5. Meditation recommendation engine — the specific constraint that shaped §3b

`Meditate.jsx`'s engine (`meditationRecommendations.js`) has no
entitlement-awareness and, by its own documented design, no cross-need
fallback ("Priority 4: no unsuitable fallback — an empty result is a valid,
honest answer"). Four needs have exactly one matching entry each
(`focus`→B02, `stress-relief`→E04, `gratitude`→M04, `self-compassion`→M03);
marking any of those four Plus creates a need with zero free results — a
compulsory-Plus dead end with no alternative. Those four are Free by
necessity, not preference.

`AnytimeReset.jsx`'s own separate engine (`anytimeResetRecommendations.js`)
has the identical "no cross-need fallback" design over a different
24-entry pool with different needs. Its `body-reset` need is exclusively
S01/S02/S03; its `focus`/`energy`/`better-mood` needs share no entries at
all with the Morning/Evening/Sleep/Meditation free set. S01, F01, E11, and
E23 are Free specifically to close those four otherwise-dead-end needs —
this is why §3b's free set is not simply "one flagship item per category."

---

## 6. Cached UI display vs. server authorization — two separate things

- **Cached/SDK-snapshot display** (`getRevenueCatEntitlementSnapshot()`):
  usable **only** for non-authoritative UI hints (a "You have Plus" badge,
  hiding a paywall CTA). Valid for at most **15 minutes**, and only when
  tagged with the RevenueCat App User ID matching the **currently
  authenticated** Supabase user. Outside either bound, treat as unknown —
  never as entitled. **Never used to decide whether a Play button works.**
- **Authorization to play**: decided exactly once per request, server-side,
  inside the media-URL endpoint, reading the real `entitlements` table for
  the currently authenticated user — never the client SDK's local cache.

### Server authorization rule (exact)

A request for a `premium: true` entry is authorized only if **all** of:

1. A verified `entitlements` row exists for the authenticated user with
   `plan = 'plus'` and an access-granting `status`
   (`trial | active | grace_period | billing_retry`).
2. **`expires_at` is a real, non-null timestamp AND `expires_at > now()`
   at the moment of the request** — for any recurring provider (`stripe`,
   `apple`, `google`). A recurring subscription with a missing/null
   `expires_at` is a data-integrity problem, **not** implicit unlimited
   access, and must fail closed. The only provider where `expires_at`
   being null is legitimate is `manual` (an admin-granted, deliberately
   non-expiring grant) — that is the sole exception, and it must be an
   explicit `provider = 'manual'` check, never a blanket "null means
   fine."

This is evaluated fresh on every request against the live table — never a
cached `plan` value, and never inferred from "an `EXPIRATION` webhook
hasn't arrived yet, so it must still be active." Webhook delivery can lag;
the expiry timestamp already on record is the authority, checked at request
time.

**On verification failure** (the entitlement read itself errors/times out):
fail closed for `premium: true` — return an error, never a signed URL.
`premium: false` requests must succeed normally; a transient verification
failure must never take down free content. Client-side this surfaces as
`VERIFICATION_UNAVAILABLE`, never a silent downgrade to "Free" and never a
silent grant.

---

## 7. One enforcement point, applied consistently — with one explicit, documented exception

`get-beta-video-url` (`supabase/functions/get-beta-video-url/index.ts`) is
the sole path every real content route uses — journey pickers,
`Meditate.jsx`'s and `AnytimeReset.jsx`'s recommendation engines,
`Library.jsx`, and any direct/deep link — because `BetaVideoModal.jsx` is
the one component all of them route through, and it always calls this one
function with an `exerciseId`. Verified live against the DEV project:
`storage.buckets.wellness-videos.public = false`, RLS is enabled on
`storage.objects`, and **zero** policies exist on that table — in Postgres
this means deny-by-default for every role except `service_role`. There is
no direct-Storage bypass; this function (and the one exception below) are
the only ways to obtain a working URL. The §6 authorization rule must be
implemented **inside this one function**, so every calling route inherits
it automatically — a client-side `premium` check anywhere is a UI
convenience only, never the boundary.

### Documented exception: `get-pilot-video-url`

A second function exists — `supabase/functions/get-pilot-video-url/index.ts` —
that can sign URLs for exactly three fixed content items: `I01`, `A01`,
`SL01`. **Wording correction (verified by re-reading the actual code this
round):** its own `PILOT_PATHS` map has six entries, not three — each of
the three content items has an `-original` and a `-faststart` key
(`I01-original`/`I01-faststart`/`A01-original`/`A01-faststart`/
`SL01-original`/`SL01-faststart`), resolving to two DIFFERENT raw Storage
objects each (the pre-remux original vs. a separate `pilot-faststart/`
remux, for comparing encodes) — never the same objects
`get-beta-video-url`'s own `EXERCISE_PATHS` serves. This does not change
the substance of the exception below: it is still exactly these three
content items, still behind the same single `is_admin()` boundary for
every one of the six keys, with no dynamic path construction and no
drift beyond what's described here (re-verified this round). It is:

- Gated by `is_admin() = true` — a materially **stronger**, orthogonal
  authorization boundary than "any signed-in user," not a weaker one.
- DEV-only, explicitly documented in its own header as a throwaway
  diagnostic tool for comparing two video encodes, deletable at any time.
- **Exempt from the §6 entitlement check, by explicit decision, not
  oversight.** Justification: it requires an admin role a subscriber could
  never have anyway, so bypassing the Plus check here does not let any
  ordinary user reach anything they couldn't already reach through the
  admin boundary itself. Of its three ids: `SL01` is Free (§3b) regardless;
  `I01` is §3a out-of-scope (never Plus-gated at all); `A01` **is**
  classified Plus (§3c) — this pilot tool can therefore serve one genuine
  Plus-classified entry to an admin without an entitlement check. Approved
  as acceptable specifically because the admin gate is the stronger
  boundary, not a bypass available to any paying-or-not-paying user.

If this function is ever extended to more ids, or if any id it can serve
becomes Plus-classified later, this exception must be re-reviewed — it is
approved for the current three fixed ids only, not as a general precedent.

**Re-inspected this round (§11a-iii's own request to check for alternate
Plus-media access paths) — no code change needed.** Confirmed both
layers stay consistent: the Edge Function itself still only has these
six fixed keys behind the same `is_admin()` RPC check (no dynamic path
construction, no drift); and the one client page that calls it,
`FastStartPilot.jsx`, is reached only via `/admin/faststart-pilot`,
nested under `<AdminRoute>` in `App.jsx` — the same server-verified
admin gate every other `/admin/*` page already uses, redirecting a
guest or non-admin signed-in user before this page ever renders. This
is the one place in the app where "authorised administrator/test
access" is the correct, intended boundary instead of §6's entitlement
check — preserved exactly as approved, not loosened or tightened.

---

## 8. Lifecycle states — corrected terminology

| State | Access |
|---|---|
| Trial | Full Plus |
| Active | Full Plus |
| Cancelled, before period end | Full Plus, continues until the verified `expires_at` — never revoked early |
| Grace period / billing retry | Full Plus **only while `now() < expires_at`** — these statuses are a bounded continuation up to the already-known expiry, never unconditional/indefinite access from the status string alone |
| Account hold (Google) | **Plus access removed.** RevenueCat has no distinct `ACCOUNT_HOLD` webhook event — at the end of the grace period, if billing hasn't recovered, RevenueCat sends `EXPIRATION` and the entitlement is revoked; this is how Google's own account-hold (which explicitly suspends access) surfaces to us. No new status is needed — it lands on the existing `expired` mapping. |
| Expired | Plus access removed |
| **Every state above, once Plus access is removed** | **Free-tier access is fully preserved** — `entitlements.plan` only ever reads `'plus'` or `'free'`; there is no "suspended account" concept anywhere in the schema. A user who loses Plus simply reads as Free — every free route in §1 stays completely reachable. |

Restore: re-grants access only after a fresh server-verified read confirms
an active/trial record for the current user — never from the client SDK's
own restore-success callback alone.

Account switching: requires a fresh, server-verified read keyed to the
*currently authenticated* Supabase user id on every authorization decision
— **not** inferred from RevenueCat SDK logout/login call ordering.
`useRevenueCatIdentity.js`'s logout-before-login sequencing is a
cache-hygiene measure for §6's display layer only; it is not, and cannot
be treated as, proof of correct authorization. A race in that ordering
(backgrounding mid-sequence, a network race) would at worst cause a
momentary *display* glitch — never a wrong-user authorization — because
authorization never reads that cache in the first place.

---

## 9. Outstanding owner decisions

None remain from the original three. Catalogue classification is complete
(§3), the 15-minute current-user-bound cache window is approved (§6), and
the `get-pilot-video-url` exception is approved as documented (§7).
Nothing here blocks moving to the Implementation Checklist — implementation
and sandbox validation themselves are the remaining work, not further
specification decisions. §9a below adds one new approved design element;
it does not reopen any of the three.

## 9a. Complimentary tester access (manual grants) — design only, approved

A distinct mechanism from any paid provider (Stripe/Apple/Google) — for
giving a specific person Plus access without a purchase (e.g. an internal
tester, a reviewer). This section is design/specification only: no schema
change, no grant issued, no code written as part of this task.

**Requirements, as approved:**

1. **Admin-only, current-user-bound, explicit expiry.** Only an
   authenticated admin (the existing `is_admin()` boundary already used
   by `get-pilot-video-url` and the `/admin` area) may create a grant.
   Every grant is issued to one specific Supabase user id — never a class
   of users, never "anyone with this code" — and carries a mandatory
   expiry timestamp. An indefinite/non-expiring complimentary grant is
   not permitted by this design; if a genuinely indefinite case is ever
   needed, that is a distinct, separately-approved decision, not a
   `NULL` expiry on this mechanism.
2. **Grant/revoke/extend audit trail.** Every state change (grant issued,
   revoked, extended) is recorded with: which admin performed it, when,
   the affected user id, the previous and new expiry (for extend), and a
   reason field. Never a silent update — the existing `entitlements`/
   `provider_subscriptions` design already treats every write as
   attributable (`verification_source`); a manual grant needs the same
   discipline, plus the admin identity specifically, which paid-provider
   writes don't need (they're attributed to the provider, not a person).
3. **Cross-platform recognition.** A complimentary grant is resolved
   through the exact same unified `entitlements` read every paid
   provider already uses (`resolveEntitlement`/
   `resolveUnifiedEntitlement`) — recognized identically on iOS, Android,
   and web, with no separate "am I a comp user" code path anywhere.
4. **No payment or auto-renewal.** A complimentary grant never touches
   Stripe, Apple, or Google. It has a hard expiry, not a renewal date —
   nothing attempts to charge anyone or extend it automatically. An
   admin must explicitly extend it (per #2) if it should continue.
5. **Never overrides a valid paid entitlement, and never blocks one.**
   An expired or revoked manual grant must behave exactly like any other
   non-granting record: the user simply has no access-granting record
   from that source, and per the existing precedence rule
   (`resolveEntitlement` — most-recently-verified access-granting record
   wins, pure OR across providers), any still-valid Stripe/Apple/Google
   entitlement the same user has continues to grant access completely
   independently. A manual grant is additive only — it can never revoke
   or suppress a real paid entitlement, and a real paid entitlement can
   never be silently downgraded because a manual grant on the same
   account expired.

**How this fits the existing schema (design note, not a migration
proposal):** `entitlements`/`provider_subscriptions` already models
`provider = 'manual'` as one of four allowed values
(`stripe | apple | google | manual`), and §6's authorization rule already
carves out `provider = 'manual'` as the one legitimate case where a null
`expires_at` would otherwise be considered — this design tightens that:
a `manual` grant under this mechanism always has a real, non-null
`expires_at` (per requirement 1 above), so the "provider='manual' is
the sole null-expiry exception" language in §6 should be read as
covering only some *other*, not-yet-specified indefinite-grant
mechanism, never complimentary tester access as defined here. The
grant/revoke/extend audit trail (#2) is new — no existing table models
it; a real design (new table or columns) is owner/implementer work for
whenever this is actually built, not decided here.

## 10. Phase 2D

No agreed definition exists anywhere in this repository, this conversation,
or commit history across all branches. Left undefined.

---

## 11. Addenda (implementation round, post-baseline findings)

Found during implementation, after this specification's own baseline
commit (`ecef8bf...`). None of this reopens §9's three already-closed
decisions; each item below is either a **new, narrow, explicitly-pending**
decision or a **bug fix** against this document's own already-approved
rules.

### Plain-language recap: §9's three decisions, in practice

§9 names three decisions as already closed on paper: catalogue
classification (§3), the cache-validity rule (§6), and the
`get-pilot-video-url` exception (§7). "Approved" and "actually true in
the running code today" are two different questions — this recap answers
the second one for each, plainly, with what it means in practice and
what (if anything) still needs doing.

**1. Catalogue classification (§3)**
- *Current behaviour*: Complete and correct for the spec's own 73-entry
  baseline — 19 Free, 48 Plus, both client and server copies verified
  identical (`mediaCatalogPremiumClassification.test.js`). Ten ids added
  to the catalogue *after* that baseline (§11a) were never covered by it;
  the 5 real parents are now **owner-approved Plus** (§11a-i, decided
  this round); the 5 cover images stay never independently Plus (a bug
  fixed in an earlier round).
- *Practical consequence*: none remaining — this was the one open
  **business** decision in this list, and it is now closed. Runtime
  behaviour is unchanged by the approval itself (these five already
  resolved Plus before it; the decision removes the "pending" label, not
  the outcome).
- *Recommended resolution*: none required. Closed.

**2. The 15-minute/current-user cache-validity rule (§6)**
- *Current behaviour*: **Not implemented anywhere.**
  `getRevenueCatEntitlementSnapshot()` (`src/lib/revenueCatAdapter.js`)
  is a bare passthrough to the native SDK's own local cache — no
  fetch timestamp, no 15-minute check, no comparison against the
  currently authenticated Supabase user id. Its only real call site
  today is `SubscriptionSandboxTest.jsx`, a DEV-only diagnostic sandbox
  that just prints the raw result — not a live, user-facing screen.
- *Practical consequence*: No live risk today, precisely because nothing
  real consumes it yet. The real authorization boundary
  (`get-beta-video-url`) never reads this snapshot at all — §6's own
  "never used to decide whether a Play button works" rule already holds,
  independent of whether the 15-minute check exists. The risk is
  forward-looking only: a *future* screen that shows a quick "You
  already have Plus" badge from this snapshot, without separately
  re-implementing the 15-minute/current-user check itself, could show a
  stale or wrong-account badge — a display bug, not an access bug.
- *Recommended resolution*: build the actual validity-check helper when
  (and only when) a real screen first needs to consume this snapshot —
  building it speculatively now, with no consumer to prove it against,
  risks guessing wrong about the exact shape that consumer needs. The
  Implementation Checklist already carries this as an open item so it
  isn't silently forgotten when that day comes.

**3. The `get-pilot-video-url` exception (§7)**
- *Current behaviour*: Re-inspected this round end-to-end (§7's own
  updated text) — confirmed consistent with what was approved. One
  wording imprecision in this document corrected (its map has 6 keys,
  not 3, though still exactly 3 content items); the `is_admin()` gate is
  intact at both the Edge Function and the one client route that calls
  it (`/admin/faststart-pilot`, nested under `AdminRoute`); no drift
  beyond what §7 already describes.
- *Practical consequence*: none. This exception works exactly as
  approved and needs no change before activating §6 gating elsewhere.
- *Recommended resolution*: none required now. §7's own "must be
  re-reviewed if ever extended" clause stays in force unchanged.

### 11a. Post-baseline catalogue additions — M06, S06–S09, and their 5 cover images (10 ids total)

Ten real ids exist in `betaVideoManifest.js` today that were added to the
live catalogue *after* this spec's baseline commit and were **never**
classified by §3b/§3c's tables — a gap in this document, not an oversight
in the code that implements it. Exact enumeration:

| id | Parent content | Current runtime access |
|---|---|---|
| `M06` | Mindful Listening (real narrated MP3, ~106s) | **Plus** — owner-approved (§11a-i) |
| `M06COVER` | M06's still cover image (PNG) | **Fixed this round** — see §11a-ii below |
| `S06` | Chest & Shoulder Stretch (narrated audio) | **Plus** — owner-approved (§11a-i) |
| `S06COVER` | S06's still cover image (PNG) | **Fixed this round** |
| `S07` | Hands & Wrists Refresh (narrated audio) | **Plus** — owner-approved (§11a-i) |
| `S07COVER` | S07's still cover image (PNG) | **Fixed this round** |
| `S08` | Feet & Ankles Refresh (narrated audio) | **Plus** — owner-approved (§11a-i) |
| `S08COVER` | S08's still cover image (PNG) | **Fixed this round** |
| `S09` | Gentle Side Stretch (narrated audio) | **Plus** — owner-approved (§11a-i) |
| `S09COVER` | S09's still cover image (PNG) | **Fixed this round** |

All five parents are real, narrated, Library-browsable content (the
2026-10-05 "stretching content refresh" made S06–S09 Library-browsable;
`LIBRARY_EXCLUDED_STRETCH_IDS` in `mediaCatalog.js` is now empty).

#### 11a-i. Classification for the 5 parents: **Plus** — OWNER-APPROVED

Decided: `M06`, `S06`, `S07`, `S08`, `S09` are **Plus**, matching §3c's
own "pure breadth/variety within a category that already has approved
Free coverage" principle — Mindful Listening is variety within the
Meditation category (M01–M04 are already Free); the four Anytime Stretch
audio guides are variety within Stretching (S01, S04, S05 are already
Free). This was already the de facto runtime behaviour (the
not-in-Free-set default already resolved them Plus); this decision makes
it an **explicit, traceable, ratified** classification rather than a
silent side effect of "not in the Free list" — see `APPROVED_PLUS_IDS`
in both `mediaCatalog.js` and `premiumExerciseIds.ts`, and
`mediaCatalogPremiumClassification.test.js`'s dedicated coverage.
Runtime behaviour is unchanged by this decision — these five already
resolved Plus before it.

#### 11a-ii. Covers are preview-only assets, never independent paid activities — bug found and fixed this round

Before this fix, the server (`premiumExerciseIds.ts`) had **no** concept
of a cover image at all — its own "every id not in the Free set is Plus"
rule silently classified all 5 covers as Plus, independent of their
parent's own classification. This mattered concretely regardless of
which way §11a-i's approval landed: a cover's access was never derived
from its parent — it was an independent, accidental classification of a
static PNG sidecar, so a future reclassification of any parent to Free
would still have 403'd a legitimate Free user on its cover alone.

The client side was already correct — `mediaCatalog.js`'s
`INTERACTIVE_ONLY_IDS` already excluded all 5 covers from `MEDIA_CATALOG`
entirely (never a Library row, never independently selectable, never
carrying a `premium` flag), the same treatment §3a already gives
IB01/IS01/IM01/IM02 ("not standalone narrated content... no
protected/paid content behind them"). The fix makes the **server**
match: `premiumExerciseIds.ts` now has `PREVIEW_ONLY_COVER_IDS`
(`M06COVER`, `S06COVER`, `S07COVER`, `S08COVER`, `S09COVER`), and
`isPremiumExerciseId` returns `false` for any of them, unconditionally —
a cover is never independently Plus-gated, independent of §11a-i's
classification for its parent. Covered by
`mediaCatalogPremiumClassification.test.js` and a dedicated end-to-end
case in `betaVideoUrlAccess.test.js`.

This is the "intended preview behaviour" a cover should have: reachable
as a harmless thumbnail alongside whatever its parent's real access
decision is, never a second, independent gate on top of it.

#### 11a-iii. `AnytimeStretch.jsx` (`/anytime-stretch`) — client-side gate missing, now fixed

Found last round, **fixed this round**. `AnytimeStretch.jsx` fetches
S06–S09 (and their covers) via `requestBetaVideoUrl` — the exact same
function, and therefore the exact same `get-beta-video-url` server-side
boundary, every other page already uses. **This was never an actual
access bypass**: a guest's anonymous Supabase session still carries a
JWT, so a tap here always reached the server's own `is_anonymous`/§6
entitlement checks and was always correctly denied, pre- and post-fix.
What was missing was the CLIENT-side experience: this page had no
`isGuest`/entitlement pre-check at all (unlike Library/Meditate/
AnytimeReset/Support/QuietBreathing), and its one piece of error
handling only recognised `err.code === 'unauthorized'` (401, no JWT at
all — never actually reached by a real anonymous session in this app's
architecture); a guest's resulting 403 fell through to the page's
generic error view ("You don't have access to this beta preview," a
dead end with a "Back to sessions" button) instead of
`SignInPromptDialog`, and a non-entitled signed-in user's 403 had no
paywall at all.

**Fix**: `handleSelect` now checks `isGuest` and `resolvePremiumGate`
(reusing the same `premiumAccess.js`/`PlusPaywallDialog` machinery every
other page already uses — no new access rule invented) *before* ever
calling `requestBetaVideoUrl`, exactly matching every other page's own
pre-check ordering. The pre-existing, now-rarely-reachable catch-block
handling is left in place as a defensive fallback for a genuine race
(entitlement lapses between the pre-check and the request); the
mount-time preload effect is deliberately left untouched (gating it too
would risk reintroducing the documented iOS-autoplay-timing bug if
entitlement is still resolving at mount — an unentitled preload attempt
is already harmless, server-rejected and silently swallowed). See
`AnytimeStretch.phase2cGate.test.js` for focused coverage.

### 11b. Backend/client entitlement-resolution consistency — verified, one mismatch found and fixed

**How the three tables participate**, confirmed by direct comparison of
the new server reader against every existing established reader:

- **`subscriptions`** (legacy, one row per user) — Stripe/manual history
  predating the multi-provider design. Columns read: `plan, status,
  provider, expires_at`. A row only becomes a candidate record if
  `plan = 'plus'` (an explicit `plan = 'free'` default row is never a
  candidate — it could never win anyway).
- **`provider_subscriptions`** (one row per user × provider) — the
  multi-provider raw evidence table (Apple/Google, and any future
  provider). Columns read: `provider, status, current_period_expires_at`.
  Multiple rows per user are expected and are **all** read — this is
  what makes cross-provider access correct (below).
- **`entitlements`** (one row per user) — a **pre-computed projection**,
  written by the `apply_verified_*_subscription_event` RPCs using
  `resolveEntitlement`'s own status-only "most-recently-verified winner"
  rule. **Not** read by either the established client path
  (`entitlementSnapshot.js`) or the new server path
  (`entitlementRecords.ts`) — both read the two raw tables directly and
  resolve fresh on every request. This is deliberate, not an oversight:
  reading only the single projected winner would reintroduce exactly the
  failure mode `entitlementResolver.js`'s own header already warns
  against — "losing one provider must not revoke access if another
  verified provider is active" — if the *winning* provider's projection
  row ever lagged, a still-genuinely-active second provider's row would
  be invisible to a projection-only read. Reading both raw tables and
  doing a pure OR across every record (exactly as `resolveEntitlement`/
  `isAuthorizedForPremiumAccess` both do) is strictly more robust, and is
  the already-established pattern this new reader had to match, not
  deviate from.

**Direct comparison, new server reader vs. established client reader:**

| | `entitlementSnapshot.js` (client, established) | `entitlementRecords.ts` (server, new, this phase) |
|---|---|---|
| Tables read | `subscriptions` (`.maybeSingle()`), `provider_subscriptions` | identical |
| Legacy row → candidate | `plan !== 'plus'` → excluded; `provider ?? 'manual'` | identical |
| Columns needed by the consumer | `status, currentPeriodExpiresAt, cancelAtPeriodEnd, productId, lastVerifiedAt` (richer — feeds the *display* layer's winner-selection/tie-breaking) | `status, currentPeriodExpiresAt, provider` only — `isAuthorizedForPremiumAccess` does a pure OR (`.some()`), never picks a single winner, so `cancelAtPeriodEnd`/`productId`/`lastVerifiedAt` are correctly unused, not accidentally dropped |
| Missing-table tolerance | `isMissingTableError` (code `42P01`/regex) → treated as "no record," never a hard failure | identical, duplicated logic |
| Account scoping | `userId` parameter, never cached | server reader is called ONLY with the fresh, JWT-verified `verifiedUserId` from the *current* request — never a client-supplied id, never reused across requests |

No mismatch in the query/mapping logic itself — confirmed by this
comparison and by the pre-existing `entitlementResolution.serverMirror.test.js`
convention (cross-checking `resolveEntitlement` itself, which both
readers ultimately feed for the *display* layer).

**One real mismatch found and fixed** — in `isCurrentlyAccessGranting`
itself (not the table readers): the original implementation treated
`provider === 'manual'` as an **unconditional** expiry bypass —
`if (record.provider === 'manual') return true;`, checked *before* ever
looking at `currentPeriodExpiresAt`. §6's actual rule is narrower: a
**null** `expires_at` is the one legitimate exception for `manual`, not
"manual never expires." §9a's own complimentary-tester-access design
(approved, not yet built) is explicit that every such grant must carry a
**mandatory, honored** expiry once it exists ("An indefinite/non-expiring
complimentary grant is not permitted by this design"). The original code
would have granted access forever past a real, already-elapsed §9a
expiry. **Fixed**: a manual record now only skips the expiry check when
`currentPeriodExpiresAt` is genuinely null; a real timestamp on a manual
record is checked against `now` exactly like any other provider. See
`entitlementResolution.manualGrantExpiry.test.js` for direct, isolated
coverage (null → authorized, future → authorized, past → denied,
non-granting status → denied regardless of expiry) and the updated
end-to-end cases in `betaVideoUrlAccess.test.js`.

**Cross-provider access and account switching** — both already verified
correct and already covered by tests: `isAuthorizedForPremiumAccess` is
a pure `.some()` across every record from both tables (one lapsed
provider never blocks a separately-valid one on the same account), and
`checkPremiumAccess` is invoked only with the just-verified `userId` from
the current request's own JWT — never a client-supplied value, never
carried over between requests, so switching the signed-in account always
re-evaluates fresh against the new user's own rows.

**Existing manual grants vs. future §9a complimentary grants — two
distinct things sharing one `provider = 'manual'` label.** The only
existing write path to the legacy `subscriptions` table today is
`admin_set_subscription_status()` (`supabase/migrations/
20260808120000_sprint2_stage2_admin_foundation.sql`), and — confirmed by
re-reading both the migration and its one caller — it **only ever
writes `status`**; `plan` and `provider` are untouched, taking their
column defaults (`plan` defaults to `'free'`, `provider` to `'manual'`)
on first insert for a user with no row yet. `AdminSubscriptions.jsx`'s
own doc comment confirms this is deliberate, not an oversight: "plan and
provider are read-only here." This means `admin_set_subscription_status`
can only ever adjust the *status* of a row that already has
`plan = 'plus'` — it cannot grant Plus from scratch. A real
`provider = 'manual', plan = 'plus'` row, if one exists for a tester
today, was created some other way (direct DB write, predating any RPC) —
and `AdminSubscriptions.jsx`'s own "No renewal date" display for
`!row.expires_at` confirms a null-expiry manual row is an anticipated,
normal, already-displayed state in this admin tool, not an edge case.

So: **yes, an existing manual grant with a null `expires_at` is
intentional, already-anticipated indefinite/lifetime access** — exactly
what §6's original text already called it ("an admin-granted,
deliberately non-expiring grant"). This round's fix to
`isCurrentlyAccessGranting` (above) does **not** change this: a manual
record with `currentPeriodExpiresAt: null` still returns `true`
unconditionally, byte-for-byte the same outcome as before the fix — see
`entitlementResolution.manualGrantExpiry.test.js`'s own "a null
expires_at is authorized for manual (the one documented exception)"
case. **No existing authorised access is revoked by this fix.**

What the fix actually changes is narrower and purely forward-looking:
§9a's complimentary-tester mechanism (not yet built) will create manual
grants that **always** carry a real, non-null `expires_at` (its own
requirement 1: "An indefinite/non-expiring complimentary grant is not
permitted by this design"). Before the fix, `isCurrentlyAccessGranting`
would have granted access forever past such a grant's own real,
elapsed expiry anyway, purely because `provider === 'manual'` short-
circuited before ever looking at it — reintroducing, for that one future
mechanism, the exact indefinite-access shape §9a explicitly says is not
permitted. The fix closes that without touching today's genuinely-
indefinite rows: it only ever checks an expiry that is actually present;
a null one is still, and will always remain, the explicit "no expiry
set" signal for `manual`, never silently imposed where none exists.

### 11c. Lifecycle: an already-started activity, mid-activity expiry, and connectivity loss (spec was silent — OWNER-APPROVED this round, no separate mechanism built or needed)

The original specification does not address what happens if access ends
*while* someone is mid-playback, or if connectivity drops mid-request.
**Owner-approved rule**: an already-playing activity may finish; every
new protected-media request must revalidate access. This is the
existing architecture's own natural behaviour, requiring **no new
mechanism**:

- **A signed URL already issued is honored for its own, separate
  lifetime** (`SIGNED_URL_TTL_SECONDS`, 5 minutes) **regardless of what
  happens to the subscription afterward.** This is inherent to how a
  Supabase Storage signed URL works — Storage does not re-check
  entitlement per byte-range request against an already-signed URL, and
  this implementation does not add any such re-check. A user who starts
  a 10-minute video with a valid, freshly-checked entitlement and whose
  subscription lapses one minute in will **not** be cut off mid-stream;
  the browser/player already has the bytes (or is already mid-fetch)
  under a URL that remains valid for the rest of its own 5-minute window.
  Equally, bytes already downloaded/buffered client-side are not, and
  cannot be, revoked — there is no DRM or server-enforced playback
  kill-switch in this architecture, and building one is explicitly out of
  scope here.
- **Every *new* request for a signed URL is evaluated fresh, with no
  memory of the prior grant.** Re-opening the same content, retrying
  after a connectivity drop, or resuming later all go through the exact
  same `checkPremiumAccess` call as a first-time request. There is no
  "was already playing, so let it continue" state anywhere server-side —
  the server is stateless with respect to playback; it only ever answers
  "is this user, right now, entitled."
- **Connectivity loss mid-request** surfaces as `VERIFICATION_UNAVAILABLE`
  (503) if it breaks the entitlement read itself, or as a plain network
  failure (client-side `BetaVideoAccessError('network', ...)`) if it
  breaks the request before reaching the function at all — both already
  fail closed (no signed URL is ever returned on an incomplete read) and
  are already covered by existing tests. No special "offline grace
  period" or cached-offline-access exists or is proposed; offline access
  is explicitly out of scope, matching the task's own instruction.
- **This does not, and must not, extend subscription expiry.** The
  5-minute signed-URL courtesy window is a playback-continuity detail,
  completely separate from `expires_at` on the underlying subscription
  record — nothing in this design writes to, reads for extension
  purposes, or otherwise touches the subscription's own expiry as a
  result of an in-progress or interrupted stream.

This is now a ratified decision, not a proposal: the owner has
explicitly confirmed "an already-playing activity may finish; new
protected-media requests must revalidate access" — exactly what the
existing architecture already does (signed URLs with a fixed TTL,
stateless per-request authorization), so no code changed to implement
this approval. Building an active mid-stream revocation mechanism would
be new scope, explicitly not what was approved, and is not proposed
here.

### 11d. Coordinated DEV rollout and rollback

**The decisive fact**: this app is a Capacitor-wrapped webview with
`webDir: 'dist'` and no `server.url` override (`capacitor.config.ts`) —
the web bundle is baked into the native binary at build time, not loaded
from a remote URL at runtime. Every already-installed TestFlight build
and every already-distributed Android build (Play internal track; still
no Codemagic Android workflow — `codemagic.yaml` now defines **two** iOS
workflows, see below, and no Android one) carries its **own frozen** copy
of whatever JS existed at that build's time. Deploying
`get-beta-video-url` is a **backend-only** change that takes effect for
**every** client immediately, regardless of which JS bundle that client
happens to be running — the backend has no concept of "which app version
is calling it."

**Finalised, this round: which build pipeline to actually use.**
`codemagic.yaml` defines two iOS workflows, not one:
`wakewise-ios-testflight` ("WakeWise iOS TestFlight", production-style,
no sandbox purchase flag) and `wakewise-ios-sandbox-test` ("WakeWise iOS
Sandbox (RevenueCat Test)" — sets `VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST`
and the RevenueCat sandbox API keys, points at the DEV Supabase project,
reuses the same signing identity). **The sandbox workflow is the correct
one for this round** — real sandbox purchase validation (the
Implementation Checklist's own still-outstanding item) needs
`SubscriptionSandboxTest.jsx` compiled in, which only this workflow
enables. One documentation inconsistency found and worth flagging (not
fixed here — editing `codemagic.yaml` is outside this round's scope):
that workflow's own top-of-file comment block still says it "cannot
actually run yet" because the native RevenueCat wiring was "still
uncommitted, local-only" at the time it was written — but that native
wiring is long since committed on this very branch (`25fbef4`, already
pushed to `origin/revenuecat-native-purchase-integration`), and the
workflow's own later "Determine and set the next available sandbox build
number" step references "Build 24 ... now exists in App Store Connect" —
i.e., this exact workflow has already run successfully at least once.
The stated blocker is stale, not current; don't let it stop a run.

**Exact behaviour for an un-updated client, by scenario** — stated
precisely, not as a single "unaffected" verdict, because that verdict is
only true for two of the three scenarios below:

1. **Any Free content, any user, old or new client.** No change
   whatsoever. `get-beta-video-url` never runs the §6 check for a Free
   id — this is genuinely, fully unaffected.
2. **Plus content, an already-entitled (paying/trial) user, old or new
   client.** No change. Authorization is decided server-side from the
   user's real entitlement rows, not from which JS bundle made the
   request — an old client plays Plus content exactly as well as a new
   one, because the server has never needed the client to know anything
   about this check.
3. **Plus content, a NOT-currently-entitled user, specifically on an
   OLD (pre-Phase-2C) client.** This is the scenario this round's
   instruction is about, and it is a real, user-facing change, not a
   non-issue: a build that predates this work has no `premiumAccess.js`
   gate and no `PlusPaywallDialog` — it opens `BetaVideoModal`
   immediately on tap, which calls `get-beta-video-url` directly. The
   function now returns 403 for this case. `betaVideoAccess.js`'s
   existing `toAccessError` (unaffected by this round — it already
   handled 403 before Phase 2C, for the pre-existing anonymous-guest
   case) maps this to the generic `BetaVideoAccessError('forbidden',
   "You don't have access to this beta preview.")`, which
   `BetaVideoModal.jsx` renders as its ordinary error state: an icon, that
   one sentence, nothing else. **There is no crash and no security gap —
   access is correctly denied — but this is a genuine dead end, not a
   cosmetic rough edge**: the message does not say the content requires
   a subscription, does not offer a way to subscribe, and does not
   mention that updating the app would fix it. For someone who could
   previously tap and watch this exact content with no such message at
   all (before this backend change was deployed), the experience changes
   from "it plays" to "it fails, unexplained" — on an old client
   specifically, with none of this round's paywall UI available to
   soften or explain that change. A 503 (`VERIFICATION_UNAVAILABLE`, new
   this round) behaves the same way on an old client — falls into the
   same function's `if (status) return 'unknown'` branch, "Something
   went wrong loading this video," equally unexplained.

**How testers receive update guidance: there is none built into the
app.** No forced-update, minimum-version check, or in-app "please
update" messaging exists anywhere in this codebase (confirmed — no
`minimumSupportedVersion`/`forceUpdate`/equivalent exists), and nothing
added this round introduces one. The error message in scenario 3 above
does not mention updating. The only update signals a tester receives are
whatever the native store itself provides independently of this app's
own code: TestFlight's own update notification/badge (manual — a tester
must open TestFlight and tap Update, unless they've separately enabled
iOS's automatic-app-update setting) for iOS, and the Play Store's own
update mechanism for Android (can auto-update depending on the device's
own settings, independent of anything this app does). **Coordinating a
DEV test round around this change therefore requires telling testers
directly** (a message from whoever runs the test round) to update before
testing Plus-gated content, there is no automated substitute for that
communication today.

**Which clients must be available before backend gating is turned on,
for testing to be meaningful**:
1. A **new iOS build** via the **`wakewise-ios-sandbox-test`** Codemagic
   workflow ("WakeWise iOS Sandbox (RevenueCat Test)") → App Store
   Connect → TestFlight Internal Testing — bundling this round's `dist/`
   (`PlusPaywallDialog`, `premiumAccess.js`, the updated
   `useProtectedVideo.js`/page wiring, and the `AnytimeStretch.jsx` gate
   fix) — and every DEV tester must actually **update** to it (TestFlight
   does not auto-update; testers must open TestFlight and tap Update, or
   have automatic updates enabled). Use this workflow, not the plain
   `wakewise-ios-testflight` one, specifically because sandbox purchase
   validation also needs to happen in this same round (see the
   Implementation Checklist's own still-outstanding item) and only this
   workflow compiles `SubscriptionSandboxTest.jsx` in.
2. A **new Android build** bundling the same `dist/` — this repo has no
   automated Android→Play pipeline, so this remains a manual local
   build: `npx cap sync android` to copy the freshly-built `dist/` in,
   then a signed release via the `android` worktree's own Gradle project
   (`android/app/build.gradle`'s env-var-gated `signingConfigs.release` —
   `WAKEWISE_STORE_PASSWORD`/`WAKEWISE_KEY_PASSWORD` required,
   `WAKEWISE_KEYSTORE_PATH` defaulting to the standing
   `signing/wakewise-upload-key.jks`), then a manual upload of the
   resulting signed bundle to Play Console's internal testing track —
   the same process that produced the last real upload
   (`android/app/build.gradle`'s own uncommitted, unrelated versionCode
   bump to 5/1.0.4 references "the owner-confirmed uploaded build...
   2026-10-03").
   **Real blocker found and not yet resolved**: the retained `android`
   worktree (`C:\Users\mamun\Documents\moonlight-wellness\android`) is
   currently checked out on `android-back-navigation-integration`
   (`51bd3d2`, already merged with `dev`) — confirmed by direct
   comparison (`git merge-base --is-ancestor 51bd3d2 HEAD` against this
   branch returns false) to be a **different, diverged branch** from
   `revenuecat-native-purchase-integration` that contains **none** of
   this phase's work — not the native RevenueCat purchase wiring
   (`25fbef4`), not any Phase 2C access-control code. A Gradle build run
   against that worktree as it stands today would produce exactly the
   same old, pre-Phase-2C app scenario 3 above describes — not a test of
   this round's changes. Before step 2 can produce a meaningful build,
   this branch's code must first reach that worktree (merging this
   branch into `android-back-navigation-integration`, or checking out
   this branch there instead — a decision and a git operation this task
   does not make or perform). Until that happens, item 2 is not actually
   ready, independent of anything else in this checklist.
3. **Correct rollout order**: ship and confirm-updated both of the above
   **before** running `supabase functions deploy get-beta-video-url
   --project-ref kvdxuhyndevrfvsalgnx`. Gating is explicitly **not
   active** anywhere yet (this document's own header statement, still
   true) — there is no urgency pressure to deploy backend first "to be
   safe"; the client-first ordering is strictly better and costs nothing.
4. A **non-Capacitor web/browser path**, if one is used for DEV testing
   (e.g. `npm run dev`/a deployed web build opened directly in a
   browser, not through either native shell), is **not** subject to any
   of the above staleness concern — it is not bundled into a frozen
   native binary, so it always runs the latest `dist/` the moment that
   build is deployed to wherever it's hosted.

**Pre-flight dashboard checks (outside this repo, cannot be verified
from code)** — confirm before relying on this enforcement at all:
- `wellness-videos` Storage bucket is still private with zero
  permissive policies (flagged as **dashboard-verification-only** in
  `docs/release-readiness-register.md`'s own existing entry on this —
  unchanged by this round, still not something this repo's migrations
  create or enforce).
- The RevenueCat webhook → `apply_verified_*_subscription_event` RPC
  path is actually current for whatever real/sandbox subscriptions exist
  in the DEV project, so `provider_subscriptions`/`subscriptions` rows
  reflect reality before testing expects a specific access outcome.

**Rollback plan** — deliberately simple because this round's work is
**pure application code against an already-existing, unchanged schema**:
no migration, no new table/column, nothing in `entitlements`/
`provider_subscriptions`/`subscriptions` was altered. There is also no
runtime kill-switch: `src/lib/featureFlags.js` is explicitly
**local-device-only** ("No backend involved by design... local storage
over new infrastructure," per its own header) and has zero reach into
`get-beta-video-url`'s own Deno runtime — it cannot gate this
enforcement on or off remotely. Rollback is therefore: redeploy the
Edge Function from the last-known-good commit —
`git checkout <last-good-sha> -- supabase/functions/get-beta-video-url
supabase/functions/_shared/betaVideoUrlAccess.ts
supabase/functions/_shared/entitlementRecords.ts
supabase/functions/_shared/premiumExerciseIds.ts
supabase/functions/_shared/entitlementResolution.ts` then
`supabase functions deploy get-beta-video-url --project-ref
kvdxuhyndevrfvsalgnx` — no data repair step follows, because no data was
ever written or migrated by this change. Until the owner explicitly
decides to deploy, the safest "rollback" is simply: don't deploy yet.

---

## Implementation Checklist (not started — sandbox purchase validation and device testing remain outstanding prerequisites for activating any of this)

- [x] Owner resolves §9's three outstanding decisions (all three closed;
      the one addendum-era gap — §11a-i's catalogue classification for
      `M06`/`S06`–`S09` — is now also approved, see below).
- [x] Add `premium: true|false` fields to the §3b/§3c catalogue entries in
      `mediaCatalog.js` (additive only; §3d entries excluded until classified).
- [x] Add the §2 `premium` equivalent to `breathingPatterns.js`'s `box` and
      `coherent` entries.
- [x] Implement the §6 authorization rule inside `get-beta-video-url`
      (`supabase/functions/get-beta-video-url/index.ts` /
      `_shared/betaVideoUrlAccess.ts`) — the recurring-provider
      `expires_at IS NOT NULL AND expires_at > now()` check, the
      `provider = 'manual'` exception (corrected per §11b), and
      fail-closed behavior on verification failure.
- [ ] Decide and, if approved, implement §7's `get-pilot-video-url`
      treatment.
- [ ] Implement the §6 15-minute/current-user cache-validity check
      wherever `getRevenueCatEntitlementSnapshot()` is consumed for display.
- [x] Add a client-side `premium` lock (UI convenience only, per §7) at
      each of: journey pickers, `Meditate.jsx`, `AnytimeReset.jsx`,
      `Library.jsx`, `BetaVideoModal.jsx` (via `useProtectedVideo.js`).
- [x] Add tests for: the §6 authorization rule (including the missing-expiry
      recurring-provider case, the corrected manual-grant-expiry case, and
      the preview-only-cover case), the §8 account-hold/expired-preserves-free
      case, and the §5 need-coverage guarantee (no need in either
      recommendation engine can return zero Free results — unchanged by
      this round, already true from §3b's own construction).
- [x] **§11a-i, approved this round**: owner confirmed Plus classification
      for `M06`/`S06`–`S09` (`APPROVED_PLUS_IDS`, no runtime change — this
      was already the de facto default).
- [x] **§11c, approved this round**: owner confirmed the already-built
      lifecycle behaviour (an already-playing activity may finish; every
      new protected-media request revalidates access) — no code change.
- [x] **§11a-iii, fixed this round**: `AnytimeStretch.jsx` now has its own
      client-side guest/premium gate, matching every other content page.
- [x] **§7/§11, verified this round**: `get-pilot-video-url`/
      `FastStartPilot.jsx` re-inspected for drift — none found, no code
      change needed.
- [x] **§9/§11b, fixed this round**: `isCurrentlyAccessGranting`'s manual-
      grant expiry handling corrected to match §6/§9a exactly.
- [ ] Real sandbox purchase validation (Apple + Google) — outstanding,
      device testing not yet performed.
- [ ] Only after all of the above: activate gating. Not before.
