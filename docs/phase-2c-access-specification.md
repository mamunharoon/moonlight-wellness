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
that can sign URLs for exactly three fixed ids: `I01`, `A01`, `SL01`. It is:

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

## Implementation Checklist (not started — sandbox purchase validation and device testing remain outstanding prerequisites for activating any of this)

- [ ] Owner resolves §9's three outstanding decisions.
- [ ] Add `premium: true|false` fields to the §3b/§3c catalogue entries in
      `mediaCatalog.js` (additive only; §3d entries excluded until classified).
- [ ] Add the §2 `premium` equivalent to `breathingPatterns.js`'s `box` and
      `coherent` entries.
- [ ] Implement the §6 authorization rule inside `get-beta-video-url`
      (`supabase/functions/get-beta-video-url/index.ts` /
      `_shared/betaVideoUrlAccess.ts`) — the recurring-provider
      `expires_at IS NOT NULL AND expires_at > now()` check, the
      `provider = 'manual'` exception, and fail-closed behavior on
      verification failure.
- [ ] Decide and, if approved, implement §7's `get-pilot-video-url`
      treatment.
- [ ] Implement the §6 15-minute/current-user cache-validity check
      wherever `getRevenueCatEntitlementSnapshot()` is consumed for display.
- [ ] Add a client-side `premium` lock (UI convenience only, per §7) at
      each of: journey pickers, `Meditate.jsx`, `AnytimeReset.jsx`,
      `Library.jsx`, `BetaVideoModal.jsx`.
- [ ] Add tests for: the §6 authorization rule (including the missing-expiry
      recurring-provider case), the §8 account-hold/expired-preserves-free
      case, and the §5 need-coverage guarantee (no need in either
      recommendation engine can return zero Free results).
- [ ] Real sandbox purchase validation (Apple + Google) — outstanding,
      device testing not yet performed.
- [ ] Only after all of the above: activate gating. Not before.
