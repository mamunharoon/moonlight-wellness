// Regression guard for the route-transition scroll-lock defect diagnosed
// live (Evening Breathing -> Prepare for Rest, and every other
// EveningSceneShell-based page): Gradient.jsx hardcoded `relative` on its
// outer div regardless of the caller's own className, so when
// EveningSceneShell asked it to be `fixed inset-0 ... overflow-y-auto`,
// Tailwind's compiled rule order let `.relative` win over `.fixed` (both
// target `position`), leaving the intended scroll owner at
// `position: relative` with no fixed-size box to scroll - reproduced live
// via getComputedStyle on Prepare for Rest (position: relative, height
// equal to full unscrolled content, not the viewport). Root-caused via a
// real browser session, confirmed via a real wheel-scroll test after the
// fix (scrollTop 0 -> 500 -> 760, bottom reached). Locked in here at the
// source level per this repo's existing pattern (see index.css.test.js's
// own note on no DOM/computed-style evaluation being available in this
// repo's Node-environment Vitest).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const gradientSource = read('../stage3/Gradient.jsx');
const shellSource = read('./EveningSceneShell.jsx');

describe('Gradient.jsx - never emits two conflicting position utilities on the same element', () => {
  it('only falls back to its own "relative" when the caller className does not already set fixed/absolute/sticky', () => {
    expect(gradientSource).toMatch(/const CALLER_SETS_OWN_POSITION = \/\\b\(\?:fixed\|absolute\|sticky\)\\b\/;/);
    expect(gradientSource).toMatch(/const positionClass = CALLER_SETS_OWN_POSITION\.test\(className\) \? '' : 'relative';/);
  });

  it('the outer div interpolates the conditional positionClass, never a hardcoded "relative"', () => {
    expect(gradientSource).toMatch(/<div className=\{`\$\{positionClass\} overflow-hidden \$\{className\}`\}>/);
    expect(gradientSource).not.toMatch(/<div className=\{`relative overflow-hidden \$\{className\}`\}>/);
  });
});

describe('EveningSceneShell.jsx - one explicit, consistent scroll owner per evening page, separate from the decorative atmosphere', () => {
  it('renders AtmosphereManager as a pointer-events-none, non-scrolling decorative layer', () => {
    const atmosphereBlock = shellSource.match(/<AtmosphereManager[\s\S]*?\/>/)?.[0] ?? '';
    expect(atmosphereBlock).toMatch(/pointer-events-none/);
    expect(atmosphereBlock).toMatch(/fixed inset-0/);
    expect(atmosphereBlock).not.toMatch(/overflow-y-auto/);
  });

  it('AtmosphereManager renders with no children of its own - it can never become a scroll owner wrapping real content', () => {
    expect(shellSource).toMatch(/<AtmosphereManager\s+\{\.\.\.atmosphere\}\s+className=\{[\s\S]*?\}\s*\/>/);
  });

  it('has exactly one dedicated fixed + overflow-y-auto scroll-owner div, a sibling of AtmosphereManager (not its child)', () => {
    const scrollOwnerMatches = shellSource.match(/className="fixed inset-0[^"]*overflow-y-auto[^"]*"/g) ?? [];
    expect(scrollOwnerMatches.length).toBe(1);
  });

  it('showBack and the real page content both render inside the scroll-owner div, not inside AtmosphereManager', () => {
    const scrollOwnerOpenIndex = shellSource.indexOf('<div className="fixed inset-0 z-[101] overflow-y-auto">');
    const atmosphereTagIndex = shellSource.indexOf('<AtmosphereManager');
    expect(scrollOwnerOpenIndex).toBeGreaterThan(-1);
    expect(scrollOwnerOpenIndex).toBeGreaterThan(atmosphereTagIndex);
    expect(shellSource.indexOf('{showBack &&')).toBeGreaterThan(scrollOwnerOpenIndex);
    expect(shellSource.indexOf('{content}')).toBeGreaterThan(scrollOwnerOpenIndex);
  });
});
