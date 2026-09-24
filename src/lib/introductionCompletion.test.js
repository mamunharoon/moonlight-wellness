// Introduction-version completion — real behaviour tests against a fake
// Supabase client (not just a source-level regex check), matching
// signOutFlow.test.js's own established pattern for verifying async
// Supabase-touching logic extracted into a plain, dependency-injected
// function.
//
// This is the shared write path both Introduction.jsx's own
// persistAndContinue (a signed-in user tapping a card) and Auth.jsx's
// redirectAfterAuth (a guest continuing into Morning/Evening after
// signing in - see pendingJourneyIntent.js) now call - proving it here,
// once, for real, covers both callers at their one common dependency.
import { describe, it, expect, vi } from 'vitest';
import { completeIntroductionVersion } from './introductionCompletion';
import { CURRENT_INTRODUCTION_VERSION } from './introductionVersion';

const makeFakeClient = ({ selectResults, updateResult } = {}) => {
  const selectQueue = [...(selectResults ?? [])];
  const maybeSingle = vi.fn(() => Promise.resolve(selectQueue.shift() ?? { data: null, error: null }));
  const update = vi.fn(() => ({
    eq: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve(updateResult ?? { data: [{ id: 'user-a' }], error: null }))
    }))
  }));
  const from = vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
    update
  }));
  return { client: { from }, maybeSingle, update };
};

describe('completeIntroductionVersion — no Supabase client / no user', () => {
  it('is a safe no-op success when supabase is missing', async () => {
    await expect(completeIntroductionVersion({ supabase: null, userId: 'user-a' })).resolves.toEqual({ ok: true });
  });

  it('is a safe no-op success when userId is missing', async () => {
    const { client } = makeFakeClient();
    await expect(completeIntroductionVersion({ supabase: client, userId: null })).resolves.toEqual({ ok: true });
  });
});

describe('completeIntroductionVersion — a brand-new account (version 0/null)', () => {
  it('writes CURRENT_INTRODUCTION_VERSION and reports ok', async () => {
    const { client, update } = makeFakeClient({
      selectResults: [{ data: { introduction_completed_version: 0 }, error: null }]
    });
    const result = await completeIntroductionVersion({ supabase: client, userId: 'user-a' });
    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ introduction_completed_version: CURRENT_INTRODUCTION_VERSION });
  });

  it('treats a null version the same as 0', async () => {
    const { client, update } = makeFakeClient({
      selectResults: [{ data: { introduction_completed_version: null }, error: null }]
    });
    const result = await completeIntroductionVersion({ supabase: client, userId: 'user-a' });
    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('completeIntroductionVersion — replay safety: never resets or lowers an already-saved version', () => {
  it('an account already at CURRENT_INTRODUCTION_VERSION is left untouched - no update call at all', async () => {
    const { client, update } = makeFakeClient({
      selectResults: [{ data: { introduction_completed_version: CURRENT_INTRODUCTION_VERSION }, error: null }]
    });
    const result = await completeIntroductionVersion({ supabase: client, userId: 'user-a' });
    expect(result).toEqual({ ok: true });
    expect(update).not.toHaveBeenCalled();
  });

  it('an account already ABOVE CURRENT_INTRODUCTION_VERSION (a future version already shipped) is also left untouched, never lowered', async () => {
    const { client, update } = makeFakeClient({
      selectResults: [{ data: { introduction_completed_version: CURRENT_INTRODUCTION_VERSION + 5 }, error: null }]
    });
    const result = await completeIntroductionVersion({ supabase: client, userId: 'user-a' });
    expect(result).toEqual({ ok: true });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('completeIntroductionVersion — profile-row race handling reuses the caller-supplied ensure-profile mechanism', () => {
  it('calls refreshProfile and retries the read when the row is initially missing, succeeding once it appears', async () => {
    const { client, update } = makeFakeClient({
      selectResults: [
        { data: null, error: null }, // first read: row not there yet
        { data: { introduction_completed_version: 0 }, error: null } // retry after refreshProfile: there
      ]
    });
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    const result = await completeIntroductionVersion({ supabase: client, userId: 'user-a', refreshProfile });
    expect(refreshProfile).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('fails safely (no throw) when the row is still missing after refreshProfile, never attempting an insert of its own', async () => {
    const { client, update } = makeFakeClient({
      selectResults: [
        { data: null, error: null },
        { data: null, error: null }
      ]
    });
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    const result = await completeIntroductionVersion({ supabase: client, userId: 'user-a', refreshProfile });
    expect(result).toEqual({ ok: false });
    expect(update).not.toHaveBeenCalled();
  });

  it('fails safely when the row is missing and no refreshProfile was supplied at all (Auth.jsx\'s own call site) - never retried blindly, never treated as success', async () => {
    const { client, update } = makeFakeClient({
      selectResults: [{ data: null, error: null }]
    });
    const result = await completeIntroductionVersion({ supabase: client, userId: 'user-a' });
    expect(result).toEqual({ ok: false });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('completeIntroductionVersion — real failure handling, never a silent false success', () => {
  it('a read error is surfaced as a failure, no update attempted', async () => {
    const { client, update } = makeFakeClient({
      selectResults: [{ data: null, error: { message: 'network error' } }]
    });
    const result = await completeIntroductionVersion({ supabase: client, userId: 'user-a' });
    expect(result).toEqual({ ok: false });
    expect(update).not.toHaveBeenCalled();
  });

  it('an update error is surfaced as a failure', async () => {
    const { client } = makeFakeClient({
      selectResults: [{ data: { introduction_completed_version: 0 }, error: null }],
      updateResult: { data: null, error: { message: 'server unavailable' } }
    });
    const result = await completeIntroductionVersion({ supabase: client, userId: 'user-a' });
    expect(result).toEqual({ ok: false });
  });

  it('a zero-row update (no error, but nothing matched) is never silently treated as success', async () => {
    const { client } = makeFakeClient({
      selectResults: [{ data: { introduction_completed_version: 0 }, error: null }],
      updateResult: { data: [], error: null }
    });
    const result = await completeIntroductionVersion({ supabase: client, userId: 'user-a' });
    expect(result).toEqual({ ok: false });
  });

  it('an update matching more than one row is also never treated as success (should be structurally impossible via .eq(id), but never trusted blindly)', async () => {
    const { client } = makeFakeClient({
      selectResults: [{ data: { introduction_completed_version: 0 }, error: null }],
      updateResult: { data: [{ id: 'user-a' }, { id: 'user-b' }], error: null }
    });
    const result = await completeIntroductionVersion({ supabase: client, userId: 'user-a' });
    expect(result).toEqual({ ok: false });
  });
});
