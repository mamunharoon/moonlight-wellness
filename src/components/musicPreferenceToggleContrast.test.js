// Build 15 release-quality pass — MusicPreferenceToggle OFF-track
// contrast fix. Real, computed WCAG contrast (not merely asserted),
// matching this codebase's own established precedent (see
// prepareForRest.test.js's own relLum/contrast helpers, reused verbatim
// here) plus source-level checks for the visible On/Off label and the
// preserved Off=left/On=right direction.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./MusicPreferenceToggle.jsx');
const cssSource = read('../index.css');

const relLum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
  const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
};
const contrast = (a, b) => {
  const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const KNOB_FILL = '#060e20'; // surface-container-lowest
const OLD_OFF_TRACK_COMPOSITED = '#262e3f'; // bg-white/10 over glass-panel (~#232b3c)
const NEW_OFF_TRACK = '#a28c87'; // the existing `outline` token

describe('MusicPreferenceToggle - OFF-track contrast fix, real computed WCAG math', () => {
  it('index.css already defines the outline token used for the new OFF track - no new colour introduced', () => {
    expect(cssSource).toMatch(/--color-outline: #a28c87;/);
  });

  it('the old bg-white/10 OFF track is genuinely gone from the switch track class', () => {
    expect(source).not.toMatch(/isOn \? 'bg-primary' : 'bg-white\/10'/);
  });

  it('the OFF track now uses the existing bg-outline utility, not a hand-typed hex - Morning Visual Uplift (Build 16) routed the ON track through an accent-token lookup, but OFF is still the plain bg-outline literal regardless of accent', () => {
    expect(source).toMatch(/isOn \? tokens\.track : 'bg-outline'/);
  });

  it('the default accent (\'primary\') resolves its ON track to the exact original bg-primary - every pre-existing caller (which omits `accent`) is provably unaffected by the Build 16 accent-token refactor', () => {
    expect(source).toMatch(/primary: \{ track: 'bg-primary', knobBorder: 'border-primary', focusRing: 'focus-visible:ring-primary' \}/);
  });

  it('the old OFF track (knob vs. composited bg-white/10 track) genuinely failed the WCAG AA 3:1 non-text minimum', () => {
    expect(contrast(KNOB_FILL, OLD_OFF_TRACK_COMPOSITED)).toBeLessThan(3);
  });

  it('the new OFF track (knob vs. outline token) clears the WCAG AA 3:1 non-text minimum by a wide margin', () => {
    expect(contrast(KNOB_FILL, NEW_OFF_TRACK)).toBeGreaterThanOrEqual(6);
  });
});

describe('MusicPreferenceToggle - preserved direction and ARIA, unchanged playback behaviour', () => {
  it('Off=left/On=right is preserved - the knob still translates right only when on, never re-anchored', () => {
    expect(source).toMatch(/isOn \? 'translate-x-5' : 'translate-x-0'/);
    expect(source).toMatch(/absolute left-0\.5 top-0\.5/);
  });

  it('role="switch"/aria-checked/aria-label are all unchanged - standard iPhone switch semantics preserved', () => {
    expect(source).toMatch(/role="switch"/);
    expect(source).toMatch(/aria-checked=\{isOn\}/);
    expect(source).toMatch(/aria-label=\{label\}/);
  });

  it('onToggle is unconditional (Build 18 guest pre-start-music correction) - every tap, guest or not, reaches onToggle directly, never a sign-in interception', () => {
    expect(source).toMatch(/onClick=\{onToggle\}/);
    // Scoped to the real component code, not this file's own doc comments
    // (which legitimately discuss the removed isGuest/onSignIn props in
    // prose - see the file's own Build 18 doc comment).
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/isGuest/);
    expect(codeOnly).not.toMatch(/onSignIn/);
  });
});

describe('MusicPreferenceToggle - compact visible On/Off state label', () => {
  it('renders a real "On"/"Off" text label driven by isOn, aria-hidden since aria-checked already announces state', () => {
    expect(source).toMatch(/<span className="text-\[10px\] font-bold uppercase tracking-wide text-on-surface-variant" aria-hidden="true">\s*\n\s*\{isOn \? 'On' : 'Off'\}/);
  });

  it('the label and the switch share one shrink-0 flex group, so the row layout does not grow unpredictably at narrow widths', () => {
    expect(source).toMatch(/<span className="flex items-center gap-2 shrink-0">/);
  });
});
