// WakeWise — Legal & Release Preparation, Phase 1; updated for Legal,
// Subscription and Free-Trial Readiness.
//
// Structured content for every /settings/:slug legal and support page,
// rendered through components/LegalLayout.jsx. Kept as plain data (not
// JSX) so the content can be reviewed, edited, or handed to a lawyer
// without touching any component code.
//
// DRAFT STATUS: this content was authored by an AI assistant to
// establish a real, substantive starting point, verified against what
// the app actually does today — not asserted from a template. It has
// NOT been reviewed by a lawyer. LegalLayout renders a visible draft
// notice on every page sourced from here; do not remove that notice by
// publishing this content without an actual legal review first.
//
// VERIFIED FACTS this content is built from (see the Legal, Subscription
// and Free-Trial Readiness report for full sourcing/access dates):
//   - Hosting: Supabase project region is ap-southeast-1 (Singapore) —
//     confirmed via `supabase projects list`, NOT Australia/Sydney as
//     might be assumed from the company being Australian. Vercel serves
//     the frontend from its global edge network, no single region.
//   - Analytics: no third-party analytics provider is wired in
//     (src/lib/analyticsEvents.js's trackEvent() is a local-only
//     console/debug-buffer no-op) — none is named below.
//   - Email: no Resend (or any other third-party transactional email
//     service) is used anywhere in this codebase — account emails
//     (password reset, signup confirmation) are Supabase Auth's own
//     built-in delivery, covered under "Supabase" below.
//   - ElevenLabs/CapCut are offline content-production tools with zero
//     runtime code path to end-user data — not named below, per the
//     instruction not to describe them as receiving personal information
//     without evidence they do.
//   - Account deletion: a real in-app self-service request flow exists
//     (Profile -> Privacy and Account -> Account management -> Request
//     account deletion), commit 528f911 — a 7-day cancellable pending
//     period, then manual, documented completion (see
//     docs/account-deletion-processor-spec.md). This replaces the
//     previous "email us, not yet available" wording below.
//   - Routine/meditation "completed today" indicators are stored in
//     localStorage on the user's own device only — never synced to
//     WakeWise's database — distinct from rhythm/intentions/journal
//     entries, which are.
//   - Subscription pricing below is ZavaraAI's PROPOSED Australian launch
//     pricing for UI/legal preparation. It has not been reconciled
//     against the actual Stripe test-mode Price objects currently
//     configured (STRIPE_PRICE_PLUS_MONTHLY/YEARLY secret values are not
//     independently readable from this codebase) — see
//     src/lib/pricingConfig.js's own header and the report's owner-
//     decision list. Do not treat this file's prices as Stripe-verified.

export const CONTACT_INFO = {
  company: 'ZavaraAi',
  product: 'WakeWise',
  email: 'info@zavaraai.com',
  country: 'Australia'
};

// Phase 9 — lightweight, centrally-defined document versions (no
// acceptance-recording table exists yet; see the report's proposed
// future schema). `effectiveDate` is shown alongside `lastUpdated` on
// every legal page — for a document's first published version they are
// the same date; a later substantive revision would bump `version` and
// `effectiveDate` while `lastUpdated` reflects the edit date.
export const DOCUMENT_VERSIONS = {
  'privacy-policy': { version: '1.1', effectiveDate: 'September 2026' },
  'terms-of-service': { version: '1.1', effectiveDate: 'September 2026' },
  'subscription-terms': { version: '1.1', effectiveDate: 'September 2026' },
  'refund-policy': { version: '1.0', effectiveDate: 'August 2026' },
  'medical-disclaimer': { version: '1.1', effectiveDate: 'September 2026' },
  'account-deletion-policy': { version: '2.0', effectiveDate: 'September 2026' },
  'data-retention-policy': { version: '1.1', effectiveDate: 'September 2026' }
};

const LAST_UPDATED = 'September 2026';

