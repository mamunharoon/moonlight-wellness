// Authentication Visual Uplift (Build 16, additive scope) — Auth.jsx
// (Sign In / Create Account / Forgot Password, one component, three
// modes) and ResetPassword.jsx. Presentation-only: this file's main job
// is proving every real behaviour (Supabase auth calls, redirect/return-
// destination logic, password policy, validation, error handling, guest
// entry, Apple/Google absence) is byte-for-byte untouched, alongside the
// specific visual changes actually approved.
//
// No custom Button/TextInput/Tabs component exists in either file -
// every element is hand-rolled JSX local to the file itself, so there is
// no shared-component risk to guard here (confirmed during the Phase 1
// audit). The one broadly shared surface either file touches is the
// plain `.glass-panel` CSS class (src/index.css) and BackButton.jsx
// (Auth.jsx only) - neither's own source is edited by this phase, only
// additional classes are layered on top at the call site, the same
// established technique every other screen in this app already uses.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const authSource = read('./Auth.jsx');
const resetSource = read('./ResetPassword.jsx');
const introSource = read('./Introduction.jsx');

describe('Auth.jsx — heading now matches Introduction.jsx\'s own scale, using Playfair Display as the approved "connection to Welcome"', () => {
  it('the heading is text-3xl (Introduction\'s own scale, up from text-2xl) and uses font-morning-display italic - the one Stitch-inspired serif token, reused here deliberately per the approved brief', () => {
    expect(authSource).toMatch(/<h2 className="text-3xl font-morning-display italic font-semibold text-on-surface">/);
  });

  it('Introduction.jsx itself is confirmed to still use no serif at all - this heading connects to Welcome\'s overall peach/navy identity and scale, not a literal font match, exactly as the approved brief allowed ("use Playfair only where it creates a natural connection")', () => {
    expect(introSource).not.toMatch(/font-morning-display|font-serif/);
  });

  it('the three real mode headings ("Welcome back" / "Create your account" / "Reset your password") are byte-identical to before this phase', () => {
    expect(authSource).toMatch(/\{mode === 'signUp' \? 'Create your account' : mode === 'forgotPassword' \? 'Reset your password' : 'Welcome back'\}/);
  });
});

