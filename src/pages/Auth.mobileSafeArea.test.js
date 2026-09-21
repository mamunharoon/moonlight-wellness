// Mobile-safety follow-up (font-size, touch target, safe-area) — regression
// guard. Source-level checks, matching this codebase's established pattern
// for Auth.jsx (see Auth.signupUx.test.js's own note: no DOM/component
// rendering is available in this repo's Vitest). Computed-style values
// (16px font-size, 44x44 touch target, 24px baseline safe-area padding on
// a non-native browser) were additionally verified live against the local
// dev server — see this session's verification evidence. Genuine
// :focus-visible ring behavior on the enlarged eye-icon buttons could not
// be triggered via this session's browser-automation tooling (a synthetic
// Tab keypress did not move document.activeElement away from <body>, a
// known limitation of some CDP-driven automation) - the ring class itself
// is confirmed present and uses the exact same focus-visible/ring idiom
// already relied on elsewhere in this file (inputs' own focus:ring-1
// focus:ring-primary), which IS visually confirmed working throughout
// this session's screenshots.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const authSource = read('./Auth.jsx');

// Every <input ...> element's opening tag, captured whole so its className
// can be inspected. Auth.jsx has no self-closing input with attributes
// spanning further than this (confirmed by count below).
const inputTags = authSource.match(/<input\b[\s\S]*?\/>/g) ?? [];

describe('Mobile-safe input font size — every Auth.jsx input is text-base (16px), never text-sm', () => {
  it('finds exactly 8 inputs: firstName, lastName, signUpEmail, signUpPassword, confirmPassword, signInEmail, signInPassword, resetEmail', () => {
    expect(inputTags).toHaveLength(8);
  });

  it('every single input tag uses text-base, and none use text-sm', () => {
    for (const tag of inputTags) {
      expect(tag).toMatch(/className="[^"]*\btext-base\b[^"]*"/);
      expect(tag).not.toMatch(/\btext-sm\b/);
    }
  });

  it('no bare text-sm survives anywhere in the file (would indicate a missed input or a helper/label accidentally bumped instead)', () => {
    // Labels/hints/errors intentionally keep their own smaller sizing
    // (text-[10px]/text-[11px]) - this guards specifically against a
    // stray text-sm, not against those untouched, differently-sized
    // elements.
    expect(authSource).not.toMatch(/\btext-sm\b/);
  });

  it('label/helper/error typography was not touched - text-[10px] and text-[11px] usage count is unchanged from before this follow-up', () => {
    // 12 x text-[10px] (8 field labels + signUpPasswordHint + 3 field
    // errors: email/password/confirmPassword) + 1 x text-[11px] (the
    // ToS/Privacy paragraph) - a stable count confirms no label/helper/
    // error class was altered as a side effect of the input font-size
    // change.
    expect((authSource.match(/text-\[10px\]/g) ?? []).length).toBe(12);
    expect((authSource.match(/text-\[11px\]/g) ?? []).length).toBe(1);
  });
});

