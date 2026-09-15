# WakeWise — App Store / Play Store Description Recommendations

No app-store listing exists yet in this codebase (WakeWise is currently
a web/PWA on Vercel). These are recommendations for whenever a store
listing is written, so the health/wellbeing positioning stays consistent
with `medical-disclaimer` in `src/lib/legalContent.js` from day one,
rather than needing a correction after submission.

## Positioning language to use

- "General wellbeing," "mindfulness," "routines," "relaxation,"
  "guided breathing" — all consistent with TGA's general health/wellness
  software exclusion (TGA explicitly names meditation apps as a typical
  example of software this exclusion covers — see the Legal, Subscription
  and Free-Trial Readiness report's sourcing).
- Google Play requires a truthful "Health apps declaration" form for
  every app, including apps that offer no health features — complete it
  accurately for WakeWise's actual scope (general wellness, not a
  medical/health-category app) rather than leaving it as a formality.

## Language to avoid in store copy

- Do not claim WakeWise treats, diagnoses, cures, or prevents anxiety,
  insomnia, depression, or any named condition.
- Do not promise a specific outcome ("fall asleep faster," "cure your
  anxiety") — "support your wind-down routine" is the kind of framing
  the in-app Medical and Wellbeing Disclaimer already uses; store copy
  should read the same way.
- Do not describe "Need a moment?" using clinical or crisis-adjacent
  language ("therapy," "counselling," "crisis support") — it is a guided
  self-help exercise, not a service equivalent to those.
- Do not imply 24/7 human support is available through the app itself.

## Recommended standard footer for store listings

A short line similar to: "WakeWise is a general wellbeing app and is
not a substitute for professional medical or mental health care. If you
need urgent help, contact your local emergency service." — mirrors the
in-app Medical and Wellbeing Disclaimer's own "In an emergency" wording
so a prospective user sees the same message before and after installing.

## Subscription/trial disclosure in store listings

Both Apple (App Store Review Guideline 3.1.2 / the Auto-Renewable
Subscriptions documentation) and Google Play's Subscriptions policy
expect the *in-app* purchase screen — not just the store listing page —
to clearly disclose price, billing interval, trial terms, and
auto-renewal before purchase. The store listing itself should not
contradict what the in-app paywall actually shows (see
`src/lib/pricingConfig.js` and `Subscription.jsx`) — e.g. don't advertise
a price in the store description that the in-app checkout doesn't
actually charge.
