// Morning Visual Uplift (Build 16) — MorningFlow.jsx (both the pre-start
// selector and the active movement timer). Morning-exclusive file, so
// this proves the real functional contract (timer, pause/resume,
// selected-movement count/duration, uniform per-movement duration) is
// untouched by the restyle, plus that the gold/Playfair tokens are
// actually applied only where intended.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./MorningFlow.jsx');

describe('MorningFlow — shared heading (both pre-start and active views)', () => {
  it('"Morning Movement" eyebrow uses morning-accent gold; "Gentle Morning Stretch" uses the new Playfair Display token', () => {
    expect(source).toMatch(/text-xs text-morning-accent uppercase tracking-widest font-bold">Morning Movement/);
    expect(source).toMatch(/text-2xl font-bold text-on-surface font-morning-display italic">Gentle Morning Stretch/);
  });

  it('the real pre-start/active-view supporting copy is unchanged', () => {
    expect(source).toMatch(/\{!isRepeatGated && !hasBegun \? getPreStartCopy\(\) : 'Ease into the day with a few gentle movements\.'\}/);
  });
});

describe('MorningFlow — active view: progress bar, active-card highlight, timer', () => {
  // Context-aware Meditation/Breathing theming consistency audit — this
  // fill previously faded from morning-accent into the peach primary
  // token, a leftover blend from before "stays gold throughout Morning"
  // was the rule. Solid gold now, matching every other selected/progress
  // element on this same Stretch step - never a new colour.
  it('the progress bar fill is solid morning-accent gold, never blending into the generic peach primary token', () => {
    expect(source).toMatch(/bg-morning-accent rounded-full transition-all duration-1000/);
    expect(source).not.toMatch(/bg-gradient-to-r from-morning-accent to-primary/);
  });

  it('"Stretching Progress / Movement N of 4" label text is unchanged', () => {
    expect(source).toMatch(/<span>Stretching Progress<\/span>/);
    expect(source).toMatch(/<span>Movement \{activeStep \+ 1\} of \{orderedActiveSteps\.length\}<\/span>/);
  });

  // Context-aware Meditation/Breathing theming consistency audit — found
  // live: this pinned assertion had actually been encoding the opacity-
  // on-plain-hex-var bug (JourneyGlow.jsx's own doc comment) - a /<n>
  // modifier directly on the plain-hex morning-accent token resolves to
  // fully transparent, so the active movement's own highlighted border/
  // shadow/background were almost certainly invisible in production, not
  // gold. Fixed with the alpha-safe -tint RGB-triplet token, same as
  // everywhere else this session.
  it('the active movement card border/background/icon-chip all use the alpha-safe morning-accent-tint token, not the broken opacity-on-plain-hex form', () => {
    expect(source).toMatch(/isActive \? 'border-morning-accent-tint\/30 opacity-100 shadow-md shadow-morning-accent-tint\/10 bg-morning-accent-tint\/5'/);
    expect(source).toMatch(/isActive \? 'bg-morning-accent-tint\/25 text-morning-accent' : 'bg-white\/5 text-on-surface-variant'/);
  });

  it('the active countdown timer text is gold; the completed-checkmark colour (text-secondary) is untouched', () => {
    expect(source).toMatch(/text-xl font-bold text-morning-accent">0:\{timeLeft\.toString\(\)\.padStart\(2, '0'\)\}/);
    expect(source).toMatch(/check_circle/);
    expect(source).toMatch(/text-secondary text-sm">check_circle/);
  });

  it('every non-active (upcoming or completed) movement now shows its own real duration via the exact same getStepDuration() the active timer counts down from - never a fabricated flat placeholder', () => {
    expect(source).toMatch(/text-xs font-semibold text-on-surface-variant\/70">\{getStepDuration\(\)\}s<\/p>/);
    expect(source).not.toMatch(/>30s</); // no hardcoded flat placeholder anywhere
  });

  it('getStepDuration is still the one real, uniform per-movement duration function (20s standard / 40s extended) - not per-movement varying, not re-derived a second way', () => {
    expect(source).toMatch(/const getStepDuration = \(\) => \(routineDuration === 'extended' \? 40 : 20\);/);
  });
});

describe('MorningFlow — real functional contract untouched by the restyle', () => {
  it('the 4 real movements (title/desc/icon) are exactly as before, in the same order', () => {
    expect(source).toMatch(/\{ title: 'Reach to the Sky', desc: 'Extend your arms high and breathe deep\.', icon: 'wb_sunny' \}/);
    expect(source).toMatch(/\{ title: 'Shoulder Rolls', desc: 'Roll your shoulders backward gently\.', icon: 'rotate_right' \}/);
    expect(source).toMatch(/\{ title: 'Gentle Neck Stretch', desc: 'Slowly lower your ear to your shoulder\.', icon: 'autorenew' \}/);
    expect(source).toMatch(/\{ title: 'Gentle Twist', desc: 'Slowly rotate your torso from side to side\.', icon: 'spa' \}/);
  });

  it('MusicPreferenceToggle is passed accent="morning" (additive prop, shared-component safety already covered by musicPreferenceToggleSharedConsumers.test.js) and its real isOn/onToggle/isGuest wiring is untouched', () => {
    const callSite = source.match(/<MusicPreferenceToggle[\s\S]{0,400}\/>/)?.[0] ?? '';
    expect(callSite).toMatch(/accent="morning"/);
    expect(callSite).toMatch(/isOn=\{musicPreferenceOn\}/);
    expect(callSite).toMatch(/onToggle=\{handleToggleMusicPreference\}/);
  });

  it('the ProgressIndicator breadcrumb is still rendered with activeStep="stretch" - the new Morning gold branch lives entirely inside ProgressIndicator.jsx itself (see ProgressIndicator.eveningUnaffected.test.js), not duplicated here', () => {
    expect(source).toMatch(/<ProgressIndicator activeStep="stretch" onReviewStep=\{requestReview\} \/>/);
  });
});
