// WakeWise — authenticated, DEV-only nav link into the RevenueCat
// sandbox test surface. Source-level checks, same convention as
// Subscription.test.js's own established pattern (no DOM/component
// renderer available in this repo's Vitest - see that file's header for
// why).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Settings.jsx', import.meta.url)), 'utf-8');

const diagnosticsSectionBody = () =>
  source.match(/\{!isGuest && isSubscriptionSandboxTestVisible\(\) && \(\s*\n\s*<section[\s\S]*?<\/section>\s*\n\s*\)\}/)?.[0] ?? '';

describe('Settings.jsx — Subscription Sandbox Test nav link', () => {
  it('found the gated Diagnostics section', () => {
    expect(diagnosticsSectionBody()).not.toBe('');
  });

  it('imports isSubscriptionSandboxTestVisible from the shared featureFlags module - never its own re-typed copy of the literal env var', () => {
    expect(source).toMatch(/import \{ isBetaProgramVisible, isSubscriptionSandboxTestVisible \} from '\.\.\/lib\/featureFlags';/);
    expect(source).not.toMatch(/VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST/);
  });

  it('gated on both !isGuest (authenticated only) and the shared flag - neither alone', () => {
    const body = diagnosticsSectionBody();
    expect(body).toMatch(/^\{!isGuest && isSubscriptionSandboxTestVisible\(\) && \(/);
  });

  it('links to the exact route SubscriptionSandboxTest.jsx is registered at in App.jsx', () => {
    const body = diagnosticsSectionBody();
    expect(body).toMatch(/<Link to="\/dev\/subscription-sandbox-test" className=\{rowClass\}>/);
  });

  it('uses the same row styling/structure as every other Settings row (rowClass, chevron_right) - no new visual language', () => {
    const body = diagnosticsSectionBody();
    expect(body).toMatch(/className=\{rowClass\}/);
    expect(body).toMatch(/chevron_right/);
  });
});
