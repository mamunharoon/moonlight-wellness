// WakeWise Phase 2A — source-level regression guard for useAppleRestore.js,
// matching this repo's established convention for React hooks (no DOM/
// renderer available in this Vitest environment — see
// useMomentumCompletion.test.js's own identical note). The real
// verification/refresh logic this hook calls through to
// (verifyAppleTransaction, refreshSubscription, isSubscribed) already has
// its own real-execution coverage where it's a plain function; this file
// proves the hook's own wiring, gating, and state transitions are correct.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./useAppleRestore.js', import.meta.url)), 'utf-8');
// The header doc comment is allowed to explain what was removed and why
// (naming "nothing-to-restore" historically) - only actual code should be
// checked for its absence.
const stripComments = (code) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const codeOnly = stripComments(source);

describe('useAppleRestore — platform gating', () => {
  it('does nothing on a platform without Apple IAP support (web, Android) - restore() is a no-op and the transaction listener is never mounted', () => {
    expect(source).toMatch(/if \(!isAppleIAPSupported\(\)\) return undefined;/);
    expect(source).toMatch(/if \(!isAppleIAPSupported\(\) \|\| state === 'restoring'\) return;/);
  });

  it('exposes its own supported flag so a caller can hide the row entirely rather than show a non-functional control', () => {
    expect(source).toMatch(/supported: isAppleIAPSupported\(\)/);
  });
});

describe('useAppleRestore — duplicate-tap protection', () => {
  it('a second restore() call while already restoring is ignored, not queued or restarted', () => {
    const restoreBody = source.match(/const restore = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(restoreBody).toMatch(/state === 'restoring'\) return;/);
  });
});

describe('useAppleRestore — the 4-second "nothing to restore" timeout is fully removed', () => {
  it('no timeout, timer ref, or received-transaction ref survives anywhere in this file\'s actual code - a timeout cannot truthfully distinguish "no purchase" from "verification is slow"', () => {
    expect(codeOnly).not.toMatch(/setTimeout/);
    expect(codeOnly).not.toMatch(/clearTimeout/);
    expect(codeOnly).not.toMatch(/timeoutRef/);
    expect(codeOnly).not.toMatch(/receivedTransactionRef/);
    expect(codeOnly).not.toMatch(/NOTHING_TO_RESTORE/i);
    expect(codeOnly).not.toMatch(/nothing-to-restore/);
    expect(source).not.toMatch(/export const NOTHING_TO_RESTORE/);
  });

  it('exports the exact neutral completion message required by the Phase 2A correction, as a named constant (not inlined at each call site)', () => {
    expect(source).toMatch(
      /export const NEUTRAL_RESTORE_COMPLETION_MESSAGE =\s*\n\s*'Restore request completed\. If you have an eligible purchase, your membership will update shortly\.';/
    );
  });
});

describe('useAppleRestore — only three real outcomes: restoring, restored, failed; otherwise the honest neutral completion', () => {
  it('a failed native restore call sets "failed" with the platform\'s own message, never a guessed one', () => {
    const restoreBody = source.match(/const restore = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(restoreBody).toMatch(/if \(result\.outcome !== 'restored'\) \{/);
    expect(restoreBody).toMatch(/setState\('failed'\);/);
    expect(restoreBody).toMatch(/setError\(result\.message \|\| "We couldn't restore purchases\. Please try again\."\);/);
  });

  it('a successful native restore call, with no confirmed entitlement (yet), settles on the neutral "completed" state - never "restored", never "nothing to restore"', () => {
    const restoreBody = source.match(/const restore = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(restoreBody).toMatch(/setState\(\(current\) => \(current === 'restored' \? current : 'completed'\)\);/);
  });

  it('"restored" is set ONLY inside the transaction listener, and ONLY after BOTH server verification and a fresh isSubscribed() check on the just-refreshed subscription - never from the mere presence of a transaction event', () => {
    const listenerBody = source.match(/addAppleTransactionUpdateListener\(async \(result\) => \{[\s\S]*?\n {4}\}\);/)?.[0] ?? '';
    expect(listenerBody).not.toBe('');
    const verifyIdx = listenerBody.indexOf('await verifyAppleTransaction(');
    const refreshIdx = listenerBody.indexOf('const refreshed = await refreshSubscription();');
    const checkIdx = listenerBody.indexOf('isSubscribed(refreshed?.plan, refreshed?.status)');
    const restoredIdx = listenerBody.indexOf("setState('restored');");
    expect(verifyIdx).toBeGreaterThan(-1);
    expect(refreshIdx).toBeGreaterThan(verifyIdx);
    expect(checkIdx).toBeGreaterThan(refreshIdx);
    expect(restoredIdx).toBeGreaterThan(checkIdx);
  });

  it('imports isSubscribed from the single existing entitlement rule rather than re-deriving "has access" itself', () => {
    expect(source).toMatch(/import \{ isSubscribed \} from '\.\.\/lib\/entitlements';/);
  });

  it('an unrelated transaction outcome (not "purchased") is ignored - never treated as a restore result', () => {
    expect(source).toMatch(/if \(result\.outcome !== 'purchased'\) return;/);
  });

  it('a refresh that does NOT show active Plus access sets nothing, leaving whatever restore() already reported rather than fabricating a failure or a nothing-to-restore state', () => {
    const listenerBody = source.match(/addAppleTransactionUpdateListener\(async \(result\) => \{[\s\S]*?\n {4}\}\);/)?.[0] ?? '';
    // Exactly one setState call in the listener body, guarded by the
    // isSubscribed check above - no unconditional setState after it.
    const setStateCalls = listenerBody.match(/setState\(/g) ?? [];
    expect(setStateCalls).toHaveLength(1);
  });
});

describe('useAppleRestore — never writes entitlement itself', () => {
  it('never sets plan/status/subscription directly - the only writes are its own local UI state (state/error)', () => {
    expect(source).not.toMatch(/setSubscription\(/);
    expect(source).not.toMatch(/plan:\s*'plus'/);
  });
});
