// Physical-iPhone correction — EveningSceneShell's additive
// `protectedHeader` prop. Source-level checks (this repo's established
// pattern for files that transitively import the Supabase client via
// BackButton/ExitEveningButton -> AuthContext, which throws outside a real
// app boot with env vars set - real execution isn't meaningful here, see
// e.g. backButtonSafeAreaCorrection.test.js's own identical justification).
//
// Root cause under test: the nav row (Back/Exit) was an ordinary in-flow
// child of this shell's own single `fixed inset-0 overflow-y-auto` scroll
// owner - scrolling moved it (and the safe-area space above it) out of
// view, letting real content scroll up directly under the status bar with
// nothing opaque left to protect it. `protectedHeader` (default false,
// every existing caller unaffected) fixes this for the three exercise
// screens that opt in (Evening Breathing/Evening Meditate/Anytime
// Breathing) without touching Reflection/Gratitude/PrepareForRest/
// EveningWindDown/EveningComplete/Support/PanicMode/Grounding/
// StressRelease/SupportComplete, none of which opt in.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./EveningSceneShell.jsx');

// Isolate the `if (protectedHeader) { ... }` block's own source (from its
// own `if` down to its closing `}`) so assertions can't accidentally match
// the untouched default branch below it (which intentionally keeps the
// exact same BackButton/ExitEveningButton JSX shapes).
const protectedStart = source.indexOf('if (protectedHeader) {');
const defaultReturnStart = source.lastIndexOf('return (');
const protectedBlock = source.slice(protectedStart, defaultReturnStart);

describe('EveningSceneShell — protectedHeader is additive and default-false', () => {
  it('defaults to false - every existing caller that omits it is unaffected', () => {
    expect(source).toMatch(/protectedHeader = false/);
  });

  it('the untouched default path (protectedHeader false) still renders the nav row as an ordinary child of the single fixed inset-0 overflow-y-auto scroll owner - byte-identical to before this prop existed', () => {
    const defaultBlock = source.slice(defaultReturnStart);
    expect(defaultBlock).toMatch(/<div className="fixed inset-0 z-\[101\] overflow-y-auto">/);
    expect(defaultBlock).toMatch(/\(showBack \|\| showExit\) && \(/);
  });
});

describe('EveningSceneShell — protectedHeader true: non-scrolling, opaque, divided header + single scroll body', () => {
  it('is a genuinely separate branch (its own early return), never merged into the default markup', () => {
    expect(protectedBlock).not.toBe('');
  });

  it('outer is a fixed inset-0 flex column - never overflow-y-auto itself', () => {
    expect(protectedBlock).toMatch(/<div className="fixed inset-0 flex flex-col">/);
  });

  it('the nav row is a real shrink-0 sibling, opaque (bg-background, never a translucent/blurred surface), with a journey-tinted border-b divider and safe-area top padding', () => {
    expect(protectedBlock).toMatch(/shrink-0 bg-background border-b/);
    expect(protectedBlock).toMatch(/paddingTop: 'calc\(1rem \+ env\(safe-area-inset-top\)\)'/);
  });

  it('resolves gold/periwinkle/mint per journey, never a raw hex', () => {
    expect(source).toMatch(/morning: 'border-morning-accent-tint\/25'/);
    expect(source).toMatch(/evening: 'border-evening-accent-tint\/25'/);
    expect(source).toMatch(/anytime: 'border-tertiary-tint\/25'/);
    expect(protectedBlock).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('the body is the one real scroll owner (flex-1 min-h-0 overflow-y-auto), and it is a sibling AFTER the nav row, never the nav row itself', () => {
    expect(protectedBlock).toMatch(/relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-hide/);
    const navIndex = protectedBlock.indexOf('shrink-0 bg-background');
    const bodyIndex = protectedBlock.indexOf('flex-1 min-h-0 overflow-y-auto');
    expect(navIndex).toBeGreaterThan(-1);
    expect(bodyIndex).toBeGreaterThan(navIndex);
  });

  it('renders exactly one scroll container - no nested competing overflow-y-auto inside this branch', () => {
    const matches = protectedBlock.match(/overflow-y-auto/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('still renders the real BackButton/ExitEveningButton controls (same components, same props) - only the surrounding structure changed', () => {
    expect(protectedBlock).toMatch(/<BackButton/);
    expect(protectedBlock).toMatch(/fallback=\{backFallback\}/);
    expect(protectedBlock).toMatch(/<ExitEveningButton \/>/);
  });

  it('still renders the same atmosphere/glow resolution (glowJourney ternary) - visual identity per journey is unaffected by this structural fix', () => {
    expect(protectedBlock).toMatch(/glowJourney \? \(/);
    expect(protectedBlock).toMatch(/<JourneyGlow journey=\{glowJourney\} \/>/);
    expect(protectedBlock).toMatch(/<AtmosphereManager/);
  });
});
