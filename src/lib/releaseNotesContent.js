// WakeWise — Closed Beta Preparation, Phase A — release notes content.
//
// Structured the same way as lib/legalContent.js's sections (heading +
// list), rendered through the same LegalLayout component — reused
// as-is, not modified, per this phase's own rules.

export const RELEASE_NOTES = [
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
