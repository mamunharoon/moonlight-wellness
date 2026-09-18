import { describe, it, expect } from 'vitest';
import { isMusicEligibleEntry, resolvePlaybackId, shouldShowMusicToggle, isInteractiveMusicEligible } from './backgroundMusicSelection';

describe('isMusicEligibleEntry', () => {
  it('excludes every Sleep Soundscape id (SL prefix), regardless of whether `category` is present', () => {
    expect(isMusicEligibleEntry({ id: 'SL01', category: 'Sleep Soundscapes' })).toBe(false);
    expect(isMusicEligibleEntry({ id: 'SL08' })).toBe(false); // no category field at all - Beta.jsx's own raw-manifest shape
  });

  it('is eligible for an ordinary guided-exercise id', () => {
    expect(isMusicEligibleEntry({ id: 'E02', category: 'Calm & Support' })).toBe(true);
    expect(isMusicEligibleEntry({ id: 'M03' })).toBe(true);
  });

  it('never throws for missing/malformed input', () => {
    expect(isMusicEligibleEntry(null)).toBe(false);
    expect(isMusicEligibleEntry(undefined)).toBe(false);
    expect(isMusicEligibleEntry({})).toBe(false);
  });
});

describe('resolvePlaybackId', () => {
  const registry = { 'E02-MUSIC': { id: 'E02-MUSIC', storagePath: 'exercises/fake.mp4' } };
  const getEntryById = (id) => registry[id];

  it('returns the narration-only id when the feature flag is off, even if everything else lines up', () => {
    const entry = { id: 'E02', category: 'Calm & Support', musicVariantId: 'E02-MUSIC' };
    expect(resolvePlaybackId({ entry, musicEnabled: true, featureEnabled: false, getEntryById })).toBe('E02');
  });

  it('returns the narration-only id when the user preference is off', () => {
    const entry = { id: 'E02', category: 'Calm & Support', musicVariantId: 'E02-MUSIC' };
    expect(resolvePlaybackId({ entry, musicEnabled: false, featureEnabled: true, getEntryById })).toBe('E02');
  });

  it('never returns a music variant for a Sleep Soundscape, no matter what else is true', () => {
    const entry = { id: 'SL01', category: 'Sleep Soundscapes', musicVariantId: 'SL01-MUSIC' };
    const sleepRegistry = { 'SL01-MUSIC': { id: 'SL01-MUSIC' } };
    expect(resolvePlaybackId({ entry, musicEnabled: true, featureEnabled: true, getEntryById: (id) => sleepRegistry[id] })).toBe('SL01');
  });

  it('falls back safely when musicVariantId is set but not actually registered (missing/unproduced asset)', () => {
    const entry = { id: 'E09', category: 'Calm & Support', musicVariantId: 'E09-MUSIC-NOT-REGISTERED' };
    expect(resolvePlaybackId({ entry, musicEnabled: true, featureEnabled: true, getEntryById })).toBe('E09');
  });

  it('falls back safely when the entry has no musicVariantId at all (the current state of every real entry today)', () => {
    const entry = { id: 'E02', category: 'Calm & Support' };
    expect(resolvePlaybackId({ entry, musicEnabled: true, featureEnabled: true, getEntryById })).toBe('E02');
  });

  it('resolves the music variant only when every condition holds simultaneously', () => {
    const entry = { id: 'E02', category: 'Calm & Support', musicVariantId: 'E02-MUSIC' };
    expect(resolvePlaybackId({ entry, musicEnabled: true, featureEnabled: true, getEntryById })).toBe('E02-MUSIC');
  });

  it('returns null (never throws) for a missing entry', () => {
    expect(resolvePlaybackId({ entry: null, musicEnabled: true, featureEnabled: true, getEntryById })).toBeNull();
    expect(resolvePlaybackId({ entry: undefined, musicEnabled: true, featureEnabled: true, getEntryById })).toBeNull();
  });

  it('never throws when getEntryById is not provided', () => {
    const entry = { id: 'E02', category: 'Calm & Support', musicVariantId: 'E02-MUSIC' };
    expect(() => resolvePlaybackId({ entry, musicEnabled: true, featureEnabled: true })).not.toThrow();
    expect(resolvePlaybackId({ entry, musicEnabled: true, featureEnabled: true })).toBe('E02');
  });
});

describe('shouldShowMusicToggle', () => {
  it('is false when the feature flag is off, even with a real variant present', () => {
    expect(shouldShowMusicToggle({ entry: { id: 'E02', musicVariantId: 'E02-MUSIC' }, featureEnabled: false })).toBe(false);
  });

  it('is false for a Sleep Soundscape regardless of flag state', () => {
    expect(shouldShowMusicToggle({ entry: { id: 'SL01', musicVariantId: 'SL01-MUSIC' }, featureEnabled: true })).toBe(false);
  });

  it('is false when no musicVariantId exists on the entry (every real entry today)', () => {
    expect(shouldShowMusicToggle({ entry: { id: 'E02', category: 'Calm & Support' }, featureEnabled: true })).toBe(false);
  });

  it('is true only when the flag is on, the entry is eligible, and a variant id is present', () => {
    expect(shouldShowMusicToggle({ entry: { id: 'E02', category: 'Calm & Support', musicVariantId: 'E02-MUSIC' }, featureEnabled: true })).toBe(true);
  });
});

describe('isInteractiveMusicEligible (Evening Breathing / Quiet Breathing - no narration to fall back to)', () => {
  const registry = { IB01: { id: 'IB01', storagePath: 'exercises/fake-loop.m4a' } };
  const getEntryById = (id) => registry[id];

  it('is false when the feature flag is off, even with a registered id', () => {
    expect(isInteractiveMusicEligible({ musicVariantId: 'IB01', featureEnabled: false, getEntryById })).toBe(false);
  });

  it('is false when no musicVariantId is provided at all (today\'s real state for every interactive breathing screen)', () => {
    expect(isInteractiveMusicEligible({ musicVariantId: null, featureEnabled: true, getEntryById })).toBe(false);
    expect(isInteractiveMusicEligible({ musicVariantId: undefined, featureEnabled: true, getEntryById })).toBe(false);
  });

  it('is false when musicVariantId is set but not actually registered in the manifest', () => {
    expect(isInteractiveMusicEligible({ musicVariantId: 'IB99-NOT-REGISTERED', featureEnabled: true, getEntryById })).toBe(false);
  });

  it('is true only when the flag is on AND the id resolves to a real registered entry', () => {
    expect(isInteractiveMusicEligible({ musicVariantId: 'IB01', featureEnabled: true, getEntryById })).toBe(true);
  });

  it('never throws when getEntryById is missing', () => {
    expect(isInteractiveMusicEligible({ musicVariantId: 'IB01', featureEnabled: true })).toBe(false);
  });
});
