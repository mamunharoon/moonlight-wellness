// WakeWise Phase 2A — '/delete-account' (Google Play's public account-
// deletion resource) and its own '/settings/account-deletion-policy' link
// must both be reachable by a visitor with no session and no prior
// "Continue as Guest" choice — the normal case for a cold link from
// outside the app. Source-level check, same convention as this repo's
// other OnboardingGate tests (no DOM rendering available).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./OnboardingGate.jsx', import.meta.url)), 'utf-8');

const allowedPreEntryPathsBlock = () =>
  source.match(/const ALLOWED_PRE_ENTRY_PATHS = new Set\(\[[\s\S]*?\]\);/)?.[0] ?? '';

describe('OnboardingGate — public account-deletion resource is reachable pre-entry', () => {
  it('/delete-account is in ALLOWED_PRE_ENTRY_PATHS', () => {
    expect(allowedPreEntryPathsBlock()).toMatch(/'\/delete-account'/);
  });

  it('/settings/account-deletion-policy is in ALLOWED_PRE_ENTRY_PATHS, alongside the existing Privacy/Terms allowance', () => {
    const block = allowedPreEntryPathsBlock();
    expect(block).toMatch(/'\/settings\/account-deletion-policy'/);
    expect(block).toMatch(/'\/settings\/privacy-policy'/);
    expect(block).toMatch(/'\/settings\/terms-of-service'/);
  });

  it('every existing pre-entry path is preserved - this is an addition, not a replacement', () => {
    const block = allowedPreEntryPathsBlock();
    expect(block).toMatch(/'\/auth'/);
    expect(block).toMatch(/'\/reset-password'/);
  });
});
