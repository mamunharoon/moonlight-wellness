// First-Use Welcome redirect-order defect fix — real-execution coverage
// for the module-level "has a post-auth redirect decision already been
// made this page load" flag. Deliberately re-imports the module fresh in
// each test (vi.resetModules) since the whole point of this flag is that
// it's plain, un-resettable module state for the lifetime of one page
// load - the only way to test both "false at first" and "true after
// marking" is a fresh module instance per test.
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('postAuthRedirectGuard — plain module-level flag, real execution', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('starts false for a fresh module instance (a fresh page load)', async () => {
    const { hasPostAuthRedirectBeenHandled } = await import('./postAuthRedirectGuard');
    expect(hasPostAuthRedirectBeenHandled()).toBe(false);
  });

  it('becomes true after marking, and stays true for every subsequent read', async () => {
    const { markPostAuthRedirectHandled, hasPostAuthRedirectBeenHandled } = await import('./postAuthRedirectGuard');
    expect(hasPostAuthRedirectBeenHandled()).toBe(false);
    markPostAuthRedirectHandled();
    expect(hasPostAuthRedirectBeenHandled()).toBe(true);
    expect(hasPostAuthRedirectBeenHandled()).toBe(true);
  });

  it('marking twice is a harmless no-op - still just true', async () => {
    const { markPostAuthRedirectHandled, hasPostAuthRedirectBeenHandled } = await import('./postAuthRedirectGuard');
    markPostAuthRedirectHandled();
    markPostAuthRedirectHandled();
    expect(hasPostAuthRedirectBeenHandled()).toBe(true);
  });
});
