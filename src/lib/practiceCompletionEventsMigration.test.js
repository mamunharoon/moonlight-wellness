// "Your Momentum" foundation, Phase 2 — security/shape guard for the
// practice_completion_events migration. This repo has no local Postgres/
// Deno test harness (see planMapping.test.js's own note on that
// pre-existing gap), so this is a source-level check against the raw SQL,
// matching the one precedent this repo already has for asserting on
// migration file content. It cannot execute the SQL, so it cannot prove
// RLS is *enforced* end-to-end - it proves the migration file itself
// contains exactly the policies/grants/constraints intended, so an
// accidental future edit (e.g. widening a grant, dropping a policy) fails
// this test immediately instead of only being caught by a live-database
// review. supabase/migration-support/validate/...(same version)_validate.sql
// is the read-only, run-by-hand counterpart for confirming the SAME facts
// against a real applied database. Vitest's own include glob
// (vite.config.js) only covers src/**/*.test.js, which is why this test
// lives here rather than alongside the .sql files themselves.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const migrationSource = readFileSync(
  fileURLToPath(new URL('../../supabase/migrations/20260928000000_practice_completion_events.sql', import.meta.url)),
  'utf-8'
);
const rollbackSource = readFileSync(
  fileURLToPath(new URL('../../supabase/migration-support/rollback/20260928000000_practice_completion_events_rollback.sql', import.meta.url)),
  'utf-8'
);
const validateSource = readFileSync(
  fileURLToPath(new URL('../../supabase/migration-support/validate/20260928000000_practice_completion_events_validate.sql', import.meta.url)),
  'utf-8'
);

describe('practice_completion_events — RLS is enabled and owner-scoped only', () => {
  it('enables RLS', () => {
    expect(migrationSource).toMatch(/ALTER TABLE public\.practice_completion_events ENABLE ROW LEVEL SECURITY;/);
  });

  it('SELECT policy is owner-scoped, authenticated-only', () => {
    expect(migrationSource).toMatch(
      /CREATE POLICY "practice_completion_events_select_own" ON public\.practice_completion_events\s*\n\s*FOR SELECT\s*\n\s*TO authenticated\s*\n\s*USING \(\(select auth\.uid\(\)\) = user_id\);/
    );
  });

  it('INSERT policy is owner-scoped, authenticated-only', () => {
    expect(migrationSource).toMatch(
      /CREATE POLICY "practice_completion_events_insert_own" ON public\.practice_completion_events\s*\n\s*FOR INSERT\s*\n\s*TO authenticated\s*\n\s*WITH CHECK \(\(select auth\.uid\(\)\) = user_id\);/
    );
  });

  it('no UPDATE or DELETE policy exists at all - an append-only event log, minimum required permissions', () => {
    expect(migrationSource).not.toMatch(/FOR UPDATE/);
    expect(migrationSource).not.toMatch(/FOR DELETE/);
  });
});

describe('practice_completion_events — anonymous/PUBLIC access is explicitly denied', () => {
  it('revokes ALL from PUBLIC and anon', () => {
    expect(migrationSource).toMatch(/REVOKE ALL ON public\.practice_completion_events FROM PUBLIC;/);
    expect(migrationSource).toMatch(/REVOKE ALL ON public\.practice_completion_events FROM anon;/);
  });

  it('grants only SELECT and INSERT to authenticated - never UPDATE/DELETE/ALL', () => {
    expect(migrationSource).toMatch(/GRANT SELECT, INSERT ON public\.practice_completion_events TO authenticated;/);
    expect(migrationSource).not.toMatch(/GRANT ALL/);
  });
});

describe('practice_completion_events — idempotency: the uniqueness constraint works structurally', () => {
  it('UNIQUE(user_id, idempotency_key) is the real duplicate-protection backstop, not just session_id alone', () => {
    expect(migrationSource).toMatch(
      /ADD CONSTRAINT practice_completion_events_owner_idempotency_key\s*\n\s*UNIQUE \(user_id, idempotency_key\);/
    );
  });

  it('never derives idempotency from user+journey+practice_type+local_date - no such composite unique/check constraint exists', () => {
    expect(migrationSource).not.toMatch(/UNIQUE \(user_id, journey, practice_type, local_date\)/);
  });
});

describe('practice_completion_events — validation constraints', () => {
  it('journey is restricted to the established app-wide allowlist', () => {
    expect(migrationSource).toMatch(/CHECK \(journey IN \('morning', 'anytime', 'evening', 'library', 'direct'\)\)/);
  });

  it('practice_type is restricted to exactly the two Phase 2 wires', () => {
    expect(migrationSource).toMatch(/CHECK \(practice_type IN \('full_routine', 'meditation'\)\)/);
  });

  it('outcome is restricted to exactly \'completed\' for Phase 2', () => {
    expect(migrationSource).toMatch(/CHECK \(outcome = 'completed'\)/);
  });

  it('duration_seconds can never be negative', () => {
    expect(migrationSource).toMatch(/CHECK \(duration_seconds IS NULL OR duration_seconds >= 0\)/);
  });

  it('user_id cascades on auth.users delete, matching every other user-owned table', () => {
    expect(migrationSource).toMatch(/user_id\s+uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE,/);
  });
});

describe('practice_completion_events — indexes exist for the documented future access patterns', () => {
  it('user + completed_at', () => {
    expect(migrationSource).toMatch(/CREATE INDEX IF NOT EXISTS practice_completion_events_user_completed_at_idx\s*\n\s*ON public\.practice_completion_events \(user_id, completed_at\);/);
  });

  it('user + local_date', () => {
    expect(migrationSource).toMatch(/CREATE INDEX IF NOT EXISTS practice_completion_events_user_local_date_idx\s*\n\s*ON public\.practice_completion_events \(user_id, local_date\);/);
  });

  it('user + journey + practice_type + local_date', () => {
    expect(migrationSource).toMatch(/CREATE INDEX IF NOT EXISTS practice_completion_events_user_journey_practice_idx\s*\n\s*ON public\.practice_completion_events \(user_id, journey, practice_type, local_date\);/);
  });
});

describe('practice_completion_events — paired migration-support files are scoped correctly', () => {
  it('the rollback file only ever touches this migration\'s own objects - exactly one DROP TABLE statement, and it targets practice_completion_events', () => {
    const executableLines = rollbackSource
      .split('\n')
      .map((line) => line.replace(/--.*$/, '').trim())
      .filter(Boolean);
    const dropTableStatements = executableLines.filter((line) => line.startsWith('DROP TABLE'));
    expect(dropTableStatements).toEqual(['DROP TABLE IF EXISTS public.practice_completion_events;']);
  });

  it('the validate file is entirely read-only (every statement is a SELECT, never a mutation)', () => {
    const withoutComments = validateSource
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(withoutComments).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/i);
    expect(validateSource.match(/SELECT/g)?.length).toBeGreaterThanOrEqual(9);
  });

  it('the forward migration never touches the unrelated rhythms migration', () => {
    expect(migrationSource).not.toMatch(/rhythms_alarm_enabled_and_configured/);
    expect(migrationSource).not.toMatch(/ALTER TABLE public\.rhythms/);
  });
});
