// Bottom Navigation Visual Uplift — regression coverage for the Stitch-
// sourced restyle of Layout.jsx's shared floating bottom nav. Source-level
// checks - this repo's Vitest has no rendering engine (environment: 'node'
// - see vite.config.js), matching every other regression guard in this
// codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const layoutSource = readFileSync(fileURLToPath(new URL('./Layout.jsx', import.meta.url)), 'utf-8');
const navItemsBlock = layoutSource.match(/const navItems = \[[\s\S]*?\];/)?.[0] ?? '';
const navTagMatch = layoutSource.match(/<nav className="[^"]*"[^>]*>/)?.[0] ?? '';
const linkClassNameMatch = layoutSource.match(/className=\{`flex-1 min-w-\[44px\][\s\S]*?`\}/)?.[0] ?? '';

describe('Bottom Navigation Visual Uplift — 1. all three destinations remain present', () => {
  it('navItems is still exactly Home, Library, Profile - no more, no less', () => {
    const labels = [...navItemsBlock.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
    expect(labels).toEqual(['Home', 'Library', 'Profile']);
  });
});

describe('Bottom Navigation Visual Uplift — 2. the correct item receives the active treatment on each route', () => {
  it('isActive is still derived from location.pathname === item.path (with the existing "/" -> "/today" alias), unchanged', () => {
    expect(layoutSource).toMatch(/const isActive = location\.pathname === item\.path \|\| \(item\.path === '\/' && location\.pathname === '\/today'\);/);
  });

  it('the active ternary is keyed on that same isActive value for both colour and font-weight', () => {
    expect(linkClassNameMatch).toMatch(/isActive \? 'text-primary' : 'text-on-surface hover:text-primary active:bg-white\/5'/);
    expect(layoutSource).toMatch(/\$\{isActive \? 'font-bold' : 'font-semibold'\}/);
  });
});

describe('Bottom Navigation Visual Uplift — 3. active icon and label use the approved peach treatment', () => {
  it('active state resolves to text-primary (the app\'s own existing peach CTA token) - never a new/duplicate colour', () => {
    expect(linkClassNameMatch).toMatch(/text-primary/);
  });

  it('the old dark-brown pairing (bg-primary-container/on-primary-container, on-primary-container resolving to #783221) is gone', () => {
    // Comments stripped first - this file's own doc comment legitimately
    // names both classes in prose, explaining what was removed and why.
    const codeOnly = layoutSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/bg-primary-container/);
    expect(codeOnly).not.toMatch(/text-on-primary-container/);
  });

  it('no background fill or glow was added to the active item - none of the three Stitch Home references show one (icon/text colour change only)', () => {
    expect(linkClassNameMatch).not.toMatch(/isActive \? '[^']*\b(bg-|shadow-)/);
  });
});

describe('Bottom Navigation Visual Uplift — 4. inactive items remain accessible and visibly distinct', () => {
  it('inactive resolves to text-on-surface - the app\'s own existing bright, readable body-text token - never the old muddy/brown on-surface-variant', () => {
    expect(linkClassNameMatch).toMatch(/text-on-surface hover:text-primary/);
    expect(linkClassNameMatch).not.toMatch(/text-on-surface-variant/);
  });

  it('active and inactive are never the same colour token, so the two states are always visibly distinct', () => {
    const activeColour = linkClassNameMatch.match(/isActive \? '(text-[a-z-]+)'/)?.[1];
    const inactiveColour = linkClassNameMatch.match(/: '(text-[a-z-]+)/)?.[1];
    expect(activeColour).toBeTruthy();
    expect(inactiveColour).toBeTruthy();
    expect(activeColour).not.toBe(inactiveColour);
  });
});

describe('Bottom Navigation Visual Uplift — 5. all targets remain at least 44px', () => {
  it('every nav item keeps its explicit min-w-[44px] min-h-[44px]', () => {
    expect(layoutSource).toMatch(/flex-1 min-w-\[44px\] min-h-\[44px\]/);
  });
});

describe('Bottom Navigation Visual Uplift — 6. safe-area padding remains intact', () => {
  it('the nav\'s own bottom offset still adds env(safe-area-inset-bottom)', () => {
    expect(navTagMatch).toMatch(/bottom:\s*'calc\(1rem \+ env\(safe-area-inset-bottom\)\)'/);
  });

  it('the bottom-nav clearance arithmetic (marginBottom/paddingBottom proof) is untouched - h-[72px] and the nav\'s own bottom offset are unchanged, so Layout.safeArea.test.js\'s own geometry proof still holds without modification', () => {
    expect(navTagMatch).toMatch(/h-\[72px\]/);
  });
});

describe('Bottom Navigation Visual Uplift — 7. no raw Material Symbol names appear', () => {
  it('icons are still rendered through the material-symbols-outlined font class with the icon key interpolated as {item.icon}, never a literal icon-name string in visible text', () => {
    expect(layoutSource).toMatch(/<span className="material-symbols-outlined text-\[24px\]"[\s\S]*?\{item\.icon\}/);
    expect(layoutSource).not.toMatch(/>home_health<|>video_library<|>person</);
  });
});

describe('Bottom Navigation Visual Uplift — 8. routes and callbacks are unchanged', () => {
  it('the three routes/icons in navItems are byte-identical to before this pass', () => {
    expect(navItemsBlock).toMatch(/\{ label: 'Home', path: '\/', icon: 'home_health' \}/);
    expect(navItemsBlock).toMatch(/\{ label: 'Library', path: '\/library', icon: 'video_library' \}/);
    expect(navItemsBlock).toMatch(/\{ label: 'Profile', path: '\/profile', icon: 'person' \}/);
  });

  it('the same-tab no-op guard, aria-current, and <Link> wiring are all unchanged', () => {
    expect(layoutSource).toMatch(/onClick=\{\(e\) => \{ if \(isActive\) e\.preventDefault\(\); \}\}/);
    expect(layoutSource).toMatch(/aria-current=\{isActive \? 'page' : undefined\}/);
    expect(layoutSource).toMatch(/<Link\s*\n\s*key=\{item\.path\}\s*\n\s*to=\{item\.path\}/);
  });
});

describe('Bottom Navigation Visual Uplift — surface treatment reuses existing tokens, matches the Stitch source', () => {
  it('the nav surface is a near-midnight, more opaque background (rgba derived from the existing surface-lowest hex #060e20) with backdrop-blur, a neutral shadow-2xl, and a restrained border - never the old warm-brown shadow', () => {
    expect(navTagMatch).toMatch(/backdrop-blur-xl/);
    expect(navTagMatch).toMatch(/shadow-2xl/);
    expect(navTagMatch).toMatch(/border border-white\/10/);
    expect(navTagMatch).not.toMatch(/shadow-\[0_10px_20px_rgba\(149,72,53/);
  });

  it('the shared .glass-panel class is deliberately not used on the nav (its own plain-CSS background would silently win over a same-specificity Tailwind bg-* utility) - an inline backgroundColor is used instead, so every OTHER glass-panel surface in the app is completely unaffected', () => {
    expect(navTagMatch).not.toMatch(/glass-panel/);
    expect(navTagMatch).toMatch(/backgroundColor: 'rgba\(6, 14, 32, 0\.9\)'/);
  });
});
