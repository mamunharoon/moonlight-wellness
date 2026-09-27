// Shared guided-media completion — context-aware presentation. Real
// execution (this module has no React/DOM dependency), matching the
// preference for executable behavioural tests over source-string
// assertions.
import { describe, it, expect } from 'vitest';
import { getMediaCompletionPresentation, MEDIA_COMPLETION_JOURNEYS } from './mediaCompletionPresentation';

describe('getMediaCompletionPresentation - exact approved labels per context', () => {
  it('morning: gold tone, "Continue Morning Routine" primary, "Choose Another Session" secondary', () => {
    const p = getMediaCompletionPresentation('morning');
    expect(p.journey).toBe('morning');
    expect(p.primaryLabel).toBe('Continue Morning Routine');
    expect(p.secondaryLabel).toBe('Choose Another Session');
    expect(p.badgeClasses).toMatch(/morning-accent/);
    expect(p.badgeClasses).not.toMatch(/tertiary|evening-accent/);
  });

  it('anytime: mint tone, "Choose Another Session" primary, "Return Home" secondary', () => {
    const p = getMediaCompletionPresentation('anytime');
    expect(p.journey).toBe('anytime');
    expect(p.primaryLabel).toBe('Choose Another Session');
    expect(p.secondaryLabel).toBe('Return Home');
    expect(p.badgeClasses).toMatch(/tertiary/);
    expect(p.badgeClasses).not.toMatch(/morning-accent|evening-accent/);
  });

  it('evening: periwinkle tone, "Continue Wind-Down" primary, "Choose Another Session" secondary', () => {
    const p = getMediaCompletionPresentation('evening');
    expect(p.journey).toBe('evening');
    expect(p.primaryLabel).toBe('Continue Wind-Down');
    expect(p.secondaryLabel).toBe('Choose Another Session');
    expect(p.badgeClasses).toMatch(/evening-accent/);
    expect(p.badgeClasses).not.toMatch(/morning-accent|tertiary/);
  });

  it('library: neutral tone, "Explore Another Session" primary, "Back to Library" secondary', () => {
    const p = getMediaCompletionPresentation('library');
    expect(p.journey).toBe('library');
    expect(p.primaryLabel).toBe('Explore Another Session');
    expect(p.secondaryLabel).toBe('Back to Library');
    expect(p.badgeClasses).not.toMatch(/morning-accent|tertiary|evening-accent/);
  });

  it('direct: neutral tone, "Done" primary, "Explore Another Session" secondary', () => {
    const p = getMediaCompletionPresentation('direct');
    expect(p.journey).toBe('direct');
    expect(p.primaryLabel).toBe('Done');
    expect(p.secondaryLabel).toBe('Explore Another Session');
    expect(p.badgeClasses).not.toMatch(/morning-accent|tertiary|evening-accent/);
  });

  it('an unrecognised or missing journey falls back to the neutral "direct" treatment - never a crash, never silently borrowing another journey\'s identity', () => {
    for (const bad of ['not-a-real-journey', undefined, null, '', 'MORNING']) {
      const p = getMediaCompletionPresentation(bad);
      expect(p.journey).toBe('direct');
      expect(p.primaryLabel).toBe('Done');
    }
  });

  it('MEDIA_COMPLETION_JOURNEYS is the exact five-value allowlist the table specifies, in a stable, frozen array', () => {
    expect(MEDIA_COMPLETION_JOURNEYS).toEqual(['morning', 'anytime', 'evening', 'library', 'direct']);
    expect(Object.isFrozen(MEDIA_COMPLETION_JOURNEYS)).toBe(true);
  });

  it('every context resolves a real, non-empty primaryButtonClasses string - never undefined/empty, reusing the existing shared journey-action helper rather than a new one', () => {
    for (const journey of MEDIA_COMPLETION_JOURNEYS) {
      const p = getMediaCompletionPresentation(journey);
      expect(typeof p.primaryButtonClasses).toBe('string');
      expect(p.primaryButtonClasses.length).toBeGreaterThan(0);
    }
  });
});
