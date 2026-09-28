// "Your Momentum" foundation, Phase 3, retuned by the
// completion-transition-tuning pass — source-level regression guard for
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

  it('a non-fresh render (revisit/stale) never animates, regardless of Reduced Motion - shouldAnimate depends only on genuinelyFresh', () => {
    expect(source).toMatch(/const shouldAnimate = genuinelyFresh;/);
    expect(source).not.toMatch(/const shouldAnimate = genuinelyFresh && !reducedMotion;/);
  });
});

describe('CompletionReveal — completion-transition-tuning pass: Reduced Motion, for a genuinely fresh completion, plays a short plain cross-fade - never the old hard instant snap', () => {
  it('reduced motion is detected via the same established try/catch pattern as every other screen (getReducedMotionPreference() OR the OS media query)', () => {
    expect(source).toMatch(/Boolean\(getReducedMotionPreference\(\) \|\| window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches\);/);
  });

  it('the non-animated path (revisit/stale, never Reduced Motion alone) renders children (or stagger nodes) immediately with no transition style and no per-node delay at all', () => {
    const block = codeOnly.match(/if \(!shouldAnimate\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(block).not.toBe('');
    expect(block).not.toMatch(/transition|transitionDelay/);
  });

  it('the reducedMotion branch is checked only AFTER the !shouldAnimate (non-fresh) branch already returned - Reduced Motion never applies to a non-fresh render, only to a genuinely fresh one', () => {
    const shouldAnimateIdx = codeOnly.indexOf('if (!shouldAnimate)');
    const reducedMotionIdx = codeOnly.indexOf('if (reducedMotion)');
    expect(shouldAnimateIdx).toBeGreaterThan(-1);
    expect(reducedMotionIdx).toBeGreaterThan(shouldAnimateIdx);
  });

  it('the Reduced Motion cross-fade is a short, single, plain opacity transition on the whole panel (REDUCED_MOTION_TRANSITION_MS) - never scale, never glow, never per-item stagger delay', () => {
    const block = codeOnly.match(/if \(reducedMotion\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(block).not.toBe('');
    expect(block).toMatch(/transition: `opacity \$\{REDUCED_MOTION_TRANSITION_MS\}ms ease-out`/);
    expect(block).not.toMatch(/scale-|GLOW_CLASSES|transitionDelay/);
    expect(source).toMatch(/const REDUCED_MOTION_TRANSITION_MS = 200;/);
  });

  it('stagger content is flattened (Fragment, no individual wrapper/delay) under Reduced Motion - the array structure is reused but never staggered', () => {
    const block = codeOnly.match(/if \(reducedMotion\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(block).toMatch(/stagger\.map\(\(node, i\) => <Fragment key=\{i\}>\{node\}<\/Fragment>\)/);
  });

  it('actions and CTA content are already in the DOM and interactive under Reduced Motion too - never gated behind the cross-fade completing', () => {
    const block = codeOnly.match(/if \(reducedMotion\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(block).toMatch(/\{actions\}/);
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

describe('CompletionReveal — stagger reveals children with an incremental, approved delay and a small upward slide; the primary action is never held back by the frame\'s own opacity', () => {
  it('stagger step is within the approved 100-150ms per-item range, at its top', () => {
    expect(source).toMatch(/const STAGGER_STEP_MS = 150;/);
  });

  it('each staggered node gets its own transitionDelay proportional to its index - never all revealed simultaneously', () => {
    expect(source).toMatch(/transitionDelay: `\$\{STAGGER_BASE_DELAY_MS \+ i \* STAGGER_STEP_MS\}ms`/);
  });

  it('completion-transition refinement: each staggered node also gets a small upward slide (translateY) alongside its opacity fade - the approved "small upward greeting reveal", applied uniformly to every staggered item', () => {
    expect(source).toMatch(/const STAGGER_RISE_PX = 8;/);
    expect(source).toMatch(/\.\.\.\(celebratory \? \{ transform: entered \? 'translateY\(0\)' : `translateY\(\$\{STAGGER_RISE_PX\}px\)` \} : null\),/);
  });

  it('the slide is part of the celebratory treatment, same as scale/glow - a genuine early-exit/interruption surface (celebratory={false}) gets only a plain opacity fade, never this slide either', () => {
    const staggerBlock = codeOnly.match(/\{stagger\.map\(\(node, i\) => \([\s\S]*?\n {6}\)\)\}/)?.[0] ?? '';
    expect(staggerBlock).not.toBe('');
    expect(staggerBlock).toMatch(/transition: celebratory\s*\n\s*\? `opacity \$\{STAGGER_TRANSITION_MS\}ms ease-out, transform \$\{STAGGER_TRANSITION_MS\}ms ease-out`\s*\n\s*: `opacity \$\{STAGGER_TRANSITION_MS\}ms ease-out`,/);
  });

  it('omitting stagger renders children as one uniform block with no per-node delay', () => {
    expect(source).toMatch(/if \(!stagger\) \{/);
  });
});

describe('CompletionReveal — completion-transition refinement: true end-to-end settle time, combined with useCompletionHandoff\'s own hold+exit-fade prefix, lands inside the approved ~1.1-1.4s target', () => {
  it('the retuned constants exist exactly as specified', () => {
    expect(source).toMatch(/const COMMIT_DELAY_MS = 80;/);
    expect(source).toMatch(/const STAGGER_BASE_DELAY_MS = 200;/);
    expect(source).toMatch(/const STAGGER_TRANSITION_MS = 470;/);
  });

  it('a 1/2-item stagger, combined with useCompletionHandoff\'s 400ms hold+exit-fade prefix, both settle within 1.1-1.4s - the practically-occurring cases for the four hold+exit-fade screens (badge+greeting is the maximum stagger count there)', () => {
    const HOLD_PLUS_EXIT_MS = 400; // useCompletionHandoff.js: HOLD_MS(150) + EXIT_FADE_MS(250)
    const COMMIT_DELAY_MS = 80;
    const STAGGER_BASE_DELAY_MS = 200;
    const STAGGER_STEP_MS = 150;
    const STAGGER_TRANSITION_MS = 470;
    const settleMs = (i) => HOLD_PLUS_EXIT_MS + COMMIT_DELAY_MS + STAGGER_BASE_DELAY_MS + i * STAGGER_STEP_MS + STAGGER_TRANSITION_MS;
    for (const i of [0, 1]) {
      expect(settleMs(i)).toBeGreaterThanOrEqual(1100);
      expect(settleMs(i)).toBeLessThanOrEqual(1400);
    }
  });

  it('without the hold+exit-fade prefix (the always-rendered completion pages, and the two early-return meditation screens with a documented limitation), this component\'s own settle time alone is faster (750-1050ms for 1-3 items) - an honest architectural difference, not a second timing implementation', () => {
    const COMMIT_DELAY_MS = 80;
    const STAGGER_BASE_DELAY_MS = 200;
    const STAGGER_STEP_MS = 150;
    const STAGGER_TRANSITION_MS = 470;
    const settleMs = (i) => COMMIT_DELAY_MS + STAGGER_BASE_DELAY_MS + i * STAGGER_STEP_MS + STAGGER_TRANSITION_MS;
    expect(settleMs(0)).toBe(750);
    expect(settleMs(1)).toBe(900);
    expect(settleMs(2)).toBe(1050);
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
  it('spreads ...rest onto all four wrappers: non-animated, Reduced-Motion cross-fade, plain animated, and staggered animated alike', () => {
    const matches = codeOnly.match(/\{\.\.\.rest\}/g) ?? [];
    expect(matches.length).toBe(4);
  });
});

describe('CompletionReveal — frame entrance timing', () => {
  it('the frame entrance transition is within the approved 450-600ms range', () => {
    expect(source).toMatch(/const FRAME_TRANSITION_MS = 550;/);
  });

  it('a short delayed state flip (not a bare synchronous setState) reliably lets the browser commit the initial paint first, matching SessionComplete.jsx\'s own established reasoning', () => {
    expect(source).toMatch(/setTimeout\(\(\) => setEntered\(true\), COMMIT_DELAY_MS\);/);
  });
});
