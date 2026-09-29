// WakeWise Phase 2A — minimum launch-ready Profile. Source-level checks,
// same convention as this repo's other page tests (no DOM rendering
// available — see profileSignOutHardening.test.js's own note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./Profile.jsx');
// Matches confirmDialogSeverity.test.js's own convention: a doc comment
// may reasonably name a removed tag/prop while explaining the removal -
// only actual code should be checked for its absence.
const stripComments = (code) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const codeOnly = stripComments(source);

describe('Profile.jsx — the four required grouped sections are present, in order', () => {
  it('Account, Preferences, Membership, Privacy and support all appear as section headings, in this order', () => {
    const headings = ['Account', 'Preferences', 'Membership', 'Privacy and support'];
    let cursor = -1;
    for (const heading of headings) {
      const idx = source.indexOf(`>${heading}</h3>`, cursor + 1);
      expect(idx).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it('Account group offers Change Password and Sign out', () => {
    expect(source).toMatch(/<Link to="\/change-password" className=\{rowClass\}>/);
    expect(source).toMatch(/Change Password/);
    expect(source).toMatch(/onClick=\{\(\) => setConfirmSignOut\(true\)\}/);
  });

  it('Preferences group offers Timezone, Wake time, Bedtime, and Reminder preferences with the required device-only disclosure directly beneath it', () => {
    expect(source).toMatch(/<Link to="\/settings\/timezone" className=\{rowClass\}>/);
    expect(source).toMatch(/<Link to="\/onboarding" className=\{rowClass\}>/);
    expect(source).toMatch(/<Link to="\/settings\/notifications"/);
    expect(source).toMatch(/Reminder settings are saved on this device\./);
  });

  it('the device-only disclosure sits immediately after the Reminder preferences row, not detached elsewhere on the page', () => {
    const notifIdx = source.indexOf('Reminder preferences');
    const discloureIdx = source.indexOf('Reminder settings are saved on this device.');
    expect(discloureIdx).toBeGreaterThan(notifIdx);
    expect(discloureIdx - notifIdx).toBeLessThan(400);
  });

  it('Membership group shows a status row, Manage Subscription, and (conditionally) Restore Purchases', () => {
    expect(source).toMatch(/Membership\s*<\/span>/);
    expect(source).toMatch(/\{membershipStatusLabel\}/);
    expect(source).toMatch(/<Link to="\/subscription" className=\{rowClass\}>/);
    expect(source).toMatch(/Manage Subscription/);
  });

  it('Privacy and support group offers Privacy Policy, Terms of Service, Download a copy of my data, and Delete Account', () => {
    expect(source).toMatch(/<Link to="\/settings\/privacy-policy" className=\{rowClass\}>/);
    expect(source).toMatch(/<Link to="\/settings\/terms-of-service" className=\{rowClass\}>/);
    expect(source).toMatch(/Terms of Service/);
    expect(source).toMatch(/Download a copy of my data/);
    expect(source).toMatch(/<Link to="\/profile\/delete-account" className=\{rowClass\}>/);
    expect(source).toMatch(/Delete Account/);
  });
});

describe('Profile.jsx — Data Export restored (Phase 2A correction)', () => {
  it('reuses the extracted DataExportDialog rather than a second copy of its wording/logic', () => {
    expect(source).toMatch(/import \{ DataExportDialog \} from '\.\.\/components\/DataExportDialog';/);
    expect(source).toMatch(/<DataExportDialog open=\{exportDialogOpen\} onDismiss=\{\(\) => setExportDialogOpen\(false\)\}\s*\/>/);
    // No re-authored export wording of its own anywhere in Profile.jsx.
    expect(source).not.toMatch(/Automated data export isn't available/);
  });

  it('the row opens the dialog and is not shown to guests (the feature requires a real account to export)', () => {
    expect(source).toMatch(/onClick=\{\(\) => setExportDialogOpen\(true\)\}/);
    const rowIdx = source.indexOf('Download a copy of my data');
    const sectionIdx = source.lastIndexOf('<section', rowIdx);
    const guardIdx = source.lastIndexOf('{!isGuest && (', rowIdx);
    // The nearest guest guard before this row must open AFTER the
    // enclosing section starts (i.e. it guards this specific row/button,
    // not merely something earlier in an unrelated section).
    expect(guardIdx).toBeGreaterThan(sectionIdx);
  });
});

describe('Profile.jsx — no fabricated membership status', () => {
  it('reads status from the trusted useSubscription() context, via the pure getMembershipStatusLabel helper — never a hardcoded/guessed label', () => {
    expect(source).toMatch(/import \{ useSubscription \} from '\.\.\/context\/SubscriptionContext';/);
    expect(source).toMatch(/import \{ getMembershipStatusLabel \} from '\.\.\/lib\/membershipStatus';/);
    expect(source).toMatch(
      /const membershipStatusLabel = getMembershipStatusLabel\(subscription, \{\s*\n\s*loading: subscriptionLoading,\s*\n\s*error: subscriptionError\s*\n\s*\}\);/
    );
  });

  it('never reads plan/status from localStorage/sessionStorage directly', () => {
    expect(source).not.toMatch(/localStorage\.getItem\(.*plan/i);
    expect(source).not.toMatch(/sessionStorage\.getItem\(.*plan/i);
  });
});

describe('Profile.jsx — dead avatar treatment removed', () => {
  it('never renders profile.avatar_url as an <img> - no upload path exists anywhere in this codebase for it', () => {
    // The doc comment above is allowed to name avatar_url historically
    // (explaining what was removed and why) - what must never exist is a
    // live reference to it, or an <img> tag rendering it.
    expect(codeOnly).not.toMatch(/profile\?\.avatar_url/);
    expect(codeOnly).not.toMatch(/\{profile\.avatar_url/);
    expect(codeOnly).not.toMatch(/<img/);
  });

  it('still shows a plain icon avatar for both guest and registered users', () => {
    expect(source).toMatch(/\{isGuest \? 'person' : 'account_circle'\}/);
  });
});

describe('Profile.jsx — Restore Purchases: reuse, guest gating, honest platform scoping', () => {
  it('reuses the shared useAppleRestore hook rather than a second, divergent implementation', () => {
    expect(source).toMatch(/import \{ useAppleRestore, NEUTRAL_RESTORE_COMPLETION_MESSAGE \} from '\.\.\/hooks\/useAppleRestore';/);
    expect(source).toMatch(/const \{ state: restoreState, error: restoreError, restore \} = useAppleRestore\(\);/);
  });

  it('the row only renders when isAppleIAPSupported() is true - never shown on web/Android, and never silently routed to Stripe', () => {
    expect(source).toMatch(/import \{ isAppleIAPSupported \} from '\.\.\/lib\/applePurchaseAdapter';/);
    expect(source).toMatch(/const restoreSupported = isAppleIAPSupported\(\);/);
    expect(source).toMatch(/\{restoreSupported && \(/);
    expect(source).not.toMatch(/startCheckout|openBillingPortal/);
  });

  it('a guest tapping Restore Purchases is prompted to sign in, never allowed to restore anonymously', () => {
    const tapHandler = source.match(/const handleRestoreTap = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(tapHandler).toMatch(/if \(isGuest\) \{/);
    expect(tapHandler).toMatch(/setRestoreSignInPrompt\(true\);/);
    expect(tapHandler).toMatch(/return;/);
    expect(tapHandler).toMatch(/restore\(\);/);
  });

  it('the restore button is disabled while restoring, preventing a duplicate tap', () => {
    expect(source).toMatch(/disabled=\{restoreState === 'restoring'\}/);
  });

  it('every restore UI state (restoring/restored/completed/failed) has a distinct message, and the failed state shows the hook\'s own error text, never a guessed one', () => {
    expect(source).toMatch(/restoring: \{ role: 'status', text: 'Restoring…' \}/);
    expect(source).toMatch(/restored: \{ role: 'status', text: 'Restore complete/);
    expect(source).toMatch(/completed: \{ role: 'status', text: NEUTRAL_RESTORE_COMPLETION_MESSAGE \}/);
    expect(source).toMatch(/failed: \{ role: 'alert', text: null \}/);
    expect(source).toMatch(/\{restoreMessage\.text \?\? restoreError\}/);
  });

  it('the Phase 2A "nothing to restore" timeout inference is fully withdrawn from Profile.jsx\'s actual code', () => {
    expect(codeOnly).not.toMatch(/nothing-to-restore/);
    expect(codeOnly).not.toMatch(/No previous purchases were found to restore/);
  });

  it('imports the neutral completion message from the hook rather than re-authoring it here', () => {
    expect(source).toMatch(
      /import \{ useAppleRestore, NEUTRAL_RESTORE_COMPLETION_MESSAGE \} from '\.\.\/hooks\/useAppleRestore';/
    );
  });
});

describe('Profile.jsx — Manage Subscription reuses the existing platform-aware screen', () => {
  it('links to /subscription rather than re-implementing Stripe/Apple/Google branching here', () => {
    expect(source).toMatch(/<Link to="\/subscription" className=\{rowClass\}>/);
    expect(source).not.toMatch(/openAppleManageSubscriptions|openBillingPortal/);
  });
});

describe('Profile.jsx — sign-out is unchanged and still the one shared operation', () => {
  it('still calls the shared signOut() from AuthContext, with the same hardened retry/error handling as before', () => {
    expect(source).toMatch(/const \{ user, isGuest, signOut, profile, profileLoading, profileError \} = useAuth\(\);/);
    expect(source).toMatch(/await signOut\(\);/);
  });
});
