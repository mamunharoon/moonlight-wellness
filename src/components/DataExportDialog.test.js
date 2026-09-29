// WakeWise Phase 2A correction — the "Download a copy of my data" dialog,
// extracted from AccountManagement.jsx into its own shared component so
// Profile.jsx's row can reuse the exact same honest wording rather than a
// second, divergent copy. Source-level checks, same convention as this
// repo's other component tests (no DOM rendering available).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const dialogSource = read('./DataExportDialog.jsx');
const accountManagementSource = read('../pages/AccountManagement.jsx');
const profileSource = read('../pages/Profile.jsx');
// A doc comment may reasonably name a prop it deliberately omits while
// explaining why - only actual code should be checked for its absence.
const stripComments = (code) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const dialogCodeOnly = stripComments(dialogSource);

describe('DataExportDialog — preserves the original manual-export wording exactly, no automated export invented', () => {
  it('states plainly that automated export is not built yet and points to the one real support email', () => {
    expect(dialogSource).toMatch(/Automated data export isn't available in the app yet\./);
    expect(dialogSource).toMatch(/Email us at \$\{CONTACT_INFO\.email\} from your account's email address and we'll prepare a copy for you\./);
  });

  it('is acknowledge-only (no onConfirm prop passed) - there is nothing to confirm, only to close, matching the original behaviour', () => {
    expect(dialogCodeOnly).not.toMatch(/onConfirm=/);
    expect(dialogSource).toMatch(/cancelLabel="Got it"/);
  });

  it('reads CONTACT_INFO from the one shared constant, never a hardcoded email duplicated at each call site', () => {
    expect(dialogSource).toMatch(/import \{ CONTACT_INFO \} from '\.\.\/lib\/legalContent';/);
  });
});

describe('DataExportDialog — reused by both call sites, never re-authored', () => {
  it('AccountManagement.jsx uses the shared component instead of its own inline dialog', () => {
    expect(accountManagementSource).toMatch(/import \{ DataExportDialog \} from '\.\.\/components\/DataExportDialog';/);
    expect(accountManagementSource).toMatch(/<DataExportDialog open=\{activeDialog === 'export'\} onDismiss=\{\(\) => setActiveDialog\(null\)\}\s*\/>/);
    expect(accountManagementSource).not.toMatch(/Automated data export isn't available/);
  });

  it('Profile.jsx uses the same shared component for its own "Download a copy of my data" row', () => {
    expect(profileSource).toMatch(/import \{ DataExportDialog \} from '\.\.\/components\/DataExportDialog';/);
    expect(profileSource).not.toMatch(/Automated data export isn't available/);
  });
});
