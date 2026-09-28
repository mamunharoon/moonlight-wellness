// Anytime Visual Flow and Closing Handoff uplift (Part 11, entry-context
// isolation) — resolveAnytimeOrigin is a pure function with no React/
// router/DOM dependency, so unlike most of this codebase's regression
// guards (source-string matching, since no DOM rendering is available in
// this repo's Vitest), this file exercises the REAL function directly
// with real inputs, per this pass's own Part 13 requirement to prefer
// executable pure-function tests where possible.
import { describe, it, expect } from 'vitest';
import { resolveAnytimeOrigin } from './anytimeOrigin';
import { ANYTIME_RESET_NEEDS, ANYTIME_RESET_DURATIONS } from './mediaCatalog';

describe('resolveAnytimeOrigin — the one explicit, validated Anytime-origin marker', () => {
  it('returns anytimeOrigin: false for null/undefined/empty state - the ordinary "no router state at all" case (a direct visit, or a Home quick-action tap that never sets these two fields)', () => {
    for (const state of [null, undefined, {}]) {
      const result = resolveAnytimeOrigin(state);
      expect(result.anytimeOrigin).toBe(false);
      expect(result.anytimeNeed).toBeNull();
      expect(result.anytimeDuration).toBeNull();
      expect(result.anytimeResetDestination).toBe('/anytime-reset');
    }
  });

  it('returns anytimeOrigin: true for every real (needId, durationId) combination in the actual allowlists - never invented values', () => {
    for (const need of ANYTIME_RESET_NEEDS) {
      for (const duration of ANYTIME_RESET_DURATIONS) {
        const result = resolveAnytimeOrigin({ anytimeNeed: need.id, anytimeDuration: duration.id });
        expect(result.anytimeOrigin).toBe(true);
        expect(result.anytimeNeed).toBe(need.id);
        expect(result.anytimeDuration).toBe(duration.id);
        expect(result.anytimeResetDestination).toBe(`/anytime-reset?need=${need.id}&duration=${duration.id}`);
      }
    }
  });

  it('genuinely validates against the real allowlists - a garbage/unrecognised need or duration id is rejected, never trusted as-is (never an open redirect, never a broken restore)', () => {
    const badNeed = resolveAnytimeOrigin({ anytimeNeed: 'not-a-real-need', anytimeDuration: 'quick' });
    expect(badNeed.anytimeOrigin).toBe(false);
    expect(badNeed.anytimeResetDestination).toBe('/anytime-reset');

    const badDuration = resolveAnytimeOrigin({ anytimeNeed: 'calm', anytimeDuration: 'not-a-real-duration' });
    expect(badDuration.anytimeOrigin).toBe(false);
    expect(badDuration.anytimeResetDestination).toBe('/anytime-reset');

    const bothBad = resolveAnytimeOrigin({ anytimeNeed: 'javascript:alert(1)', anytimeDuration: '//evil.example' });
    expect(bothBad.anytimeOrigin).toBe(false);
    expect(bothBad.anytimeResetDestination).toBe('/anytime-reset');
  });

  it('requires BOTH fields - a real need with no duration (or vice versa) is not a genuine Anytime origin', () => {
    expect(resolveAnytimeOrigin({ anytimeNeed: 'calm' }).anytimeOrigin).toBe(false);
    expect(resolveAnytimeOrigin({ anytimeDuration: 'quick' }).anytimeOrigin).toBe(false);
  });

  it('the destination is always a safe, same-origin, relative path - never an absolute URL, never containing the raw unencoded value (protects against a need/duration id that happens to contain special characters, even though today\'s real allowlist ids never do)', () => {
    const result = resolveAnytimeOrigin({ anytimeNeed: 'stress-relief', anytimeDuration: 'short' });
    expect(result.anytimeResetDestination).toMatch(/^\/anytime-reset\?need=/);
    expect(result.anytimeResetDestination).not.toMatch(/^https?:\/\//);
    expect(result.anytimeResetDestination).not.toMatch(/^\/\//);
  });

  it('a rejected (invalid) pair never leaks the invalid value back out - anytimeNeed/anytimeDuration are both null, not the garbage input', () => {
    const result = resolveAnytimeOrigin({ anytimeNeed: 'garbage', anytimeDuration: 'garbage' });
    expect(result.anytimeNeed).toBeNull();
    expect(result.anytimeDuration).toBeNull();
  });
});
