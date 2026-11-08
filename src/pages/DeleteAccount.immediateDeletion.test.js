// Immediate Account Deletion — DeleteAccount.jsx wiring. Source-level
// checks, same convention as deleteAccountBillingHonesty.test.js (no DOM
// rendering available in this repo's Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./DeleteAccount.jsx', import.meta.url)), 'utf-8');

const handleSubmitBody = () => source.match(/const handleSubmit = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
const confirmPhaseBody = () => source.match(/if \(phase === 'confirm' \|\| phase === 'submitting'\) \{[\s\S]*?\n {2}\}\n\n {2}if \(phase === 'done'\)/)?.[0] ?? '';
const donePhaseBody = () => source.match(/if \(phase === 'done'\) \{[\s\S]*?\n {2}\}\n\n {2}return null;/)?.[0] ?? '';
const pendingStatusBody = () => source.match(/if \(phase === 'status' && existingRequest\?\.status === 'pending'\) \{[\s\S]*?\n {2}\}\n\n {2}if \(phase === 'status' && existingRequest\?\.status === 'processing'\)/)?.[0] ?? '';
const processingStatusBody = () => source.match(/if \(phase === 'status' && existingRequest\?\.status === 'processing'\) \{[\s\S]*?\n {2}\}\n\n {2}if \(phase === 'explain'\)/)?.[0] ?? '';

describe('DeleteAccount.jsx — submission calls the immediate deletion endpoint, never the old request/wait one', () => {
  it('imports deleteAccountNow, never requestAccountDeletion, from accountDeletionApi.js', () => {
    expect(source).toMatch(/import \{\s*\n\s*cancelAccountDeletion,\s*\n\s*deleteAccountNow,/);
    expect(source).not.toMatch(/requestAccountDeletion/);
  });

  it('handleSubmit calls deleteAccountNow with the password and confirmation phrase', () => {
    const body = handleSubmitBody();
    expect(body).not.toBe('');
    expect(body).toMatch(/await deleteAccountNow\(\{ password, confirmationPhrase: confirmationInput \}\);/);
  });

  it('on success, signs out and disables the local morning reminder as best-effort cleanup (never blocking the done screen)', () => {
    const body = handleSubmitBody();
    expect(body).toMatch(/await disableMorningReminder\?\.\(\)\.catch\(\(\) => \{\}\);/);
    expect(body).toMatch(/await signOut\(\)\.catch\(\(\) => \{\}\);/);
    expect(body).toMatch(/setPhase\('done'\);/);
  });

  it('on failure, surfaces the real server message and does NOT clear the password - a retry from the same confirm screen must work without re-entering it', () => {
    const body = handleSubmitBody();
    const catchBlock = body.match(/\} catch \(e\) \{[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(catchBlock).not.toBe('');
    expect(catchBlock).not.toMatch(/setPassword\(''\)/);
    expect(catchBlock).toMatch(/setSubmitError\(e\?\.message \|\|/);
    expect(catchBlock).toMatch(/setPhase\('confirm'\);/);
  });

  it('destructures signOut from useAuth()', () => {
    expect(source).toMatch(/const \{ user, isGuest, signOut \} = useAuth\(\);/);
  });
});

describe('DeleteAccount.jsx — final confirmation states permanence and the provider-specific billing carve-out', () => {
  it('states the deletion is immediate and permanent, with role="alert" for assistive tech', () => {
    const body = confirmPhaseBody();
    expect(body).toMatch(/role="alert"/);
    expect(body).toMatch(/permanently deletes your WakeWise account and all of your personal data immediately/);
    expect(body).toMatch(/This cannot be\s*\n\s*undone\./);
  });

  it('explains that deleting WakeWise does not cancel an Apple or Google subscription, preserving the provider-specific guidance already shown earlier', () => {
    const body = confirmPhaseBody();
    expect(body).toMatch(/does not cancel a subscription billed through the Apple App Store or Google Play/);
    expect(body).toMatch(/cancel those directly with Apple or Google/);
  });

  it('the submit button reads "Permanently delete my account", never the old "Request account deletion"', () => {
    const body = confirmPhaseBody();
    expect(body).toMatch(/Permanently delete my account/);
    expect(body).not.toMatch(/Request account deletion/);
  });

  it('no user-visible "7 days"/cancellation-period copy survives in the explain or confirm phases - code comments may still reference the old model historically (see the status-phase tests below)', () => {
    const explainBody = source.match(/if \(phase === 'explain'\) \{[\s\S]*?\n {2}\}\n\n {2}if \(phase === 'billing'\)/)?.[0] ?? '';
    expect(explainBody).not.toBe('');
    expect(explainBody).not.toMatch(/7[\s-]*days?/i);
    expect(explainBody).not.toMatch(/cancellation period/i);
    const confirmBody = confirmPhaseBody();
    expect(confirmBody).not.toMatch(/7[\s-]*days?/i);
    expect(confirmBody).not.toMatch(/cancellation period/i);
  });
});

describe('DeleteAccount.jsx — Stripe billing copy still preserves the literal "cancelled at the end of your current billing period" fact, but no longer implies WakeWise access continues until then', () => {
  it('still states the Stripe subscription itself is cancelled at period end (accurate, unchanged Stripe-side behaviour)', () => {
    expect(source).toMatch(/it will be cancelled at the end of your current billing period/);
  });

  it('now explicitly corrects the false "you keep access until then" implication - the WakeWise account itself is deleted immediately', () => {
    expect(source).toMatch(/your WakeWise account itself is deleted immediately, right now/);
  });

  it('every other provider-specific management statement (Apple/Google/manual/unrecognised) is preserved byte-for-byte', () => {
    expect(source).toMatch(/billed through the App Store\. Deleting your WakeWise account does\s*\n\s*not cancel it/);
    expect(source).toMatch(/billed through Google Play\. Deleting your WakeWise account does\s*\n\s*not cancel it/);
    expect(source).toMatch(/isn't linked to Stripe, Apple, or Google billing/);
    expect(source).toMatch(/We couldn't confirm how your subscription is billed/);
    expect(source).toMatch(/Manage subscription in Stripe/);
  });
});

describe('DeleteAccount.jsx — the "done" screen never offers a destination that requires a now-nonexistent session', () => {
  it('found the done phase', () => {
    expect(donePhaseBody()).not.toBe('');
  });

  it('states the account is already permanently deleted', () => {
    const body = donePhaseBody();
    expect(body).toMatch(/permanently deleted/);
  });

  it('still carries the Apple/Google-subscription carve-out one more time, since the account is gone and this is the last screen the user sees', () => {
    const body = donePhaseBody();
    expect(body).toMatch(/Apple App Store or Google Play.*has not been cancelled/s);
  });

  it('never offers "Back to Account management" or any other authenticated destination - only navigate(\'/\')', () => {
    const body = donePhaseBody();
    expect(body).not.toMatch(/Back to Account management/);
    expect(body).toMatch(/onClick=\{\(\) => navigate\('\/'\)\}/);
  });

  it('no longer reads result.scheduledFor - that concept does not exist in the immediate model', () => {
    expect(source).not.toMatch(/result\?\.\s*scheduledFor|result\.scheduledFor/);
  });
});

describe('DeleteAccount.jsx — the status screen correctly branches on the two real unresolved-request shapes', () => {
  it('a legacy "pending" row keeps its own Cancel action AND gains a "delete now instead" action - both act on the same row (server-side, see accountDeletion.ts)', () => {
    const body = pendingStatusBody();
    expect(body).not.toBe('');
    expect(body).toMatch(/onClick=\{handleCancelRequest\}/);
    expect(body).toMatch(/Cancel deletion request — keep my account/);
    expect(body).toMatch(/onClick=\{startOrResumeImmediateDeletion\}/);
    expect(body).toMatch(/Delete my account now instead/);
  });

  it('a "processing" row (a prior attempt that died partway) offers only Resume, never Cancel - the deletion is already underway, not a request waiting to be withdrawn', () => {
    const body = processingStatusBody();
    expect(body).not.toBe('');
    expect(body).toMatch(/onClick=\{startOrResumeImmediateDeletion\}/);
    expect(body).toMatch(/Finish deleting my account/);
    expect(body).not.toMatch(/handleCancelRequest/);
  });

  it('the loading effect routes BOTH \'pending\' and \'processing\' to the status phase - neither is silently dropped', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!user \|\| isGuest\) return;[\s\S]*?\n {2}\}, \[user\?\.id\]\);/)?.[0] ?? '';
    expect(effectBody).toMatch(/request\?\.status === 'pending' \|\| request\?\.status === 'processing'/);
  });
});
