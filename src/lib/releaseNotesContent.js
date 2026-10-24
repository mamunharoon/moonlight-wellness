// WakeWise — Closed Beta Preparation, Phase A — release notes content.
//
// Structured the same way as lib/legalContent.js's sections (heading +
// list), rendered through the same LegalLayout component — reused
// as-is, not modified, per this phase's own rules.

export const RELEASE_NOTES = [
  {
    // Profile/Settings cleanup, 2026-10-24 — the prior entry below
    // (Closed Beta 1, August 2026) had drifted: all three of its "Known
    // limitations" are now false (guided audio/video exists, self-
    // service deletion exists and is Passed per the launch tracker's
    // AUTH-06), and its subscription-billing line was stale. This entry
    // corrects that without deleting the historical record — the August
    // entry stays below, unedited. Deliberately does not claim
    // subscription/billing verification is complete (SUB-13/SUB-23 and
    // D-12 remain open in the tracker) and does not mention internal-
    // only tooling (e.g. the Settings environment/build indicator) that
    // isn't a user-facing feature.
    version: 'Closed Beta 2',
    date: 'October 2026',
    sections: [
      {
        heading: "What's new",
        list: [
          'A full guided Library: breathing, meditation, affirmations, stretches, and Sleep Soundscapes, plus new Gratitude & Reflection content — across Morning, Evening, and Anytime.',
          'Self-service account deletion, directly in the app (Profile → Privacy and Account → Account management → Request account deletion) — no need to email us.',
          'More reliable timezone, wake time, and bedtime settings, including a fix for timezone changes not always being saved correctly.',
          'A real alarm-sound preview, so you can hear a wake-up sound before choosing it (more sound choices are coming — only one is available today, honestly labelled).'
        ]
      },
      {
        heading: 'Known limitations',
        list: [
          'WakeWise Plus subscription billing and purchase verification are still being finalised ahead of general availability — subscription behaviour may still change before launch.',
          'Additional alarm sounds beyond the one available today ("Gentle Chimes") are planned but not yet ready.',
          'A unified Audio/Video Library section is planned; some areas of it are still marked "Coming soon."'
        ]
      }
    ]
  },
  {
    version: 'Closed Beta 1',
    date: 'August 2026',
    sections: [
      {
        heading: "What's new",
        list: [
          'WakeWise branding across the whole app.',
          'WakeWise Plus subscriptions — monthly and yearly, powered by Stripe (test mode during closed beta).',
          'A full legal framework: Privacy Policy, Terms of Service, Subscription Terms, Refund Policy, Medical and Wellbeing Disclaimer, Account Deletion Policy, and Data Retention Policy.',
          'Admin tools for managing users and subscriptions.',
          'A closed-beta program: onboarding checklist, in-app feedback, and this release notes page.'
        ]
      },
      {
        heading: 'Known limitations',
        list: [
          'Guided audio is not yet available.',
          'Billing is in Stripe test mode only — no real payments are processed during closed beta.',
          'Self-service account deletion is not yet available (see the Account Deletion Policy for how to request it).'
        ]
      }
    ]
  }
];
