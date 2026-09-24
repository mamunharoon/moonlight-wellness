// First-login Introduction gate — regression guard. Source-level checks,
// matching this codebase's established pattern (see
// Home.routineState.test.js's own note); shouldShowIntroduction's own
// comparison logic is unit-tested directly in introductionVersion.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const authSource = read('./Auth.jsx');

const redirectBody = () => authSource.match(/const redirectAfterAuth = async \(authUser\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

describe('redirectAfterAuth — one-shot Introduction gate, never a persistent per-route guard', () => {
  it('imports shouldShowIntroduction', () => {
    expect(authSource).toMatch(/import \{ shouldShowIntroduction \} from '\.\.\/lib\/introductionVersion';/);
  });

  it('queries the profile row directly (never AuthContext\'s own possibly-stale `profile` state)', () => {
    const body = redirectBody();
    expect(body).toMatch(/await supabase\s*\n\s*\.from\('profiles'\)\s*\n\s*\.select\('introduction_completed_version'\)\s*\n\s*\.eq\('id', authUser\.id\)\s*\n\s*\.maybeSingle\(\);/);
    expect(body).not.toMatch(/\bprofile\.introduction_completed_version\b/);
  });

  it('a pending sign-in return destination still wins over Introduction', () => {
    const body = redirectBody();
    const pendingIndex = body.indexOf('const pending = consumePendingContent();');
    const supabaseCheckIndex = body.indexOf('if (supabase && authUser');
    expect(pendingIndex).toBeGreaterThanOrEqual(0);
    expect(supabaseCheckIndex).toBeGreaterThan(pendingIndex);
  });

  it('never runs the check for a guest/anonymous auth user', () => {
    const body = redirectBody();
    expect(body).toMatch(/if \(supabase && authUser && !authUser\.is_anonymous\) \{/);
  });

  it('navigates to /introduction?auto=1 WITH replace:true when shouldShowIntroduction is true, otherwise falls through to Home', () => {
    const body = redirectBody();
    expect(body).toMatch(/else if \(shouldShowIntroduction\(profileRow\?\.introduction_completed_version\)\) \{\s*\n[\s\S]*?navigate\(`\/introduction\?auto=1\$\{existingParam\}`, \{ replace: true \}\);\s*\n\s*return;\s*\n\s*\}/);
    expect(body.trim().endsWith("navigate('/');\n  };") || body.includes("navigate('/');")).toBe(true);
  });

  it('the ?auto=1 marker covers both a brand-new sign-up and an existing account still below CURRENT_INTRODUCTION_VERSION - shouldShowIntroduction makes no distinction between the two, and neither does this redirect', () => {
    const body = redirectBody();
    expect(body).toMatch(/navigate\(`\/introduction\?auto=1\$\{existingParam\}`/);
  });

  it('&existing=1 (Personalised Welcome copy) is appended only when this account already had a real, previously-completed version - never for a genuinely brand-new profile', () => {
    const body = redirectBody();
    expect(body).toMatch(/const existingParam = profileRow\?\.introduction_completed_version \? '&existing=1' : '';/);
  });

  it('a profile query error fails open to Home and is logged without any user-identifying detail (no email, no user id)', () => {
    const body = redirectBody();
    const errorBranch = body.match(/if \(profileError\) \{[\s\S]*?\n\s*\}/)?.[0] ?? '';
    expect(errorBranch).toMatch(/console\.warn\(/);
    expect(errorBranch).not.toMatch(/authUser\.id|authUser\.email|email/);
  });
});

describe('handleSignIn/handleSignUp — isSubmitting stays true through the redirect decision (no flash of a re-enabled Auth form or authenticated Home)', () => {
  it('handleSignIn does not reset isSubmitting on the success path - only inside the signInError branch', () => {
    const body = authSource.match(/const handleSignIn = async \(e\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const errorBranch = body.match(/if \(signInError\) \{[\s\S]*?\n\s*\}/)?.[0] ?? '';
    const afterErrorBranch = body.slice(body.indexOf(errorBranch) + errorBranch.length);
    expect(errorBranch).toMatch(/setIsSubmitting\(false\);/);
    expect(afterErrorBranch).not.toMatch(/setIsSubmitting\(false\)/);
    expect(afterErrorBranch).toMatch(/await redirectAfterAuth\(signInData\?\.user\);/);
  });

  it('handleSignUp resets isSubmitting only in its error/no-session branches, never on the path that reaches the awaited redirect', () => {
    const body = authSource.match(/const handleSignUp = async \(e\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const errorBranch = body.match(/if \(signUpError\) \{[\s\S]*?\n\s*\}/)?.[0] ?? '';
    const noSessionBranch = body.match(/if \(data\.user && !data\.session\) \{[\s\S]*?\n\s*\}/)?.[0] ?? '';
    expect(errorBranch).toMatch(/setIsSubmitting\(false\);/);
    expect(noSessionBranch).toMatch(/setIsSubmitting\(false\);/);
    const afterNoSessionBranch = body.slice(body.indexOf(noSessionBranch) + noSessionBranch.length);
    expect(afterNoSessionBranch).not.toMatch(/setIsSubmitting\(false\)/);
    expect(afterNoSessionBranch).toMatch(/await redirectAfterAuth\(data\.user\);/);
  });
});
