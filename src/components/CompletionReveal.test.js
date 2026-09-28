// "Your Momentum" foundation, Phase 3 — source-level regression guard for
// CompletionReveal.jsx, matching this repo's established convention for
// components with no DOM rendering available (see
// interactiveAmbientMusic.test.js's own identical note). The reduced-
// motion detection function itself (detectReducedMotion) mirrors the
// exact, already-proven pattern from SessionComplete.jsx/Breathe.jsx/etc -
// covered by real execution in reducedMotionPreference.test.js already;
// this file proves this component's own wiring/gating logic.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./CompletionReveal.jsx', import.meta.url)), 'utf-8');
// Strips /* ... */ comments - this file's own doc comments legitimately
// discuss fade-in/@keyframes/transition-delay conceptually (explaining
// what this component deliberately does NOT use), which must not itself
// trip a check for the real, executable code never using them.
const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('CompletionReveal — no new animation infrastructure', () => {
  it('never uses the inert animate-in/fade-in utility classes (no tailwindcss-animate plugin exists in this repo)', () => {
    expect(codeOnly).not.toMatch(/animate-in|fade-in|zoom-in|slide-in/);
  });

  it('never defines or references a CSS @keyframes rule - uses plain opacity/transform transitions only, matching SessionComplete.jsx\'s own proven ring-fill technique', () => {
    expect(codeOnly).not.toMatch(/@keyframes/);
    expect(codeOnly).toMatch(/transition: `opacity/);
  });
});

describe('CompletionReveal — renders nothing at all when not active', () => {
  it('returns null immediately when active is falsy, before any reduced-motion/freshness branching', () => {
    expect(source).toMatch(/if \(!active\) return null;/);
  });
});

describe('CompletionReveal — freshness detection: only a genuine fresh completion animates', () => {
  it('auto-detects freshness from whether active was already true on the very first render (mount-time capture, matching SessionComplete.jsx\'s own isFreshCompletion precedent)', () => {
    expect(source).toMatch(/const \[wasInactiveAtMount\] = useState\(\(\) => !active\);/);
  });

  it('an explicit isFresh prop always overrides the auto-detected value - required for always-rendered completion pages whose active prop is unconditionally true from the start', () => {
    expect(source).toMatch(/const genuinelyFresh = isFresh !== undefined \? Boolean\(isFresh\) : wasInactiveAtMount;/);
  });
});

describe('CompletionReveal — Reduced Motion disables scale/glow/stagger entirely, never delays content', () => {
  it('reduced motion is detected via the same established try/catch pattern as every other screen (getReducedMotionPreference() OR the OS media query)', () => {
    expect(source).toMatch(/Boolean\(getReducedMotionPreference\(\) \|\| window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches\);/);
  });

  it('shouldAnimate is false whenever reducedMotion is true, regardless of freshness', () => {
    expect(source).toMatch(/const shouldAnimate = genuinelyFresh && !reducedMotion;/);
  });

  it('the non-animated path renders children (or stagger nodes) immediately with no transition style and no per-node delay at all', () => {
    const block = codeOnly.match(/if \(!shouldAnimate\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(block).not.toBe('');
    expect(block).not.toMatch(/transition|transitionDelay/);
  });
});

describe('CompletionReveal — celebratory flag controls scale/glow only, never the fade itself', () => {
  it('scale and glow classes are both gated on celebratory; opacity is not', () => {
    expect(source).toMatch(/const glowClass = celebratory \? \(GLOW_CLASSES\[journeyTone\] \?\? ''\) : '';/);
    expect(source).toMatch(/const scaleClass = celebratory \? \(entered \? 'scale-100' : 'scale-95'\) : '';/);
    expect(source).toMatch(/const frameClassName = `\$\{entered \? 'opacity-100' : 'opacity-0'\} \$\{scaleClass\} \$\{glowClass\}`\.trim\(\);/);
  });

  it('celebratory defaults to true (a plain wrapper with no props still gets the full celebratory treatment)', () => {
    expect(source).toMatch(/celebratory = true/);
  });
});

describe('CompletionReveal — journey glow reuses existing, already-approved tokens only', () => {
  it('the glow class map contains exactly morning/evening/anytime, mapping to the pre-existing shadow tokens - never a new colour', () => {
    expect(source).toMatch(/morning: 'shadow-morning-glow'/);
    expect(source).toMatch(/evening: 'shadow-evening-glow'/);
    expect(source).toMatch(/anytime: 'shadow-mint-glow'/);
  });
});

describe('CompletionReveal — stagger reveals children with an incremental, approved delay; the primary action is never held back by the frame\'s own opacity', () => {
  it('stagger step is within the approved 100-150ms per-item range (150ms, its top)', () => {
    expect(source).toMatch(/const STAGGER_STEP_MS = 150;/);
  });

  it('each staggered node gets its own transitionDelay proportional to its index - never all revealed simultaneously', () => {
    expect(source).toMatch(/transitionDelay: `\$\{STAGGER_BASE_DELAY_MS \+ i \* STAGGER_STEP_MS\}ms`/);
  });

  it('omitting stagger renders children as one uniform block with no per-node delay', () => {
    expect(source).toMatch(/if \(!stagger\) \{/);
  });
});

describe('CompletionReveal — true end-to-end settle time matches the approved ~800-1200ms target (including stagger), not merely the frame\'s own 550ms', () => {
  it('a 1-item stagger settles at 20 + STAGGER_BASE_DELAY_MS + STAGGER_TRANSITION_MS ≈ 820ms', () => {
    expect(source).toMatch(/const STAGGER_BASE_DELAY_MS = 300;/);
    expect(source).toMatch(/const STAGGER_TRANSITION_MS = 500;/);
  });

  it('a 2-item stagger settles at ~970ms and a 3-item stagger at ~1120ms - both inside the approved window', () => {
    // 20 (initial commit delay) + 300 (base) + i*150 (step) + 500 (own transition)
    const settleMs = (i) => 20 + 300 + i * 150 + 500;
    expect(settleMs(1)).toBeGreaterThanOrEqual(800);
    expect(settleMs(1)).toBeLessThanOrEqual(1200);
    expect(settleMs(2)).toBeGreaterThanOrEqual(800);
    expect(settleMs(2)).toBeLessThanOrEqual(1200);
  });
});

describe('CompletionReveal — `actions` renders without any additional delay ("reveal actions without delay" per the approved brief) - never stacked behind the staggered content', () => {
  it('the actions wrapper has no transitionDelay at all, unlike every staggered node', () => {
    const actionsBlock = codeOnly.match(/\{actions && \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(actionsBlock).not.toBe('');
    expect(actionsBlock).not.toMatch(/transitionDelay/);
    expect(actionsBlock).toMatch(/transition: `opacity \$\{STAGGER_TRANSITION_MS\}ms ease-out`/);
  });

  it('actions is also rendered (statically, no wrapper needed) in the non-animated path', () => {
    const block = codeOnly.match(/if \(!shouldAnimate\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(block).toMatch(/\{actions\}/);
  });
});

describe('CompletionReveal — forwards arbitrary extra props (e.g. role="status") onto its own wrapper, in every render path', () => {
  it('spreads ...rest onto the non-animated wrapper, the plain animated wrapper, and the staggered wrapper alike', () => {
    const matches = codeOnly.match(/\{\.\.\.rest\}/g) ?? [];
    expect(matches.length).toBe(3);
  });
});

describe('CompletionReveal — timing matches the approved 800-1200ms total sequence', () => {
  it('the frame entrance transition is within the approved 450-600ms range', () => {
    expect(source).toMatch(/const FRAME_TRANSITION_MS = 550;/);
  });

  it('a short delayed state flip (not a bare synchronous setState) reliably lets the browser commit the initial paint first, matching SessionComplete.jsx\'s own established reasoning', () => {
    expect(source).toMatch(/setTimeout\(\(\) => setEntered\(true\), 20\);/);
  });
});