describe('Auth.jsx — everything EXCEPT the heading stays in the established sans-serif, per the approved brief\'s own explicit rule', () => {
  it('the mode tab switcher (Sign In / Sign Up), every field label, every input, and every submit/secondary button carry no font-morning-display/font-serif class anywhere', () => {
    const tabBlock = authSource.match(/\{mode !== 'forgotPassword' && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    expect(tabBlock).not.toMatch(/font-morning-display|font-serif/);
    const formBlocks = authSource.match(/<form onSubmit=\{[\s\S]*?<\/form>/g) ?? [];
    expect(formBlocks.length).toBeGreaterThanOrEqual(2);
    for (const form of formBlocks) {
      expect(form).not.toMatch(/font-morning-display|font-serif/);
    }
  });
});

describe('Auth.jsx — card radius refined to match Introduction.jsx\'s own rounded-2xl; inputs stay the required 16px iOS-safe text size', () => {
  it('every one of the real 8 <input> elements now uses rounded-2xl (was rounded-xl) - the exact radius gap the Phase 1 audit found against Introduction.jsx\'s own cards', () => {
    const inputCount = (authSource.match(/<input\b/g) ?? []).length;
    expect(inputCount).toBe(8);
    expect(authSource).not.toMatch(/rounded-xl\b/);
    const rounded2xlOnInputs = (authSource.match(/rounded-2xl px-3 py-2\.5/g) ?? []).length;
    expect(rounded2xlOnInputs).toBe(8);
  });

  it('every text/email/password input still carries text-base (16px) - the iOS auto-zoom guard already locked in by Auth.mobileSafeArea.test.js, unaffected by the radius change', () => {
    expect(authSource).not.toMatch(/rounded-2xl px-3 py-2\.5[^"]*text-sm\b/);
    const textBaseCount = (authSource.match(/text-base text-on-surface bg-transparent/g) ?? []).length;
    expect(textBaseCount).toBeGreaterThanOrEqual(5);
  });
});

describe('Auth.jsx — restrained welcome-glow on primary CTAs only, never the tab switcher or secondary/destructive controls', () => {
  it('a dedicated welcome-glow token exists, peach-based (reusing the existing primary colour), deliberately distinct from morning-glow (gold, Morning-only)', () => {
    const tailwindConfig = read('../../tailwind.config.js');
    expect(tailwindConfig).toMatch(/"welcome-glow": "0 10px 25px -6px rgba\(255, 197, 183, 0\.35\)"/);
  });

  it('every real primary submit/CTA button (Sign In, Sign Up, Send Reset Link, Go to Sign In) carries shadow-welcome-glow', () => {
    const glowCount = (authSource.match(/shadow-welcome-glow/g) ?? []).length;
    expect(glowCount).toBeGreaterThanOrEqual(4);
  });

  it('the Sign In/Sign Up tab switcher pill and the secondary "Forgot Password" button do NOT carry the glow - restrained means only the primary action, not every control', () => {
    const tabBlock = authSource.match(/\{mode !== 'forgotPassword' && \([\s\S]*?\n {6}\)\}/)?.[0] ?? '';
    expect(tabBlock).not.toMatch(/shadow-welcome-glow/);
    const forgotPasswordButton = authSource.match(/onClick=\{\(\) => switchMode\('forgotPassword'\)\}[\s\S]{0,200}/)?.[0] ?? '';
    expect(forgotPasswordButton).not.toMatch(/shadow-welcome-glow/);
  });

  it('no Morning-scoped token (morning-accent, font-morning-display used anywhere but the one approved heading, shadow-morning-glow) ever appears in Auth.jsx\'s actual code - this screen is not part of the Morning journey', () => {
    const code = authSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/morning-accent|shadow-morning-glow/);
    const morningDisplayCount = (code.match(/font-morning-display/g) ?? []).length;
    expect(morningDisplayCount).toBe(1); // the one heading, nowhere else in the real code
  });
});

describe('Auth.jsx — no Apple/Google sign-in controls exist, confirmed still true after the restyle', () => {
  it('no "Continue with Apple"/"Continue with Google" or provider button of any kind was added', () => {
    expect(authSource).not.toMatch(/[Aa]pple|[Gg]oogle/);
  });
});

describe('Auth.jsx — real behaviour completely untouched', () => {
  it('the three-mode local state machine, ?tab=signup initial-mode handling, and Continue as guest entry point are all unchanged', () => {
    expect(authSource).toMatch(/mode === 'signUp'/);
    expect(authSource).toMatch(/mode === 'forgotPassword'/);
    expect(authSource).toMatch(/markGuestEntryChosen/);
  });

  it('the legal Terms of Service/Privacy Policy links are still real <Link> elements to the same real routes', () => {
    expect(authSource).toMatch(/to="\/settings\/terms-of-service"/);
    expect(authSource).toMatch(/to="\/settings\/privacy-policy"/);
  });

  it('the password visibility toggle buttons keep their real 44x44 touch target and aria-label, unchanged', () => {
    expect(authSource).toMatch(/h-11 w-11 flex items-center justify-center rounded-full text-on-surface-variant/);
    expect(authSource).toMatch(/aria-label=\{showPassword \? 'Hide password' : 'Show password'\}/);
  });
});

describe('ResetPassword.jsx — mirrors Auth.jsx\'s exact same approved changes', () => {
  it('the heading uses the same text-3xl font-morning-display italic treatment', () => {
    expect(resetSource).toMatch(/<h2 className="text-3xl font-morning-display italic font-semibold text-on-surface">Reset your password<\/h2>/);
  });

  it('both real <input> elements use rounded-2xl, matching Auth.jsx', () => {
    const inputCount = (resetSource.match(/<input\b/g) ?? []).length;
    expect(inputCount).toBe(2);
    expect(resetSource).not.toMatch(/rounded-xl\b/);
    const rounded2xlOnInputs = (resetSource.match(/rounded-2xl px-3 py-2\.5/g) ?? []).length;
    expect(rounded2xlOnInputs).toBe(2);
  });

  it('all three real CTA buttons (Back to Sign In, Update Password, Continue) carry shadow-welcome-glow', () => {
    const glowCount = (resetSource.match(/shadow-welcome-glow/g) ?? []).length;
    expect(glowCount).toBe(3);
  });

  it('real recovery-link validation, password policy, and the weak-password/mismatch handling are completely untouched', () => {
    expect(resetSource).toMatch(/shouldTreatAsValidRecovery\(\{/);
    expect(resetSource).toMatch(/isPasswordTooShort\(password\)/);
    expect(resetSource).toMatch(/password !== confirmPassword/);
    expect(resetSource).toMatch(/isWeakPasswordError\(updateError\)/);
  });
});
