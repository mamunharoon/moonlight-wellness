# WakeWise — Consent and Document-Versioning: Current State and Recommendation

## Current state (verified)

WakeWise does **not** currently record acceptance of the Privacy Policy
or Terms of Service anywhere — not a database row, not a checkbox, not
even a client-side flag. `Auth.jsx`'s sign-up form had no link to either
document before this task; it now shows "By creating an account, you
agree to our Terms of Service and Privacy Policy" with working links,
which is a *disclosure*, not a recorded *acceptance*.

Each legal document in `src/lib/legalContent.js` now carries a
`version` and `effectiveDate` (see `DOCUMENT_VERSIONS`), rendered on
every legal page alongside "Last updated" via `LegalLayout.jsx`. This is
the "keep document versions centrally defined" piece — it is not a
consent-recording mechanism, just a visible, single source of truth for
which version of each document is currently live.

## Recommended future model (not built; needs a migration when adopted)

A lightweight `legal_acceptances` table, one row per acceptance event:

```
document_type   text        -- 'privacy-policy' | 'terms-of-service' | ...
                              -- (matches legalContent.js's own slugs)
version          text        -- matches DOCUMENT_VERSIONS[document_type].version
                              -- at the moment of acceptance
effective_date   date
accepted_at      timestamptz
user_id          uuid references auth.users(id)
```

RLS: owner-insert and owner-read only (`auth.uid() = user_id`), no
update or delete policy — an acceptance record should be immutable once
written, the same way an audit log entry would be.

This lets a future flow answer "has this user accepted the *current*
version of the Terms" precisely, and re-prompt only the users who
haven't, rather than either silently assuming everyone has or forcing
a blanket re-acceptance on every user the moment any document changes.

## For this task specifically (per the approved scope)

- Added: visible "Last updated" and "Effective date" on every legal
  page, and centrally-defined versions (`DOCUMENT_VERSIONS`).
- Added: legal links reachable before commitment, at both sign-up
  (`Auth.jsx`) and checkout (`Subscription.jsx`).
- Confirmed: legal pages remain reachable while signed out — `/settings/:slug`
  sits in the same unauthenticated-accessible route tree as `/`, `/library`,
  etc. (no auth guard wraps it), verified live as a guest in this
  session's own testing.
- **Not built**: the `legal_acceptances` table above, or any migration
  for it — this task's scope explicitly limits schema changes to
  "propose separately, don't apply," and a consent-recording table is a
  bigger, more consequential piece of infrastructure than this batch's
  copy-and-disclosure work.
- **Not done**: forcing any existing user to re-accept anything. Bumping
  `DOCUMENT_VERSIONS` values in this task only changes what's displayed
  on the page itself — no code path anywhere checks a stored acceptance
  version against the current one, so there is nothing to force a
  re-accept even if there were.
