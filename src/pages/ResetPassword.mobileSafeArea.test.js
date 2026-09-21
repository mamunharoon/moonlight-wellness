// Mobile-safety follow-up (font-size, touch target, safe-area) — regression
// guard for ResetPassword.jsx. Same source-level pattern and the same
// verification-limitation note as Auth.mobileSafeArea.test.js (see that
// file's own header comment) - no DOM rendering available in this repo's
// Vitest; computed-style values were verified live via the temporary
// local status-override technique documented in this session's evidence.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./ResetPassword.jsx');

const inputTags = source.match(/<input\b[\s\S]*?\/>/g) ?? [];

describe('Mobile-safe input font size — every ResetPassword.jsx input is text-base (16px), never text-sm', () => {
  it('finds exactly 2 inputs: newPassword, confirmNewPassword', () => {
    expect(inputTags).toHaveLength(2);
  });

  it('both inputs use text-base, neither uses text-sm', () => {
    for (const tag of inputTags) {
      expect(tag).toMatch(/className="[^"]*\btext-base\b[^"]*"/);
      expect(tag).not.toMatch(/\btext-sm\b/);
    }
  });

  it('no bare text-sm survives anywhere in the file', () => {
    expect(source).not.toMatch(/\btext-sm\b/);
  });
});

describe('Password visibility touch target — the single toggle (controls both fields) is >=44x44px, accessible, keyboard-focusable', () => {
  const toggleButtons = source.match(/<button\s+type="button"\s+onClick=\{\(\) => setShowPassword\(\(v\) => !v\)\}[\s\S]*?<\/button>/g) ?? [];

  it('finds exactly 1 password visibility toggle', () => {
    expect(toggleButtons).toHaveLength(1);
  });

  it('the toggle has an explicit 44x44px (h-11 w-11) touch target, icon centered', () => {
    expect(toggleButtons[0]).toMatch(/className="[^"]*\bh-11\b[^"]*\bw-11\b[^"]*"/);
    expect(toggleButtons[0]).toMatch(/className="[^"]*\bflex\b[^"]*\bitems-center\b[^"]*\bjustify-center\b[^"]*"/);
  });

  it('keeps its accessible Show/Hide aria-label, unchanged', () => {
    expect(toggleButtons[0]).toMatch(/aria-label=\{showPassword \? 'Hide password' : 'Show password'\}/);
  });

  it('is keyboard-focusable and carries a focus-visible ring class', () => {
    expect(toggleButtons[0]).toMatch(/^<button\s+type="button"/);
    expect(toggleButtons[0]).toMatch(/focus-visible:ring-2/);
    expect(toggleButtons[0]).toMatch(/focus-visible:ring-primary/);
  });

  it('the newPassword input (the one with the toggle) reserves pr-12 (48px) to clear the 44px button at right-1 (4px inset), with zero overlap', () => {
    const newPasswordTag = inputTags.find((t) => /id="newPassword"/.test(t));
    expect(newPasswordTag).toMatch(/className="[^"]*\bpr-12\b[^"]*"/);
    expect(newPasswordTag).not.toMatch(/\bpr-10\b/);
    expect(toggleButtons[0]).toMatch(/\bright-1\b/);
  });

  it('confirmNewPassword has no toggle of its own (mirrors the shared showPassword state) and correctly has no pr-12/pr-10 override, since it reserves no icon space', () => {
    const confirmTag = inputTags.find((t) => /id="confirmNewPassword"/.test(t));
    expect(confirmTag).not.toMatch(/\bpr-10\b|\bpr-12\b/);
  });
});

describe('Safe-area support — env(safe-area-inset-*), additive, never doubled, no hard-coded device inset', () => {
  it('the root container adds top AND bottom safe-area padding on top of the existing 1.5rem, via inline style', () => {
    expect(source).toMatch(/paddingTop: 'calc\(1\.5rem \+ env\(safe-area-inset-top\)\)'/);
    expect(source).toMatch(/paddingBottom: 'calc\(1\.5rem \+ env\(safe-area-inset-bottom\)\)'/);
  });

  it('py-6 was removed from the root className (not left in addition to the inline-style equivalent)', () => {
    const rootDivMatch = source.match(/<div\s+className="min-h-\[85vh\][^"]*"/);
    expect(rootDivMatch).toBeTruthy();
    expect(rootDivMatch[0]).not.toMatch(/\bpy-6\b/);
  });

  it('exactly one safe-area-inset-top and one safe-area-inset-bottom declaration exist - never doubled', () => {
    expect((source.match(/safe-area-inset-top/g) ?? []).length).toBe(1);
    expect((source.match(/safe-area-inset-bottom/g) ?? []).length).toBe(1);
  });
});

describe('No unintended regressions', () => {
  it('the password-policy/weak_password/mismatch handling from the prior remediation is untouched by this follow-up', () => {
    expect(source).toMatch(/isPasswordTooShort\(password\)/);
    expect(source).toMatch(/isWeakPasswordError\(updateError\)/);
    expect(source).toMatch(/PASSWORD_MISMATCH_MESSAGE/);
  });

  it('the confirmation-link/PASSWORD_RECOVERY architecture is untouched - no new auth mechanism introduced', () => {
    expect(source).toMatch(/onAuthStateChange\(\(event\) => \{/);
    expect(source).toMatch(/if \(event === 'PASSWORD_RECOVERY'\) \{/);
    expect(source).not.toMatch(/signInWithPassword|signInWithOtp|signInWithOAuth/);
  });
});
