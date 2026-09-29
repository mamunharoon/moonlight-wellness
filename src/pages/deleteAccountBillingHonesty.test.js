// WakeWise Phase 2A — account-deletion billing-provider honesty. Source-
// level checks, same convention as this repo's other page tests (no DOM
// rendering available).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./DeleteAccount.jsx', import.meta.url)), 'utf-8');

const billingPhaseBlock = () => source.match(/if \(phase === 'billing'\) \{[\s\S]*?\n {2}\}\n\n {2}if \(phase === 'reauth'\)/)?.[0] ?? '';

describe('DeleteAccount.jsx — billing honesty distinguishes every real provider', () => {
  it('Stripe copy is unchanged: cancels at period end, Manage subscription in Stripe button', () => {
    const block = billingPhaseBlock();
    expect(block).toMatch(/billing\.provider === 'stripe'/);
    expect(block).toMatch(/it will be cancelled at the end of your current billing period/);
    expect(block).toMatch(/Manage subscription in Stripe/);
  });

  it('Apple subscribers are told their App Store subscription is NOT cancelled by deleting WakeWise, and must cancel it themselves', () => {
    const block = billingPhaseBlock();
    expect(block).toMatch(/billing\.provider === 'apple'/);
    expect(block).toMatch(/billed through the App Store/);
    // \s+ tolerates the JSX line-wrap between "does" and "not cancel it".
    expect(block).toMatch(/does\s+not cancel it/);
    expect(block).toMatch(/Settings → \[your name\] → Subscriptions/);
  });

  it('Google Play subscribers are told their subscription is NOT cancelled by deleting WakeWise, and must cancel it themselves', () => {
    const block = billingPhaseBlock();
    expect(block).toMatch(/billing\.provider === 'google'/);
    expect(block).toMatch(/billed through Google Play/);
    // \s+ tolerates the JSX line-wrap between "Google" and "Play app...".
    expect(block).toMatch(/Google\s+Play app under Subscriptions/);
  });

  it('manually-granted access keeps its own honest copy, now explicitly scoped to provider === "manual" rather than "anything not stripe"', () => {
    const block = billingPhaseBlock();
    expect(block).toMatch(/billing\.provider === 'manual'/);
    expect(block).toMatch(/isn't linked to Stripe, Apple, or Google billing/);
  });

  it('an unrecognised provider value gets a safe general warning, never assumed to be manual/no-op', () => {
    const block = billingPhaseBlock();
    expect(block).toMatch(/!\['stripe', 'apple', 'google', 'manual'\]\.includes\(billing\.provider\)/);
    expect(block).toMatch(/We couldn't confirm how your subscription is billed/);
  });

  it('never infers the provider from platform alone - every branch reads billing.provider, the trusted server-read subscription value, never Capacitor.getPlatform()/isIOS()/isAndroid()', () => {
    const block = billingPhaseBlock();
    expect(block).not.toMatch(/getPlatform\(\)|isIOS\(\)|isAndroid\(\)/);
  });
});
