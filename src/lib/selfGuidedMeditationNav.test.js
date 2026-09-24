import { describe, it, expect } from 'vitest';
import {
  SELF_GUIDED_MEDITATION_CONTEXTS,
  DEFAULT_SELF_GUIDED_MEDITATION_CONTEXT_KEY,
  resolveSelfGuidedMeditationContext
} from './selfGuidedMeditationNav';

describe('SELF_GUIDED_MEDITATION_CONTEXTS — allowlist only, home and library exposed this phase', () => {
  it('defines exactly home and library - morning/evening are deliberately not exposed yet', () => {
    expect(Object.keys(SELF_GUIDED_MEDITATION_CONTEXTS)).toEqual(['home', 'library']);
  });

  it('home resolves to the real app root', () => {
    expect(SELF_GUIDED_MEDITATION_CONTEXTS.home).toEqual({ fallback: '/', label: 'Back to Home' });
  });

  it('library resolves to the real Library route, filtered to the Meditation category', () => {
    expect(SELF_GUIDED_MEDITATION_CONTEXTS.library).toEqual({
      fallback: '/library?category=meditation',
      label: 'Back to Library'
    });
  });

  it('the default context key is home', () => {
    expect(DEFAULT_SELF_GUIDED_MEDITATION_CONTEXT_KEY).toBe('home');
  });
});

describe('resolveSelfGuidedMeditationContext — never returns undefined, never trusts a raw value as a destination', () => {
  it('resolves a valid key to its fixed context', () => {
    expect(resolveSelfGuidedMeditationContext('library').fallback).toBe('/library?category=meditation');
  });

  it('an unknown value falls back safely to Home', () => {
    expect(resolveSelfGuidedMeditationContext('bogus')).toEqual(SELF_GUIDED_MEDITATION_CONTEXTS.home);
  });

  it('a missing/undefined value falls back safely to Home', () => {
    expect(resolveSelfGuidedMeditationContext(undefined)).toEqual(SELF_GUIDED_MEDITATION_CONTEXTS.home);
    expect(resolveSelfGuidedMeditationContext(null)).toEqual(SELF_GUIDED_MEDITATION_CONTEXTS.home);
  });

  it('an arbitrary string (an attempted open-redirect-style value, e.g. a URL) can never be used as a destination - only ever an object-lookup key', () => {
    expect(resolveSelfGuidedMeditationContext('https://evil.example')).toEqual(SELF_GUIDED_MEDITATION_CONTEXTS.home);
    expect(resolveSelfGuidedMeditationContext('/admin')).toEqual(SELF_GUIDED_MEDITATION_CONTEXTS.home);
  });

  it('morning/evening are not yet valid keys, even though the module is structured so adding them later is a one-line change', () => {
    expect(resolveSelfGuidedMeditationContext('morning')).toEqual(SELF_GUIDED_MEDITATION_CONTEXTS.home);
    expect(resolveSelfGuidedMeditationContext('evening')).toEqual(SELF_GUIDED_MEDITATION_CONTEXTS.home);
  });
});
