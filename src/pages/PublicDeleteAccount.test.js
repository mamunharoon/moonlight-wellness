// WakeWise Phase 2A — public, unauthenticated account-deletion resource.
// Source-level checks, same convention as this repo's other page tests (no
// DOM rendering available).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./PublicDeleteAccount.jsx', import.meta.url)), 'utf-8');
const appSource = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf-8');
// A doc comment may reasonably discuss what this page deliberately never
// does (e.g. "never implies whether an account exists") while explaining
// the design - only the actual rendered copy should be checked for it.
const stripComments = (code) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const codeOnly = stripComments(source);

describe('PublicDeleteAccount — reachable without authentication', () => {
  it('is registered as a top-level route outside <Layout>, same placement as /auth', () => {
    expect(appSource).toMatch(/<Route path="delete-account" element=\{withFallback\(<PublicDeleteAccount \/>\)\} \/>/);
  });

  it('performs no destructive action and accepts no user id/email as a route param or query string', () => {
    expect(source).not.toMatch(/useParams|useSearchParams/);
    expect(source).not.toMatch(/requestAccountDeletion|cancelAccountDeletion/);
    expect(source).not.toMatch(/supabase\.functions\.invoke/);
  });

  it('identifies WakeWise and ZavaraAI clearly, sourced from the one real CONTACT_INFO constant, never a duplicated/hardcoded copy', () => {
    expect(source).toMatch(/import \{ CONTACT_INFO \} from '\.\.\/lib\/legalContent';/);
    expect(source).toMatch(/\{CONTACT_INFO\.product\}/);
    expect(source).toMatch(/\{CONTACT_INFO\.company\}/);
  });

  it('states plainly that deleting WakeWise does not automatically cancel an Apple or Google Play subscription', () => {
    expect(source).toMatch(/does not automatically cancel a subscription billed through/);
    expect(source).toMatch(/Apple App Store or Google Play/);
  });

  it('discloses the 7-day cancellable waiting period, matching the real in-app flow rather than promising instant deletion', () => {
    expect(source).toMatch(/7-day period/);
    expect(source).toMatch(/cancel the request and keep your account/);
  });
});

describe('PublicDeleteAccount — sign-in vs. signed-in continuation, no account enumeration', () => {
  it('a signed-out (guest) visitor is offered Sign In only - never a form, never an email/id field', () => {
    const guestBranch = source.match(/\{isGuest \? \([\s\S]*?\) : \(/)?.[0] ?? '';
    expect(guestBranch).toMatch(/Sign in to request deletion/);
    expect(guestBranch).toMatch(/navigate\('\/auth'\)/);
    expect(guestBranch).not.toMatch(/<input/);
  });

  it('a signed-in visitor continues straight into the existing protected deletion flow, never a second/duplicate deletion implementation', () => {
    expect(source).toMatch(/navigate\('\/profile\/delete-account'\)/);
    expect(source).toMatch(/Continue to request deletion/);
  });

  it('never checks or branches on whether a specific email/account exists - isGuest is the only condition read', () => {
    expect(source).not.toMatch(/\.email ===|existingAccount|isExistingUser|accountExists/i);
  });
});

describe('PublicDeleteAccount — Privacy/Terms links, real documents only', () => {
  it('links to the existing real Privacy Policy and Terms of Service routes, not duplicated text', () => {
    expect(source).toMatch(/to="\/settings\/privacy-policy"/);
    expect(source).toMatch(/to="\/settings\/terms-of-service"/);
    expect(source).toMatch(/to="\/settings\/account-deletion-policy"/);
  });

  it('provides a real, tappable contact fallback for someone who cannot sign in, reusing the one existing official support address', () => {
    expect(source).toMatch(/Can't sign in\?/);
    expect(source).toMatch(/href=\{`mailto:\$\{CONTACT_INFO\.email\}`\}/);
    expect(source).toMatch(/>\{CONTACT_INFO\.email\}<\/a>/);
  });

  it('never treats an emailed request as sufficient proof to delete anything, and never implies whether an account exists - it only ever offers to "assist" via human support, same as the existing account-deletion-policy document', () => {
    expect(codeOnly).not.toMatch(/<input/);
    expect(codeOnly).not.toMatch(/we will delete|deletion confirmed|account (exists|found|not found)/i);
    expect(source).toMatch(/we'll assist/);
  });
});
