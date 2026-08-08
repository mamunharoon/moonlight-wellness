// WakeWise — Legal & Release Preparation, Phase 1
//
// Structured content for every /settings/:slug legal and support page,
// rendered through components/LegalLayout.jsx. Kept as plain data (not
// JSX) so the content can be reviewed, edited, or handed to a lawyer
// without touching any component code.
//
// DRAFT STATUS: this content was authored by an AI assistant to
// establish a real, substantive starting point — it reflects what the
// app actually does today (Supabase for auth/data, Stripe for test-mode
// billing, wellness-only scope, no medical claims). It has NOT been
// reviewed by a lawyer. LegalLayout renders a visible draft notice on
// every page sourced from here; do not remove that notice by publishing
// this content without an actual legal review first.
//
// Account Deletion Policy and Data Retention Policy deliberately do NOT
// claim a self-service deletion flow exists — Settings.jsx and
// Profile.jsx both still show "Account deletion will be available
// soon" placeholders (Settings & Profile Polish, Sprint 1). The policy
// text below only ever promises what the app can currently deliver:
// deletion by contacting support.

export const CONTACT_INFO = {
  company: 'ZavaraAi',
  product: 'WakeWise',
  email: 'info@zavaraai.com',
  country: 'Australia'
};

const LAST_UPDATED = 'August 2026';

