// WakeWise Phase 2B — privacy/deletion policy accuracy correction. Real
// execution against the actual exported content, not source regex — this
// content is data, not component logic, so asserting on its real,
// resolved strings is both possible and more meaningful than a regex.
import { describe, it, expect } from 'vitest';
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