export const LEGAL_CONTENT = {
  'privacy-policy': {
    title: 'Privacy Policy',
    lastUpdated: LAST_UPDATED,
    ...DOCUMENT_VERSIONS['privacy-policy'],
    isLegal: true,
    sections: [
      {
        paragraphs: [
          `This policy explains what information ${CONTACT_INFO.product} collects, how it is used, and the choices you have. ${CONTACT_INFO.product} is provided by ${CONTACT_INFO.company}, based in ${CONTACT_INFO.country}. We have not provided a postal address here; ${CONTACT_INFO.email} is the fastest way to reach us.`
        ]
      },
      {
        heading: 'Information we collect',
        list: [
          'Account information: your email address and, if provided, your first and last name.',
          'Your daily rhythm: wake time, bedtime, and the IANA timezone you confirm or that your device reports. Your timezone tells us which local day your schedule belongs to — it is not GPS location, and we do not separately collect your device’s geographic location.',
          'Intentions and journal/reflection entries you write.',
          'Your subscription plan and status (e.g. free, trialing, active, cancelled) — stored in our own database; your card details are handled entirely by Stripe and never reach our servers.',
          'Account-deletion requests: if you request deletion, we keep a record of that request (its status and dates) for as long as needed to process it.',
          'Basic security and technical information that our authentication provider, Supabase, generates automatically to protect your account — such as sign-in timestamps, IP address, and browser/device type.',
          'Day-to-day "completed today" indicators for routines and meditation sessions are kept only in local storage on your own device — we do not receive or store these on our servers.'
        ]
      },
      {
        heading: 'What we do not collect',
        paragraphs: [
          'We do not collect precise location, contacts, microphone/camera access, or biometric data, and we do not use any third-party analytics or advertising tracker — no analytics provider is currently integrated into WakeWise.'
        ]
      },
      {
        heading: 'How we use your information',
        list: [
          'To authenticate you and keep your account secure.',
          'To personalise your routines, reminders, and recommendations around your own rhythm.',
          'To schedule reminders and save your progress across sessions and devices.',
          'To generate short-lived, secure links so you can play protected guided content.',
          'To provide and manage subscription access.',
          'To detect and prevent abuse, fraud, and misuse of the service.',
          'To respond to support requests.',
          'To meet our legal and accounting obligations.'
        ]
      },
      {
        heading: 'Who we share it with',
        paragraphs: [
          `We use trusted service providers to run ${CONTACT_INFO.product}: Supabase (authentication, database, and secure media links) and Vercel (hosting the app itself). Subscription payments are processed by Stripe. If we introduce native app-store subscriptions, Apple (App Store) and, where applicable, Google (Google Play) will process those payments and provide us your subscription status for that channel. These providers only receive the data needed to perform their function. We do not sell your personal information.`
        ]
      },
      {
        heading: 'Where your data is processed',
        paragraphs: [
          `${CONTACT_INFO.product}'s database currently runs on Supabase infrastructure in the Asia-Pacific region (Singapore); the app itself is served through Vercel's global content delivery network. If you use ${CONTACT_INFO.product} from outside Singapore or ${CONTACT_INFO.country}, your information may be transmitted to and processed in these and other countries our service providers operate in. Regardless of where our infrastructure is located, your saved timezone — not our server location — determines your WakeWise schedule.`
        ]
      },
      {
        heading: 'Data security',
        paragraphs: [
          'Your data is protected using industry-standard access controls, including row-level security on our database so that only you can read your own wellness data. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.'
        ]
      },
      {
        heading: 'Retention and deletion',
        paragraphs: [
          'You can request deletion of your account directly in the app (Profile → Privacy and Account → Account management → Request account deletion). This starts a 7-day period during which you can cancel the request and keep your account. If it is not cancelled, your account and personal data are permanently deleted or anonymised in a manual, documented process — deletion is not instantaneous or automated end-to-end today, and we aim to complete it within 30 days of the pending period ending.',
          'Cancelling a paid subscription is different from deleting your account: cancelling stops future billing but keeps your account and data; deleting your account affects your data as described above, independently of any subscription. Uninstalling the app from your phone does not delete your account or data — you need to request deletion in the app (or, until you can sign in, by contacting us).',
          'We may retain minimal billing or security records for as long as required by law even after account deletion — see our Data Retention Policy and Account Deletion Policy for detail.'
        ]
      },
      {
        heading: 'Your rights',
        paragraphs: [
          `Depending on where you live, you may have rights to access, correct, or request deletion of your personal information, and to lodge a complaint with us or your local privacy regulator. You can request a copy of your data or ask us to delete your account at any time — see our Account Deletion Policy, or contact us at ${CONTACT_INFO.email}.`
        ]
      },
      {
        heading: "Children's privacy",
        paragraphs: [
          `${CONTACT_INFO.product} is not directed at children, and we recommend it for users aged 16 and over. We do not knowingly collect information from children, and we have not built parental-consent verification into the app.`
        ]
      },
      {
        heading: 'Changes to this policy',
        paragraphs: [
          'We may update this policy as the app evolves. Material changes will be reflected here with an updated date and effective date.'
        ]
      }
    ]
  },

  'terms-of-service': {
    title: 'Terms of Service',
    lastUpdated: LAST_UPDATED,
    ...DOCUMENT_VERSIONS['terms-of-service'],
    isLegal: true,
    sections: [
      {
        paragraphs: [
          `These terms govern your use of ${CONTACT_INFO.product}, provided by ${CONTACT_INFO.company}. By using the app, you agree to these terms.`
        ]
      },
      {
        heading: 'The service',
        paragraphs: [
          `${CONTACT_INFO.product} provides guided breathing exercises, mindfulness and meditation exercises, affirmations, routines, habit tracking, and general wellness guidance. It is a self-guided wellbeing tool — see our Medical and Wellbeing Disclaimer for important limits on what it is not.`
        ]
      },
      {
        heading: 'Eligibility and your account',
        paragraphs: [
          `You must be able to form a binding agreement to use ${CONTACT_INFO.product}; see our Children's Privacy section in the Privacy Policy for our recommended minimum age. You are responsible for keeping your account credentials secure and for all activity under your account, and must provide accurate information when creating an account.`
        ]
      },
      {
        heading: 'Acceptable use',
        paragraphs: [
          `You agree not to misuse ${CONTACT_INFO.product} — including attempting to disrupt the service, access other users' data, or use the app for any unlawful purpose.`
        ]
      },
      {
        heading: 'Licence and content',
        paragraphs: [
          `All content, branding, and functionality within ${CONTACT_INFO.product} — including guided audio and video — belongs to ${CONTACT_INFO.company} or its licensors. We grant you a personal, non-commercial, non-transferable licence to use the app and its content for your own wellbeing use. You may not copy, download outside the app, redistribute, publicly perform, scrape, or create derivative works from any protected content.`
        ]
      },
      {
        heading: 'Subscriptions and free trial',
        paragraphs: [
          `Some features require a paid ${CONTACT_INFO.product} Plus subscription, which may include a free trial period. Unless cancelled before the trial ends, your subscription automatically renews and converts to a paid subscription at the then-applicable price for your selected plan. Billing intervals, pricing, renewal, and cancellation are described in full in our Subscription Terms — read them before subscribing.`
        ]
      },
      {
        heading: 'Refunds',
        paragraphs: [
          'Our approach to refund requests is set out in our Refund Policy. Nothing in that policy or these terms limits any consumer guarantee that cannot lawfully be excluded.'
        ]
      },
      {
        heading: 'Account suspension and termination',
        paragraphs: [
          'We may suspend or terminate accounts that breach these terms, that we reasonably believe pose a security or abuse risk, or as required by law. Where practical, we will tell you why.'
        ]
      },
      {
        heading: 'Account deletion',
        paragraphs: [
          'You may request deletion of your account at any time from Profile → Privacy and Account → Account management → Request account deletion. This starts a cancellable pending period (currently 7 days) before deletion is completed — see our Account Deletion Policy for exactly what this involves. Deleting your account does not automatically refund any previous payment, and any active subscription should be addressed separately (see Subscriptions and free trial, above).'
        ]
      },
      {
        heading: 'Service availability and changes',
        paragraphs: [
          `We aim to keep ${CONTACT_INFO.product} available and reliable but do not guarantee uninterrupted access — the service may be unavailable during maintenance, updates, or outages at our service providers. We may add, change, or remove features over time, including features available only on some platforms.`
        ]
      },
      {
        heading: 'Disclaimer and limitation of liability',
        paragraphs: [
          `${CONTACT_INFO.product} is provided "as is" without warranties of any kind. To the extent permitted by law, ${CONTACT_INFO.company} is not liable for any indirect or consequential loss arising from your use of the app. Nothing in these terms excludes any guarantee, right, or remedy you have under the Australian Consumer Law, or equivalent consumer protection law in your country, that cannot lawfully be excluded. (This clause requires qualified legal review before this is treated as final.)`
        ]
      },
      {
        heading: 'Governing law',
        paragraphs: [
          `These terms are governed by the laws of ${CONTACT_INFO.country}, without prejudice to any mandatory consumer-protection law of your own country that applies to you regardless of choice of law. (Requires legal confirmation before this is treated as final.)`
        ]
      },
      {
        heading: 'Complaints and contact',
        paragraphs: [
          `If you have a complaint about ${CONTACT_INFO.product} or these terms, contact us at ${CONTACT_INFO.email} and we will do our best to resolve it.`
        ]
      },
      {
        heading: 'Changes to these terms',
        paragraphs: [
          'We may update these terms from time to time. Continued use of the app after a change means you accept the updated terms.'
        ]
      }
    ]
  },

  'subscription-terms': {
    title: 'Subscription Terms',
    lastUpdated: LAST_UPDATED,
    ...DOCUMENT_VERSIONS['subscription-terms'],
    isLegal: true,
    sections: [
      {
        paragraphs: [
          `${CONTACT_INFO.product} offers a free plan and a paid "WakeWise Plus" subscription. This page explains how the free trial, billing, renewal, and cancellation work. Exact current pricing and any trial length are always shown before you subscribe — this page explains the rules, not a fixed price.`
        ]
      },
      {
        heading: 'Free trial',
        paragraphs: [
          'New Plus subscriptions may start with a free trial (currently 7 days). If you do not cancel before the trial ends, it automatically converts to a paid subscription and you will be charged the price shown at checkout for your selected plan. You can cancel during the trial and pay nothing.'
        ]
      },
      {
        heading: 'Billing cycles',
        list: [
          'Monthly — billed every month from your signup or trial-end date.',
          'Yearly — billed once a year from your signup or trial-end date. An introductory first-year price may be offered for a limited time to eligible new subscribers; if so, the checkout screen will clearly show both that introductory price and the standard price your subscription renews at afterwards.'
        ]
      },
      {
        heading: 'Renewal',
        paragraphs: [
          'Subscriptions renew automatically at the end of each billing period unless you cancel before the renewal date, at the price shown at the time of your most recent checkout or renewal notice.'
        ]
      },
      {
        heading: 'Cancellation',
        paragraphs: [
          'You can cancel anytime from Account management → Manage subscription (or Profile → Manage Subscription), which opens our billing provider\'s secure Customer Portal. Cancelling stops future renewals and does not, by itself, issue any refund for time already paid (see our Refund Policy). Whether you keep access for the remainder of an already-paid period after cancelling depends on the cancellation option used in that portal — this page will be updated to confirm the exact behaviour once verified.'
        ]
      },
      {
        heading: 'Payment processing',
        paragraphs: [
          `All payments are processed securely by Stripe (or, on platforms where we offer it, Apple's or Google's in-app billing). ${CONTACT_INFO.company} does not store your card details.`
        ]
      },
      {
        heading: 'Price changes',
        paragraphs: [
          'If we change subscription pricing, we will give existing subscribers reasonable notice before it applies to their next renewal.'
        ]
      },
      {
        heading: 'Failed payments',
        paragraphs: [
          `If a renewal payment fails, our payment processor may retry it automatically. If payment continues to fail, your subscription may be cancelled or lose Plus access. Contact us at ${CONTACT_INFO.email} if you believe a payment failed in error.`
        ]
      },
      {
        heading: 'Subscription is separate from account deletion',
        paragraphs: [
          'Cancelling your subscription keeps your WakeWise account and data — it only stops future billing. Deleting your account is a separate, further step (see our Account Deletion Policy) and does not, by itself, cancel or refund an active subscription.'
        ]
      }
    ]
  },

  'refund-policy': {
    title: 'Refund Policy',
    lastUpdated: LAST_UPDATED,
    ...DOCUMENT_VERSIONS['refund-policy'],
    isLegal: true,
    sections: [
      {
        paragraphs: [
          `We want ${CONTACT_INFO.product} Plus to be worth it. This policy explains how refunds work.`
        ]
      },
      {
        heading: 'General policy',
        paragraphs: [
          'Subscription payments are generally non-refundable for the remaining time in a billing period once it has started. Cancelling stops future renewals, but does not refund the current period — you keep access until it ends.'
        ]
      },
      {
        heading: 'Requesting a refund',
        paragraphs: [
          `If you believe you were charged in error, were charged after a genuine cancellation attempt failed, or have another exceptional circumstance, contact us at ${CONTACT_INFO.email}. We review requests individually and may issue a discretionary refund.`
        ]
      },
      {
        heading: 'How refunds are processed',
        paragraphs: [
          'Approved refunds are issued back to your original payment method via Stripe, and may take several business days to appear on your statement.'
        ]
      },
      {
        heading: 'Your legal rights',
        paragraphs: [
          `Nothing in this policy limits any right or remedy you have under the Australian Consumer Law, or equivalent consumer protection law in your country, that cannot lawfully be excluded.`
        ]
      }
    ]
  },

  'medical-disclaimer': {
    title: 'Medical and Wellbeing Disclaimer',
    lastUpdated: LAST_UPDATED,
    ...DOCUMENT_VERSIONS['medical-disclaimer'],
    isLegal: true,
    sections: [
      {
        paragraphs: [
          `Please read this carefully. It explains what ${CONTACT_INFO.product} is — and, just as importantly, what it is not.`
        ]
      },
      {
        heading: `What ${CONTACT_INFO.product} provides`,
        paragraphs: [
          `${CONTACT_INFO.product} is a general wellbeing, routine, mindfulness, and relaxation app — guided breathing exercises, meditation and mindfulness sessions, affirmations, routines, habit tracking, and general wellness guidance, intended to support everyday wellbeing.`
        ]
      },
      {
        heading: `What ${CONTACT_INFO.product} does NOT provide`,
        list: [
          'Medical care, diagnosis, or treatment of any kind.',
          'Psychiatric or psychological treatment services.',
          'Emergency services.',
          'Crisis intervention.',
          'A guarantee of any particular sleep, anxiety, or other health outcome.'
        ]
      },
      {
        heading: 'Using WakeWise safely',
        paragraphs: [
          `Don't use guided breathing, meditation, or relaxation content in ${CONTACT_INFO.product} while driving, operating machinery, or doing anything else where reduced alertness would be unsafe. If an exercise ever makes you feel worse, stop and seek appropriate support.`
        ]
      },
      {
        heading: 'In an emergency',
        paragraphs: [
          `${CONTACT_INFO.product}'s "Need a moment?" support tools are general wellbeing exercises, not emergency or clinical support, and are not equipped to help in a crisis. If you or someone else is in immediate danger, contact your local emergency service now (000 in Australia). If you are struggling with your mental health, please reach out to a qualified professional or a crisis support service in your area — for example, in Australia, Lifeline (call or text 13 11 14, lifeline.org.au) offers free, confidential 24/7 crisis support.`
        ]
      },
      {
        heading: 'Talk to a professional',
        paragraphs: [
          `${CONTACT_INFO.product} is a self-guided wellbeing tool, not a substitute for professional medical or mental health care, and does not replace qualified professional advice. Always consult a qualified healthcare provider for any medical or psychological concern, especially one that is persistent or serious, and before making changes to any treatment you are currently receiving.`
        ]
      },
      {
        heading: 'No guaranteed outcomes',
        paragraphs: [
          `Using ${CONTACT_INFO.product} does not guarantee any particular wellbeing outcome. Individual results vary.`
        ]
      }
    ]
  },

  'account-deletion-policy': {
    title: 'Account Deletion Policy',
    lastUpdated: LAST_UPDATED,
    ...DOCUMENT_VERSIONS['account-deletion-policy'],
    isLegal: true,
    sections: [
      {
        paragraphs: [
          'You can request deletion of your account and personal data at any time, directly in the app.'
        ]
      },
      {
        heading: 'How to request deletion',
        paragraphs: [
          `Go to Profile → Privacy and Account → Account management → Request account deletion. You'll be asked to confirm your password and type a confirmation phrase before your request is submitted — this is deliberate friction to prevent an accidental request, not an extra hurdle to stop you. If you can't sign in to make the request yourself, email us at ${CONTACT_INFO.email} from your account's email address and we will assist.`
        ]
      },
      {
        heading: 'A cancellable pending period, not an instant deletion',
        paragraphs: [
          'Submitting a request does not delete anything immediately. It starts a 7-day pending period, shown in the app with the exact date your request is scheduled for. You can cancel the request at any time before that date from the same Account management screen and keep your account exactly as it was — cancelling and resubmitting later is always possible.'
        ]
      },
      {
        heading: 'What happens after the pending period',
        paragraphs: [
          'If you do not cancel, completing the deletion is currently a manual, documented process carried out by our team — it is not yet a fully automated system. We aim to complete it within 30 days of the pending period ending, and will address any active subscription as part of that process (see "Active subscriptions", below).'
        ]
      },
      {
        heading: 'What gets deleted',
        paragraphs: [
          'Your account, profile information, and wellness data — daily rhythm, intentions, journal entries, and subscription record — are deleted or anonymised in our active systems.'
        ]
      },
      {
        heading: 'What we may retain',
        paragraphs: [
          'We may retain minimal billing or security records for the period required by law (see our Data Retention Policy) even after account deletion, as we may be legally required to keep certain financial records. Where we retain such a record, we remove or minimise identifying details where we can.'
        ]
      },
      {
        heading: 'Active subscriptions',
        paragraphs: [
          'Account deletion does not automatically refund any previous payment. If you have an active subscription when your account is deleted, it will be cancelled as part of that process — we recommend reviewing Manage subscription first if you want to cancel it yourself or understand what you are giving up. Deleting your account and cancelling your subscription are different actions; see our Subscription Terms.'
        ]
      }
    ]
  },

  'data-retention-policy': {
    title: 'Data Retention Policy',
    lastUpdated: LAST_UPDATED,
    ...DOCUMENT_VERSIONS['data-retention-policy'],
    isLegal: true,
    sections: [
      {
        paragraphs: [
          'This page explains how long we keep different types of data.'
        ]
      },
      {
        heading: 'While your account is active',
        paragraphs: [
          'We keep your account and wellness data for as long as your account remains active, so the app can work the way you expect.'
        ]
      },
      {
        heading: 'Deletion requests',
        paragraphs: [
          'A pending deletion request (status, requested date, and scheduled date) is kept for as long as the request is pending or until it is cancelled, so we can process or reverse it correctly. See our Account Deletion Policy for the full 7-day pending process.'
        ]
      },
      {
        heading: 'After account deletion',
        paragraphs: [
          'Once a deletion request completes, your account and wellness data are deleted or anonymised in our active systems (backups are cycled out over time as part of normal operations). A minimal, non-identifying record that a deletion occurred and when may remain for our own operational audit trail.'
        ]
      },
      {
        heading: 'Billing records',
        paragraphs: [
          `Financial and billing records associated with WakeWise Plus subscriptions are retained for as long as required by law — typically several years, to meet tax and accounting obligations in ${CONTACT_INFO.country}. These are managed by our payment processor(s) — currently Stripe, and in future potentially Apple or Google for their respective purchase channels.`
        ]
      },
      {
        heading: 'Questions',
        paragraphs: [
          `If you have questions about how long specific data is kept, contact us at ${CONTACT_INFO.email}.`
        ]
      }
    ]
  },

  // Preserved from the WakeWise branding phase — same title/body,
  // slug intentionally left as 'about-solas' (route slugs are not
  // renamed per that phase's own rule). Not a legal document: no
  // draft notice, no contact footer.
  'about-solas': {
    title: 'About WakeWise',
    lastUpdated: null,
    isLegal: false,
    sections: [
      {
        heading: 'WakeWise by ZavaraAi',
        paragraphs: ['A quiet companion for mornings, evenings, and moments when life feels heavy.']
      }
    ]
  },

  'contact-us': {
    title: 'Contact Us',
    lastUpdated: LAST_UPDATED,
    isLegal: false,
    sections: [
      {
        paragraphs: [
          `We're here to help with anything related to your ${CONTACT_INFO.product} account, subscription, or general feedback.`
        ]
      },
      {
        heading: 'Email',
        paragraphs: [CONTACT_INFO.email]
      },
      {
        heading: 'Company',
        paragraphs: [`${CONTACT_INFO.company} — ${CONTACT_INFO.country}`]
      },
      {
        paragraphs: [
          'For billing or subscription questions, you can manage your subscription directly from Profile → Manage Subscription, or from Profile → Privacy and Account → Account management. Account management is also where you can request account deletion.'
        ]
      }
    ]
  }
};