export const LEGAL_CONTENT = {
  'privacy-policy': {
    title: 'Privacy Policy',
    lastUpdated: LAST_UPDATED,
    isLegal: true,
    sections: [
      {
        paragraphs: [
          `This policy explains what information ${CONTACT_INFO.product} collects, how it is used, and the choices you have. ${CONTACT_INFO.product} is provided by ${CONTACT_INFO.company}, based in ${CONTACT_INFO.country}.`
        ]
      },
      {
        heading: 'Information we collect',
        list: [
          'Account information: your email address and, if provided, your name.',
          'Wellness data you enter: daily rhythm (wake/bed times), intentions, journal entries, and routine progress.',
          'Subscription and billing information, handled by our payment processor Stripe — we do not store your card details ourselves.',
          'Basic technical data (such as device and browser type) needed to operate the app reliably.'
        ]
      },
      {
        heading: 'How we use your information',
        list: [
          'To provide and personalise the app — your routines, intentions, and rhythm.',
          'To manage your account and subscription.',
          'To communicate with you about your account or support requests.',
          'To maintain the security and reliability of the service.'
        ]
      },
      {
        heading: 'Who we share it with',
        paragraphs: [
          `We use trusted service providers to run ${CONTACT_INFO.product}: Supabase (authentication and database hosting) and Stripe (payment processing). These providers only receive the data needed to perform their function. We do not sell your personal information.`
        ]
      },
      {
        heading: 'Data security',
        paragraphs: [
          'Your data is protected using industry-standard access controls, including row-level security on our database so that only you can read your own wellness data.'
        ]
      },
      {
        heading: 'Your rights',
        paragraphs: [
          `You can request a copy of your data or ask us to delete your account at any time — see our Account Deletion Policy, or contact us at ${CONTACT_INFO.email}.`
        ]
      },
      {
        heading: "Children's privacy",
        paragraphs: [
          `${CONTACT_INFO.product} is not directed at children under 16, and we do not knowingly collect information from them.`
        ]
      },
      {
        heading: 'Changes to this policy',
        paragraphs: [
          'We may update this policy as the app evolves. Material changes will be reflected here with an updated date.'
        ]
      }
    ]
  },

  'terms-of-service': {
    title: 'Terms of Service',
    lastUpdated: LAST_UPDATED,
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
          `${CONTACT_INFO.product} provides guided breathing exercises, mindfulness exercises, affirmations, routines, habit tracking, and general wellness guidance. It is a self-guided wellbeing tool — see our Medical and Wellbeing Disclaimer for important limits on what it is not.`
        ]
      },
      {
        heading: 'Your account',
        paragraphs: [
          'You are responsible for keeping your account credentials secure and for all activity under your account. You must provide accurate information when creating an account.'
        ]
      },
      {
        heading: 'Acceptable use',
        paragraphs: [
          `You agree not to misuse ${CONTACT_INFO.product} — including attempting to disrupt the service, access other users' data, or use the app for any unlawful purpose.`
        ]
      },
      {
        heading: 'Subscriptions',
        paragraphs: [
          'Some features require a paid WakeWise Plus subscription. Subscription billing, cancellation, and renewal are described in our Subscription Terms.'
        ]
      },
      {
        heading: 'Intellectual property',
        paragraphs: [
          `All content, branding, and functionality within ${CONTACT_INFO.product} belong to ${CONTACT_INFO.company} or its licensors. You may use the app for personal, non-commercial purposes only.`
        ]
      },
      {
        heading: 'Disclaimer and limitation of liability',
        paragraphs: [
          `${CONTACT_INFO.product} is provided "as is" without warranties of any kind. To the extent permitted by law, ${CONTACT_INFO.company} is not liable for any indirect or consequential loss arising from your use of the app. Nothing in these terms excludes any guarantee, right, or remedy you have under the Australian Consumer Law that cannot lawfully be excluded.`
        ]
      },
      {
        heading: 'Termination',
        paragraphs: [
          'You may stop using the app and request account deletion at any time. We may suspend or terminate accounts that breach these terms.'
        ]
      },
      {
        heading: 'Governing law',
        paragraphs: [
          `These terms are governed by the laws of ${CONTACT_INFO.country}.`
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
    isLegal: true,
    sections: [
      {
        paragraphs: [
          `${CONTACT_INFO.product} offers a free plan and a paid "WakeWise Plus" subscription. This page explains how Plus billing, renewal, and cancellation work.`
        ]
      },
      {
        heading: 'Billing cycles',
        list: [
          'Monthly — billed every month from your signup date.',
          'Yearly — billed once a year from your signup date, at a discount to the monthly price.'
        ]
      },
      {
        heading: 'Renewal',
        paragraphs: [
          'Subscriptions renew automatically at the end of each billing period unless you cancel before the renewal date. You will continue to have Plus access for the remainder of any period you have already paid for, even after cancelling.'
        ]
      },
      {
        heading: 'Cancellation',
        paragraphs: [
          'You can cancel anytime from Subscription → Manage subscription, which opens our billing provider\'s secure Customer Portal. Cancelling stops future renewals — it does not immediately end your current access, and no partial-period refund is issued automatically (see our Refund Policy).'
        ]
      },
      {
        heading: 'Payment processing',
        paragraphs: [
          `All payments are processed securely by Stripe. ${CONTACT_INFO.company} does not store your card details.`
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
          `If a renewal payment fails, Stripe may retry it automatically. If payment continues to fail, your subscription may be cancelled. Contact us at ${CONTACT_INFO.email} if you believe a payment failed in error.`
        ]
      }
    ]
  },

  'refund-policy': {
    title: 'Refund Policy',
    lastUpdated: LAST_UPDATED,
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
          `${CONTACT_INFO.product} offers guided breathing exercises, mindfulness exercises, affirmations, routines, habit tracking, and general wellness guidance, intended to support everyday wellbeing.`
        ]
      },
      {
        heading: `What ${CONTACT_INFO.product} does NOT provide`,
        list: [
          'Medical advice, diagnosis, or treatment of any kind.',
          'Psychiatric or psychological services.',
          'Emergency services.',
          'Crisis intervention.'
        ]
      },
      {
        heading: 'In an emergency',
        paragraphs: [
          `${CONTACT_INFO.product} is not equipped to help in a crisis. If you or someone else is in immediate danger, call your local emergency number (000 in Australia) right away. If you are struggling with your mental health, please reach out to a qualified professional or a crisis support service in your area — for example, Lifeline (13 11 14) in Australia.`
        ]
      },
      {
        heading: 'Talk to a professional',
        paragraphs: [
          `${CONTACT_INFO.product} is a self-guided wellbeing tool, not a substitute for professional medical or mental health care. Always consult a qualified healthcare provider for any medical or psychological concern, and before making changes to any treatment you are currently receiving.`
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
    isLegal: true,
    sections: [
      {
        paragraphs: [
          'You can request deletion of your account and personal data at any time.'
        ]
      },
      {
        heading: 'How to request deletion',
        paragraphs: [
          `In-app self-service account deletion is not yet available. Until it is, email us at ${CONTACT_INFO.email} from your account's email address to request deletion, and we will process it manually.`
        ]
      },
      {
        heading: 'What gets deleted',
        paragraphs: [
          'Your account, profile information, and wellness data (rhythm, intentions, journal entries, routine history) are permanently deleted from our active systems.'
        ]
      },
      {
        heading: 'What we may retain',
        paragraphs: [
          'We may retain billing records for the period required by law (see our Data Retention Policy) even after account deletion, as we are legally required to keep certain financial records.'
        ]
      },
      {
        heading: 'Timeframe',
        paragraphs: [
          'We aim to complete deletion requests within 30 days of confirming your identity.'
        ]
      }
    ]
  },

  'data-retention-policy': {
    title: 'Data Retention Policy',
    lastUpdated: LAST_UPDATED,
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
        heading: 'After account deletion',
        paragraphs: [
          'Once a deletion request is processed, your account and wellness data are permanently removed from our active systems (backups are cycled out over time as part of normal operations).'
        ]
      },
      {
        heading: 'Billing records',
        paragraphs: [
          `Financial and billing records associated with WakeWise Plus subscriptions are retained for as long as required by law — typically several years, to meet tax and accounting obligations in ${CONTACT_INFO.country}. These are managed by our payment processor, Stripe.`
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
          'For billing or subscription questions, you can also manage your subscription directly from Settings → WakeWise Plus → Manage subscription.'
        ]
      }
    ]
  }
};
