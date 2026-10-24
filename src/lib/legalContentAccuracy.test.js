// WakeWise Phase 2B — privacy/deletion policy accuracy correction. Real
// execution against the actual exported content, not source regex — this
// content is data, not component logic, so asserting on its real,
// resolved strings is both possible and more meaningful than a regex.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEGAL_CONTENT, DOCUMENT_VERSIONS } from './legalContent';

const flattenText = (entry) =>
  entry.sections
    .flatMap((section) => [section.heading ?? '', ...(section.paragraphs ?? []), ...(section.list ?? [])])
    .join('\n');

describe('Privacy Policy — no longer overstates "completed today" as local-only', () => {
  const text = flattenText(LEGAL_CONTENT['privacy-policy']);

  it('never claims we do not receive/store completion indicators generally - only the one genuinely local, cosmetic checkmark', () => {
    expect(text).not.toMatch(/we do not receive or store these on our servers/);
  });

  it('discloses a real, server-stored practice-completion history and Momentum totals', () => {
    expect(text).toMatch(/completed practice sessions/i);
    expect(text).toMatch(/Momentum totals/);
  });

  it('still accurately describes the separate, genuinely local-only Home-screen checkmark, so that true fact is not lost in the correction', () => {
    expect(text).toMatch(/completed today.*checkmark/i);
    expect(text).toMatch(/kept only in local storage on your device/);
  });

  it('discloses RevenueCat as the mobile subscription-management/verification processor', () => {
    expect(text).toMatch(/RevenueCat/);
  });

  it('discloses subscription billing provider (Stripe/Apple/Google) and provider-issued transaction identifiers', () => {
    expect(text).toMatch(/billing provider/i);
    expect(text).toMatch(/Stripe, Apple, or Google/);
  });
});

describe('Account Deletion Policy — "what gets deleted" now includes completion/Momentum records', () => {
  it('mentions practice-completion history and Momentum records, not just rhythm/intentions/journal/subscription', () => {
    const text = flattenText(LEGAL_CONTENT['account-deletion-policy']);
    expect(text).toMatch(/practice-completion history/);
    expect(text).toMatch(/Momentum totals/);
  });
});

describe('Terms of Service — no longer implies a planned/pending legal review specific to individual clauses', () => {
  const text = flattenText(LEGAL_CONTENT['terms-of-service']);

  it('removed the two inaccurate "requires legal review/confirmation before this is treated as final" annotations', () => {
    expect(text).not.toMatch(/requires qualified legal review/i);
    expect(text).not.toMatch(/requires legal confirmation/i);
    expect(text).not.toMatch(/treated as final/i);
  });

  it('the substantive liability and governing-law clauses themselves are preserved, not removed', () => {
    expect(text).toMatch(/provided "as is" without warranties of any kind/);
    expect(text).toMatch(/not liable for any indirect or consequential loss/);
    expect(text).toMatch(/Nothing in these terms excludes any guarantee, right, or remedy you have under the Australian Consumer Law/);
    expect(text).toMatch(/These terms are governed by the laws of/);
  });

  it('does not replace the removed annotations with any claim of legal approval or compliance', () => {
    expect(text).not.toMatch(/legally approved|compliant|lawyer-approved|legal(ly)? compliant/i);
  });

});

describe('LegalLayout — the global "Draft — not yet reviewed by a lawyer" banner is removed (24-Oct-2026, owner-approved), everywhere it used to render', () => {
  const layoutSource = readFileSync(fileURLToPath(new URL('../components/LegalLayout.jsx', import.meta.url)), 'utf-8');
  // Only the actual rendered JSX (the return statement), never the
  // surrounding comments - this file's own header comment legitimately
  // quotes the removed banner's old text as history, which must not
  // make this check about the real markup false-positive.
  const renderBody = layoutSource.slice(layoutSource.indexOf('return ('), layoutSource.lastIndexOf('};'));

  it('the banner JSX itself is gone from the one shared render point every isLegal page uses', () => {
    expect(renderBody).not.toMatch(/Draft — not yet reviewed by a lawyer/);
    expect(renderBody).not.toMatch(/text-amber-400/);
  });

  it('nothing was put in its place implying legal approval, review, or compliance', () => {
    expect(renderBody).not.toMatch(/legally approved|reviewed by (our|a) lawyer|legal(ly)? compliant|approved by (our )?legal/i);
  });

  it('the contact footer (every other user-facing legal detail) is still rendered for isLegal pages', () => {
    expect(layoutSource).toMatch(/Questions about this page\? Contact \{CONTACT_INFO\.company\} at/);
    expect(layoutSource).toMatch(/\{isLegal && \(/);
  });

  it('every one of the seven isLegal pages still has its contact email available (contact details preserved)', () => {
    const contactText = flattenText(LEGAL_CONTENT['contact-us']);
    expect(contactText).toMatch(/info@zavaraai\.com/);
    for (const slug of ['privacy-policy', 'terms-of-service', 'subscription-terms', 'refund-policy', 'medical-disclaimer', 'account-deletion-policy', 'data-retention-policy']) {
      expect(LEGAL_CONTENT[slug].isLegal).toBe(true);
    }
  });
});

describe('Refund Policy — Apple/Google IAP refunds now addressed, not just the Stripe path', () => {
  const text = flattenText(LEGAL_CONTENT['refund-policy']);

  it('still describes the Stripe refund path (unchanged)', () => {
    expect(text).toMatch(/issued back to your original payment method via Stripe/);
  });

  it('now also directs an Apple/Google-billed subscriber to Apple/Google directly, not to WakeWise', () => {
    expect(text).toMatch(/cannot process or issue a refund directly/i);
    expect(text).toMatch(/Apple App Store or Google Play/);
  });

  it('document version was bumped (additive change, matching this project\'s own versioning convention)', () => {
    expect(DOCUMENT_VERSIONS['refund-policy'].version).toBe('1.1');
    expect(DOCUMENT_VERSIONS['refund-policy'].effectiveDate).toBe('October 2026');
  });
});
