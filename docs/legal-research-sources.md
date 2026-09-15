# WakeWise — Legal/Regulatory Research Sources (Phase 2)

Official/primary sources consulted for the Legal, Subscription and
Free-Trial Readiness task. All accessed 2026-09. This is a factual
source list, not legal advice — see the task's final report for which
items are flagged for qualified legal review.

## Apple

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — 3.1.1/3.1.1(a)/3.1.3/3.1.3(a) external payment & anti-steering rules (US-storefront apps get broader linking freedom per the Epic v. Apple outcome; EU Digital Markets Act carve-outs exist separately and were not independently verified in this pass), 3.1.2 subscription disclosure, 5.1.1(v) account deletion.
- [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

## Google

- [Play Subscriptions policy](https://support.google.com/googleplay/android-developer/answer/9900533)
- [Account deletion policy](https://support.google.com/googleplay/android-developer/answer/13327111) — requires both an in-app path and a separate web-based deletion resource.
- [Health Content and Services policy](https://support.google.com/googleplay/android-developer/answer/16679511)
- [Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291)

## Stripe

- [How subscriptions work](https://docs.stripe.com/billing/subscriptions/overview)
- [Configure trial offers](https://docs.stripe.com/billing/subscriptions/trials)
- [Cancel subscriptions](https://docs.stripe.com/billing/subscriptions/cancel) — cancellation is **immediate by default**; "cancel at period end" is an explicit opt-in the merchant must configure. **This codebase's actual live Stripe Customer Portal configuration for this setting was not verified in this task** — flagged in the final report as a required owner check.

## Australian Consumer Law / ACCC

- [ACCC — Subscriptions](https://www.accc.gov.au/media/subscriptions)
- [ACCC — subscription traps warning](https://www.accc.gov.au/media-release/accc-warns-consumers-to-beware-of-subscription-traps)
- [ACCC — eHarmony court finding (auto-renewal/pricing)](https://www.accc.gov.au/media-release/court-finds-eharmony-engaged-in-misleading-conduct-in-relation-to-automatic-renewal-and-pricing-of-its-subscriptions)
- [ACCC — Microsoft 365 subscriptions court action](https://www.accc.gov.au/media-release/microsoft-in-court-for-allegedly-misleading-millions-of-australians-over-microsoft-365-subscriptions)
- Note: a Competition and Consumer Amendment (Unfair Trading Practices) Bill 2026 is *proposed*, not yet law (proposed commencement July 2027) — its direction targets exactly subscription-trap/dark-pattern conduct.

## Australian Privacy Act / OAIC

- [Read the Australian Privacy Principles](https://www.oaic.gov.au/privacy/australian-privacy-principles/read-the-australian-privacy-principles)
- [APP 1 guidelines — open and transparent management](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-1-app-1-open-and-transparent-management-of-personal-information)
- Small-business (≤$3M turnover) exemption does **not** apply to entities holding "health information" — whether WakeWise's journal/intention data qualifies is genuinely ambiguous and unresolved here; flagged for legal review.

## GDPR / UK GDPR

- [ICO — territorial scope guidance (PDF)](https://ico.org.uk/media2/migrated/4031113/ic-327905-y2y5-knowledge-hub-territorial-scope.pdf)
- [ICO — international transfers guide](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/international-transfers-a-guide/)
- [GDPR.eu — non-EU companies](https://gdpr.eu/companies-outside-of-europe/) (secondary explainer, not the regulation text itself)
- Both EU and UK GDPR Art. 3(2) apply extraterritorially to a non-established company offering services to, or monitoring, individuals in the EU/UK — whether WakeWise's actual EU/UK usage meets that threshold is fact-specific and unresolved here.

## TGA (Australia) — wellness app vs. medical device

- [TGA — general health or wellness software exclusion](https://www.tga.gov.au/resources/guidance/understanding-general-health-or-wellness-software-exclusion) — **explicitly names meditation apps** as a typical excluded example.
- [TGA — behavioural change or coaching software exclusion](https://www.tga.gov.au/resources/guidance/understanding-behavioural-change-or-coaching-software-exclusion)
- Condition: neither exclusion applies if any feature makes a claim about a serious disease/condition — and for a multi-feature app, every feature must independently qualify.

## Crisis support numbers (verified, unrelated to the above regulatory research)

- [Lifeline crisis support — 13 11 14](https://www.lifeline.org.au/131114) (24/7; text 0477 13 11 14)
- [Mental health helplines — healthdirect](https://www.healthdirect.gov.au/mental-health-helplines)
- Australian emergency number 000 — general knowledge, not independently re-sourced.