describe('Password visibility touch target — every toggle is >=44x44px, accessible, keyboard-focusable', () => {
  const toggleButtons = authSource.match(/<button\s+type="button"\s+onClick=\{\(\) => set(?:Show|ShowConfirm)Password\(\(v\) => !v\)\}[\s\S]*?<\/button>/g) ?? [];

  it('finds exactly 3 password visibility toggles (Sign Up password, Sign Up confirm password, Sign In password)', () => {
    expect(toggleButtons).toHaveLength(3);
  });

  it('every toggle has an explicit 44x44px (h-11 w-11) touch target, with the icon centered inside it', () => {
    for (const btn of toggleButtons) {
      expect(btn).toMatch(/className="[^"]*\bh-11\b[^"]*\bw-11\b[^"]*"/);
      expect(btn).toMatch(/className="[^"]*\bflex\b[^"]*\bitems-center\b[^"]*\bjustify-center\b[^"]*"/);
    }
  });

  it('every toggle keeps its accessible Show/Hide aria-label, unchanged', () => {
    for (const btn of toggleButtons) {
      expect(btn).toMatch(/aria-label=\{show(?:Password|ConfirmPassword) \? 'Hide password' : 'Show password'\}/);
    }
  });

  it('every toggle is keyboard-focusable (a real <button>, never a div/span) and carries a focus-visible ring class', () => {
    for (const btn of toggleButtons) {
      expect(btn).toMatch(/^<button\s+type="button"/);
      expect(btn).toMatch(/focus-visible:ring-2/);
      expect(btn).toMatch(/focus-visible:ring-primary/);
    }
  });

  it('the icon glyph itself (material-symbols-outlined, text-lg) is unchanged - only the interactive hit-area grew, not the visible icon', () => {
    for (const btn of toggleButtons) {
      expect(btn).toMatch(/<span className="material-symbols-outlined text-lg">/);
    }
  });

  it('each password input reserves exactly enough right padding (pr-12 = 48px) to clear its 44px toggle positioned at right-1 (4px inset) - zero text/tap-target overlap by construction (4 + 44 = 48)', () => {
    const passwordInputs = inputTags.filter((t) => /type=\{show(?:Password|ConfirmPassword) \? 'text' : 'password'\}/.test(t));
    expect(passwordInputs.length).toBeGreaterThanOrEqual(2);
    for (const input of passwordInputs) {
      expect(input).toMatch(/className="[^"]*\bpr-12\b[^"]*"/);
      expect(input).not.toMatch(/\bpr-10\b/);
    }
    for (const btn of toggleButtons) {
      expect(btn).toMatch(/\bright-1\b/);
    }
  });
});

describe('Safe-area support — env(safe-area-inset-*), additive, never doubled, no hard-coded device inset', () => {
  it('the root container adds top AND bottom safe-area padding on top of the existing 1.5rem, via inline style (not a fixed px value)', () => {
    expect(authSource).toMatch(/paddingTop: 'calc\(1\.5rem \+ env\(safe-area-inset-top\)\)'/);
    expect(authSource).toMatch(/paddingBottom: 'calc\(1\.5rem \+ env\(safe-area-inset-bottom\)\)'/);
  });

  it('py-6 was removed from the root className (replaced by the inline-style equivalent, not left in addition to it - which would double the base padding)', () => {
    const rootDivMatch = authSource.match(/<div\s+className="min-h-\[85vh\][^"]*"/);
    expect(rootDivMatch).toBeTruthy();
    expect(rootDivMatch[0]).not.toMatch(/\bpy-6\b/);
  });

  it('no hard-coded device-specific inset value (a raw pixel constant standing in for the safe area) was introduced', () => {
    expect(authSource).not.toMatch(/safe-area-inset-(top|bottom)\)\)?\s*[+-]\s*\d/); // no arithmetic combining env() with a literal beyond the fixed 1.5rem base already asserted above
  });

  it('exactly one safe-area-inset-top and one safe-area-inset-bottom declaration exist - never doubled', () => {
    expect((authSource.match(/safe-area-inset-top/g) ?? []).length).toBe(1);
    expect((authSource.match(/safe-area-inset-bottom/g) ?? []).length).toBe(1);
  });
});

describe('No unintended regressions', () => {
  it('the signup outcome/error-mapping logic from the prior remediation is untouched by this follow-up', () => {
    expect(authSource).toMatch(/const \[signupOutcome, setSignupOutcome\] = useState\(null\);/);
    expect(authSource).toMatch(/isAccountAlreadyExistsError\(signUpError\)/);
    expect(authSource).toMatch(/isWeakPasswordError\(signUpError\)/);
    expect(authSource).toMatch(/isEmailRateLimitError\(signUpError\)/);
  });

  it('Sign In remains functionally unaffected: no password-length policy import is applied to handleSignIn, and its own password field has no visible hint/error paragraph', () => {
    const signInBody = authSource.match(/const handleSignIn = async \(e\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(signInBody).not.toMatch(/isPasswordTooShort|getPasswordTooShortMessage|PASSWORD_MISMATCH_MESSAGE/);
    const signInPasswordBlock = authSource.match(/id="signInPassword"[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(signInPasswordBlock).not.toMatch(/aria-invalid|aria-describedby/);
  });

});
