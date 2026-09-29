// WakeWise Phase 2B — both the protected (DeleteAccount.jsx) and public
// (PublicDeleteAccount.jsx) "what gets deleted" explanations now include
// practice-completion/Momentum records, matching the corrected privacy
// policy (legalContentAccuracy.test.js). Source-level checks, same
// convention as this repo's other page tests.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('Deletion copy — no longer silently omits completion/Momentum records', () => {
  it('DeleteAccount.jsx (the protected, authoritative flow) mentions practice-completion and Momentum history', () => {
    expect(read('./DeleteAccount.jsx')).toMatch(/practice-completion and Momentum history/);
  });

  it('PublicDeleteAccount.jsx (the public resource) says the same thing, not a divergent copy', () => {
    expect(read('./PublicDeleteAccount.jsx')).toMatch(/practice-completion and Momentum history/);
  });
});
