// First-login Introduction gate — regression guard. Source-level checks,
// matching this codebase's established pattern (see
// Home.routineState.test.js's own note); shouldShowIntroduction's own
// comparison logic is unit-tested directly in introductionVersion.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const authSource = read('./Auth.jsx');

const redirectBody = () => authSource.match(/const redirectAfterAuth = async \(authUser, \{ isSignIn = false \} = \{\}\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';

describe('redirectAfterAuth — one-shot Introduction gate, never a persistent per-route guard', () => {
  it('imports shouldShowIntroduction', () => {
    expect(authSource).toMatch(/import \{ shouldShowIntroduction \} from '\.\.\/lib\/introductionVersion';/);
  });

  // Redirect-order defect fix — found live: a normal sign-up with email
  // confirmation (Supabase's default) returns no session at signup time,
  // so this synchronous redirectAfterAuth never runs for that account at
  // all; when the user later opens the confirmation link, nothing else in
  // the app ever showed them Introduction. OnboardingGate.jsx now ALSO
  // evaluates the same decision passively, from AuthContext's own loaded
  // profile - markPostAuthRedirectHandled() here is what stops that
  // passive check from ever double-acting on top of THIS synchronous
  // redirect, which alone knows the correct pendingJourneyIntent/
  // pendingContent/existing=1/resume= destination.
  it('imports and calls markPostAuthRedirectHandled synchronously, before anything else (including the first await) in this function', () => {
    expect(authSource).toMatch(/import \{ markPostAuthRedirectHandled \} from '\.\.\/lib\/postAuthRedirectGuard';/);
    const body = redirectBody();
    const markIndex = body.indexOf('markPostAuthRedirectHandled();');
    const firstAwaitIndex = body.indexOf('await ');
    expect(markIndex).toBeGreaterThan(-1);
    expect(firstAwaitIndex).toBeGreaterThan(markIndex);
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

// Build 16 physical-iPhone correction (F1) — a returning user who signs
// in explicitly, already caught up to CURRENT_INTRODUCTION_VERSION
// (shouldShowIntroduction false), previously fell straight through to
// Home with no acknowledgement. Now reuses the SAME /introduction?
// auto=1&existing=1 route/screen as the branch above - Introduction.jsx's
// own isExisting flag already renders "Welcome back, {name}" - gated
// strictly on the new isSignIn flag so it can never fire for a sign-up,
// or (since AuthContext's session-restore listener never calls
// redirectAfterAuth at all) for an app reopen/refresh/foreground-resume.
describe('redirectAfterAuth — F1 returning-user Welcome back on explicit sign-in', () => {
  it('when shouldShowIntroduction is false AND isSignIn is true, navigates to the same Welcome-back route as a stale-version return, with replace:true', () => {
    const body = redirectBody();
    expect(body).toMatch(/if \(isSignIn\) \{\s*\n\s*navigate\('\/introduction\?auto=1&existing=1', \{ replace: true \}\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('the isSignIn check sits after the shouldShowIntroduction branch, before the final unconditional navigate(\'/\') - reached only when nothing else already returned', () => {
    const body = redirectBody();
    const shouldShowIndex = body.indexOf('shouldShowIntroduction(profileRow?.introduction_completed_version)');
    const isSignInIndex = body.indexOf('if (isSignIn) {');
    const finalHomeIndex = body.lastIndexOf("navigate('/');");
    expect(shouldShowIndex).toBeGreaterThan(-1);
    expect(isSignInIndex).toBeGreaterThan(shouldShowIndex);
    expect(finalHomeIndex).toBeGreaterThan(isSignInIndex);
  });

  it('the isSignIn check is nested inside the same "if (supabase && authUser && !authUser.is_anonymous)" guest/anonymous guard as everything else in this block - never a separate, unguarded top-level branch', () => {
    const body = redirectBody();
    const guardIndex = body.indexOf('if (supabase && authUser && !authUser.is_anonymous) {');
    const isSignInIndex = body.indexOf('if (isSignIn) {');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(isSignInIndex).toBeGreaterThan(guardIndex);
    // Not indented at the function's own top level (4 spaces) - indented
    // one level deeper (6 spaces), confirming it's nested inside the
    // guard block rather than a sibling to it.
    expect(body).toMatch(/\n {6}if \(isSignIn\) \{/);
    expect(body).not.toMatch(/\n {4}if \(isSignIn\) \{/);
  });

  it('redirectAfterAuth accepts isSignIn as a named option defaulting to false - a plain positional authUser call (handleSignUp\'s own shape) never accidentally triggers it', () => {
    expect(authSource).toMatch(/const redirectAfterAuth = async \(authUser, \{ isSignIn = false \} = \{\}\) => \{/);
  });

  it('only handleSignIn\'s own call site passes { isSignIn: true } - handleSignUp\'s call is untouched, so a brand-new signup can never reach the Welcome-back branch even in the edge case where its profile row already had a completed version', () => {
    expect(authSource).toMatch(/await redirectAfterAuth\(signInData\?\.user, \{ isSignIn: true \}\);/);
    expect(authSource).toMatch(/await redirectAfterAuth\(data\.user\);/);
    expect(authSource).not.toMatch(/await redirectAfterAuth\(data\.user, \{ isSignIn: true \}\);/);
  });

  it('the pending-journey-intent and pending-content early returns are completely unaffected - both still return before the isSignIn branch is ever reached, preserving "continue correctly after sign-in with a pending intent"', () => {
    const body = redirectBody();
    const journeyIndex = body.indexOf('const journeyTarget = resolveJourneyResumeTarget(consumePendingJourneyIntent());');
    const pendingIndex = body.indexOf('const pending = consumePendingContent();');
    const isSignInIndex = body.indexOf('if (isSignIn) {');
    expect(journeyIndex).toBeGreaterThanOrEqual(0);
    expect(journeyIndex).toBeLessThan(pendingIndex);
    expect(pendingIndex).toBeLessThan(isSignInIndex);
  });
});

describe('redirectAfterAuth — Morning/Evening authentication continuity (delivery follow-up)', () => {
  it('checks the pending journey intent FIRST, before the existing media pendingContent branch, which is otherwise completely untouched', () => {
    const body = redirectBody();
    const journeyIndex = body.indexOf('const journeyTarget = resolveJourneyResumeTarget(consumePendingJourneyIntent());');
    const pendingIndex = body.indexOf('const pending = consumePendingContent();');
    expect(journeyIndex).toBeGreaterThanOrEqual(0);
    expect(pendingIndex).toBeGreaterThan(journeyIndex);
  });

  it('imports resolveJourneyResumeTarget/consumePendingJourneyIntent from the dedicated, fixed-allowlist module - never reusing pendingContent.js for this', () => {
    expect(authSource).toMatch(
      /import \{ consumePendingJourneyIntent, resolveJourneyResumeTarget \} from '\.\.\/lib\/pendingJourneyIntent';/
    );
  });

  it('navigates to the resolved target with replace:true when one exists, and returns immediately - never falls through to the media pendingContent or Introduction-version checks for this same redirect', () => {
    const body = redirectBody();
    expect(body).toMatch(
      /if \(journeyTarget\) \{\s*\n\s*navigate\(journeyTarget, \{ replace: true \}\);\s*\n\s*return;\s*\n\s*\}/
    );
  });

  it('never constructs the redirect target itself - the fixed route always comes from resolveJourneyResumeTarget, never a hand-built template string here', () => {
    const body = redirectBody();
    expect(body).not.toMatch(/`\/introduction\?auto=1&resume=/);
  });

  it('when no journey intent is pending (the overwhelmingly common case - an ordinary sign-in, or a locked-media sign-in), the existing pendingContent/Introduction-gate logic is reached exactly as before, unmodified', () => {
    const body = redirectBody();
    expect(body).toMatch(/const pending = consumePendingContent\(\);\s*\n\s*if \(pending\) \{/);
    expect(body).toMatch(/if \(supabase && authUser && !authUser\.is_anonymous\) \{/);
  });
});

describe('handleSignIn/handleSignUp — isSubmitting stays true through the redirect decision (no flash of a re-enabled Auth form or authenticated Home)', () => {
  it('handleSignIn does not reset isSubmitting on the success path - only inside the signInError branch', () => {
    const body = authSource.match(/const handleSignIn = async \(e\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const errorBranch = body.match(/if \(signInError\) \{[\s\S]*?\n\s*\}/)?.[0] ?? '';
    const afterErrorBranch = body.slice(body.indexOf(errorBranch) + errorBranch.length);
    expect(errorBranch).toMatch(/setIsSubmitting\(false\);/);
    expect(afterErrorBranch).not.toMatch(/setIsSubmitting\(false\)/);
    expect(afterErrorBranch).toMatch(/await redirectAfterAuth\(signInData\?\.user, \{ isSignIn: true \}\);/);
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
