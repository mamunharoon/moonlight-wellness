// WakeWise Phase 1 correction — Feedback.jsx used to fire window.location.href
// (a mailto: link), immediately claim "Thank you for your feedback" /
// "We read every submission", and log `feedback_submitted` - none of which
// this app can actually know, since a mailto: navigation gives no
// success/failure signal for whether a mail app opened, let alone whether
// the user went on to send it. Source-level regression guard (no DOM
// rendering is available in this repo's Vitest - see
// backCloseConsistency.test.js's own established pattern for this file).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Feedback.jsx', import.meta.url)), 'utf-8');
const catalogueSource = readFileSync(fileURLToPath(new URL('../lib/analyticsEvents.js', import.meta.url)), 'utf-8');

describe('Feedback.jsx — never claims a submission that only ever opened a mail app', () => {
  it('never claims the feedback was "submitted", "sent", or that it was "received" - only that the mail app should be open', () => {
    expect(source).not.toMatch(/Thank you for your feedback/);
    expect(source).not.toMatch(/We read every submission/);
    expect(source).toMatch(/Your email app should now be open\. Please review and send the message from there/);
  });

  it('renamed the confirmation state from `submitted` to `mailtoLaunched` - what actually, verifiably happened', () => {
    expect(source).toMatch(/const \[mailtoLaunched, setMailtoLaunched\] = useState\(false\);/);
    expect(source).not.toMatch(/\[submitted, setSubmitted\]/);
  });

  it('logs the truthful `feedback_email_opened` event, never `feedback_submitted`', () => {
    expect(source).toMatch(/trackEvent\('feedback_email_opened', \{ category \}\);/);
    expect(source).not.toMatch(/feedback_submitted/);
  });

  it('the analytics catalogue itself was renamed, with a description that says a mail app launch is all that is confirmed', () => {
    expect(catalogueSource).toMatch(/feedback_email_opened: \{/);
    expect(catalogueSource).not.toMatch(/\bfeedback_submitted: \{/);
    expect(catalogueSource).toMatch(/Does not confirm the email was actually sent\./);
  });

  it('provides a visible fallback (support email + a real, keyboard-operable copy button) whenever no mail handler opens - shown unconditionally, since a mailto: navigation gives no success/failure signal to gate it on', () => {
    expect(source).toMatch(/Nothing open, or the wrong app launched\? Email us directly:/);
    expect(source).toMatch(/\{CONTACT_INFO\.email\}<\/span>/);
    const copyButtonBlock = source.match(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{handleCopyEmail\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(copyButtonBlock).not.toBe('');
    expect(copyButtonBlock).toMatch(/min-h-\[44px\]/);
    expect(copyButtonBlock).toMatch(/focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('the copy handler uses the clipboard API defensively (try/catch) - the address stays visible as selectable text either way', () => {
    expect(source).toMatch(/await navigator\.clipboard\.writeText\(CONTACT_INFO\.email\);/);
    expect(source).toMatch(/select-all/);
  });

  it('does not add a backend endpoint - delivery is still a plain mailto: link', () => {
    expect(source).toMatch(/window\.location\.href = mailtoUrl;/);
    expect(source).toMatch(/mailto:\$\{CONTACT_INFO\.email\}/);
  });

  it('repeated submissions remain possible - "Send another" resets mailtoLaunched so the form can be used again', () => {
    expect(source).toMatch(/onClick=\{\(\) => setMailtoLaunched\(false\)\}/);
  });
});
