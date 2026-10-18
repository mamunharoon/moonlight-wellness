// Immediate Account Deletion — legal-content accuracy. Real execution
// against the actual exported content, same convention and helper as
// legalContentAccuracy.test.js.
import { describe, it, expect } from 'vitest';
import { LEGAL_CONTENT, DOCUMENT_VERSIONS } from './legalContent';

const flattenText = (entry) =>
  entry.sections
    .flatMap((section) => [section.heading ?? '', ...(section.paragraphs ?? []), ...(section.list ?? [])])
    .join('\n');

describe('Account Deletion Policy — no longer describes a 7-day cancellable waiting period', () => {
  const text = flattenText(LEGAL_CONTENT['account-deletion-policy']);

  it('states deletion is immediate, not a waiting period', () => {
    expect(text).toMatch(/Deletion is immediate, not a waiting period/);
    expect(text).toMatch(/deletes your account right away/);
  });

  it('never claims a 7-day/30-day timeline or a manual operator process that no longer reflects reality', () => {
    expect(text).not.toMatch(/7-day/);
    expect(text).not.toMatch(/30 days/);
    expect(text).not.toMatch(/manual, documented process carried out by our team/);
  });

  it('explicitly tells Apple/Google subscribers their store subscription is NOT cancelled by this and must be cancelled directly with the store', () => {
    expect(text).toMatch(/does NOT cancel a subscription billed through the Apple App Store or Google Play/);
    expect(text).toMatch(/cancel those directly with Apple or Google yourself/);
  });

  it('still describes the Stripe-billed case accurately: cancelled as part of the same request, no refund for the current period', () => {
    expect(text).toMatch(/billed through our own checkout \(Stripe\).*cancelled as part of the same deletion request/s);
    expect(text).toMatch(/no refund for that period/);
  });
});

describe('Privacy Policy / Terms of Service — deletion sections match the immediate model', () => {
  it('Privacy Policy no longer promises a 7-day cancellable period or a 30-day manual completion target', () => {
    const text = flattenText(LEGAL_CONTENT['privacy-policy']);
    expect(text).not.toMatch(/7-day period/);
    expect(text).not.toMatch(/30 days/);
    expect(text).toMatch(/permanently deleted right away/);
  });

  it('Terms of Service — Account deletion section states immediacy and the Apple/Google carve-out', () => {
    const text = flattenText(LEGAL_CONTENT['terms-of-service']);
    expect(text).toMatch(/Deletion is immediate and permanent once you confirm/);
    expect(text).toMatch(/billed through the App Store or Google Play should be cancelled separately with Apple or Google/);
  });
});

describe('Data Retention Policy — deletion-requests section reflects immediate deletion, while honestly covering any leftover pre-existing request', () => {
  const text = flattenText(LEGAL_CONTENT['data-retention-policy']);

  it('states deletion is now immediate', () => {
    expect(text).toMatch(/Deletion is now immediate/);
  });

  it('does not silently discard the possibility of an older, pre-existing cancellable request still outstanding', () => {
    expect(text).toMatch(/pre-existing request made under a prior, now-retired 7-day cancellable model/);
    expect(text).toMatch(/remains cancellable/);
  });
});

describe('Document versions — every materially-changed document was bumped, every untouched one was not', () => {
  it('account-deletion-policy, privacy-policy, terms-of-service, and data-retention-policy all carry a version newer than their pre-change baseline', () => {
    expect(DOCUMENT_VERSIONS['account-deletion-policy'].version).toBe('3.0');
    expect(DOCUMENT_VERSIONS['privacy-policy'].version).toBe('1.2');
    expect(DOCUMENT_VERSIONS['terms-of-service'].version).toBe('1.2');
    expect(DOCUMENT_VERSIONS['data-retention-policy'].version).toBe('1.2');
  });

  it('documents this change never touched (subscription-terms, refund-policy, medical-disclaimer) kept their exact prior version', () => {
    expect(DOCUMENT_VERSIONS['subscription-terms'].version).toBe('1.1');
    expect(DOCUMENT_VERSIONS['refund-policy'].version).toBe('1.0');
    expect(DOCUMENT_VERSIONS['medical-disclaimer'].version).toBe('1.1');
  });
});
