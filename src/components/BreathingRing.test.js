// Context-aware Meditation/Breathing theming — BreathingRing.jsx.
// Source-level regression guard (no DOM rendering in this repo's Vitest -
// see signOutIsolation.test.js's own note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./BreathingRing.jsx');
const breatheSource = read('../pages/Breathe.jsx');
const eveningBreathingSource = read('../pages/EveningBreathing.jsx');
const quietBreathingSource = read('../pages/QuietBreathing.jsx');

describe('BreathingRing — one shared component, four tones, never three separate rings', () => {
  it('journeyTone defaults to \'primary\' - the original warm coral gradient/glow, byte-identical to before this prop existed', () => {
    expect(source).toMatch(/journeyTone = 'primary'/);
    expect(source).toMatch(/orb: 'bg-gradient-to-br from-\[#954835\] to-\[#ff9d85\] shadow-primary\/10'/);
    expect(source).toMatch(/glow: 'bg-primary\/10'/);
    expect(source).toMatch(/text: 'text-white'/);
  });

  it('morning/anytime/evening each reuse an already-approved solid accent token and its own already-contrast-verified on-<accent> text pairing - never a fresh hex value', () => {
    expect(source).toMatch(/orb: 'bg-morning-accent shadow-morning-accent-tint\/20'/);
    expect(source).toMatch(/text: 'text-on-morning-accent'/);
    expect(source).toMatch(/orb: 'bg-tertiary shadow-tertiary-tint\/20'/);
    expect(source).toMatch(/text: 'text-on-tertiary'/);
    expect(source).toMatch(/orb: 'bg-evening-accent shadow-evening-accent-tint\/20'/);
    expect(source).toMatch(/text: 'text-on-evening-accent'/);
    // The opacity-on-plain-hex-var bug (JourneyGlow.jsx's own doc
    // comment) - the RING_TOKENS map's own orb/glow entries only ever
    // carry a /<n> modifier on a -tint token, never directly on a plain
    // morning-accent/tertiary/evening-accent token.
    const tokensBlock = source.match(/const RING_TOKENS = \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(tokensBlock).not.toBe('');
    expect(tokensBlock).not.toMatch(/bg-morning-accent\/\d/);
    expect(tokensBlock).not.toMatch(/bg-evening-accent\/\d/);
    expect(tokensBlock).not.toMatch(/bg-tertiary\/\d/);
  });

  it('an unknown/omitted tone falls back to primary, never undefined classes', () => {
    expect(source).toMatch(/RING_TOKENS\[journeyTone\] \|\| RING_TOKENS\.primary/);
  });

  it('the scale/opacity/size/brightness animation timing is completely unchanged when motion is not reduced', () => {
    expect(source).toMatch(/duration-\[4000ms\]/);
    expect(source).toMatch(/breatheState === 'Inhale' \? 'scale-125 opacity-100' : 'scale-95 opacity-50'/);
    expect(source).toMatch(/breatheState === 'Inhale' \? 'w-48 h-48' : breatheState === 'Hold' \? 'w-48 h-48 brightness-110' : 'w-36 h-36'/);
  });

  it('breatheState/secondsLeft text content is unchanged', () => {
    expect(source).toMatch(/\{breatheState\}/);
    expect(source).toMatch(/\{secondsLeft\}s left/);
  });
});

// WakeWise Phase 1 — BreathingRing label contrast + Reduced Motion.
describe('BreathingRing — Phase 1 label contrast correction', () => {
  it('the primary tone gets an opaque label scrim; morning/anytime/evening do not (their on-<accent> pairing already passes)', () => {
    expect(source).toMatch(/labelScrim:\s*'bg-black\/60'/);
    const tokensBlock = source.match(/const RING_TOKENS = \{[\s\S]*?\n\};/)?.[0] ?? '';
    const nonPrimaryBlock = tokensBlock.slice(tokensBlock.indexOf('morning:'));
    expect((nonPrimaryBlock.match(/labelScrim:\s*null/g) || []).length).toBe(3);
  });

  it('the label/subtext are wrapped in the scrim only when one is defined for the active tone', () => {
    expect(source).toMatch(/tokens\.labelScrim \? `\$\{tokens\.labelScrim\} rounded-2xl px-4 py-1\.5 flex flex-col items-center` : 'flex flex-col items-center'/);
  });

  it('subtext opacity was raised off the previously-failing text-white/60', () => {
    expect(source).toMatch(/subtext: 'text-white\/80'/);
    expect(source).not.toMatch(/subtext: 'text-white\/60'/);
  });
});

describe('BreathingRing — Phase 1 Reduced Motion correction', () => {
  it('accepts a reducedMotion prop, defaulting to false (unchanged behaviour when omitted)', () => {
    expect(source).toMatch(/reducedMotion = false/);
  });

  it('removes the glow pulse and fixes the orb at a stable middle size when reducedMotion is true', () => {
    expect(source).toMatch(/glowMotionClasses = reducedMotion\s*\n\s*\? 'opacity-70'/);
    expect(source).toMatch(/orbSizeClasses = reducedMotion\s*\n\s*\? 'w-44 h-44'/);
  });

  it('the breathing phase name keeps rendering unconditionally regardless of reducedMotion, so the phase change stays legible from text alone', () => {
    const orbReturn = source.slice(source.indexOf('return ('));
    expect(orbReturn).toMatch(/\{breatheState\}/);
  });
});

describe('real consumer wiring — each embedded journey passes its own fixed tone; standalone passes its dynamically-resolved one', () => {
  it('Breathe.jsx (Morning) passes journeyTone="morning", the Phase 1 reducedMotion prop, and the B68 freeze prop fed isCompleted', () => {
    expect(breatheSource).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} journeyTone="morning" reducedMotion=\{reducedMotion\} freeze=\{isCompleted\} \/>/);
  });

  it('EveningBreathing.jsx passes journeyTone="evening", the Phase 1 reducedMotion prop, and the B68 freeze prop fed isCompleted', () => {
    expect(eveningBreathingSource).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} journeyTone="evening" reducedMotion=\{reducedMotion\} freeze=\{isCompleted\} \/>/);
  });

  it('QuietBreathing.jsx standalone branch passes the dynamic journeyTone={journeyTone}, the Phase 1 reducedMotion prop, and the B68 freeze prop fed isCompleted || earlyEnded (the same flag its own exit-fade wrapper already uses)', () => {
    expect(quietBreathingSource).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} journeyTone=\{journeyTone\} reducedMotion=\{reducedMotion\} freeze=\{isCompleted \|\| earlyEnded\} \/>/);
  });

  it('QuietBreathing.jsx non-standalone (Support-embedded) branch omits journeyTone entirely - stays peach, per the existing approved brief this file\'s own doc comment already documents - but still passes the Phase 1 reducedMotion prop', () => {
    const nonStandaloneReturn = quietBreathingSource.slice(quietBreathingSource.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(nonStandaloneReturn).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} reducedMotion=\{reducedMotion\} \/>/);
  });
});

// B68 device feedback — completion transitions appeared acceptable but
// Meditation felt smoother than Breathing/Stretching. Root-caused (not
// guessed) to BreathingRing's own 4000ms glow/orb transition, which can
// still be mid-flight the instant natural completion freezes breatheState -
// 16x longer than the 250ms completion exit-fade this ring sits inside, and
// far longer than the ~1s tick cadence that drives it. Stretching's own
// progress-bar/card-border transitions were checked too (stretchSession.js's
// advanceMovement() leaves activeIndex unchanged on the completing tick, so
// neither ever starts a fresh transition at completion) - confirmed to need
// no equivalent change.
describe('BreathingRing — B68 completion-freeze correction (DEV-only)', () => {
  it('accepts a freeze prop defaulting to false (unchanged behaviour when omitted)', () => {
    expect(source).toMatch(/freeze = false/);
  });

  it('the freeze effect is skipped entirely under reducedMotion (nothing is transitioning there to freeze) and never re-measures once already frozen', () => {
    const effectBlock = source.match(/useLayoutEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[freeze, reducedMotion, frozenStyle\]\);/)?.[0] ?? '';
    expect(effectBlock).not.toBe('');
    expect(effectBlock).toMatch(/if \(!freeze \|\| reducedMotion \|\| frozenStyle\) return;/);
  });

  it('captures the ACTUAL current rendered opacity/transform (glow) and width/height/filter (orb) via getComputedStyle - never a hardcoded/target value', () => {
    const effectBlock = source.match(/useLayoutEffect\(\(\) => \{[\s\S]*?\n {2}\}, \[freeze, reducedMotion, frozenStyle\]\);/)?.[0] ?? '';
    expect(effectBlock).toMatch(/getComputedStyle\(glow\)/);
    expect(effectBlock).toMatch(/getComputedStyle\(orb\)/);
    expect(effectBlock).toMatch(/opacity: glowComputed\.opacity, transform: glowComputed\.transform, transition: 'none'/);
    expect(effectBlock).toMatch(/width: orbComputed\.width, height: orbComputed\.height, filter: orbComputed\.filter, transition: 'none'/);
  });

  it('the glow/orb divs keep their existing animated classes untouched (pre-freeze behaviour and timing are byte-identical) and only gain a ref plus an inline style that is null until frozen', () => {
    expect(source).toMatch(/<div ref=\{glowRef\} className=\{`absolute inset-0 rounded-full \$\{tokens\.glow\} blur-3xl \$\{glowMotionClasses\}`\} style=\{frozenStyle\?\.glow\}><\/div>/);
    expect(source).toMatch(/<div ref=\{orbRef\} className=\{`rounded-full \$\{tokens\.orb\} flex flex-col items-center justify-center shadow-xl \$\{tokens\.text\} \$\{orbSizeClasses\}`\} style=\{frozenStyle\?\.orb\}>/);
    expect(source).toMatch(/transition-all duration-\[4000ms\]/);
  });

  it('once frozen, the inline style carries transition: none - so a frozen ring never resumes animating even if re-rendered again while isCompleted stays true', () => {
    expect(source).toMatch(/transition: 'none'/g);
  });
});

describe('BreathingRing — Phase 1 Reduced Motion consumer wiring', () => {
  it('each real caller resolves reducedMotion via the same OS-or-manual-preference snapshot SelfGuidedMeditation.jsx already uses', () => {
    const snapshotPattern = /const \[reducedMotion\] = useState\(\(\) => \{\s*try \{\s*return Boolean\(getReducedMotionPreference\(\) \|\| window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches\);\s*\} catch \{\s*return false;\s*\}\s*\}\);/;
    expect(breatheSource).toMatch(snapshotPattern);
    expect(breatheSource).toMatch(/import \{ getReducedMotionPreference \} from '..\/lib\/reducedMotionPreference';/);
    expect(eveningBreathingSource).toMatch(snapshotPattern);
    expect(eveningBreathingSource).toMatch(/import \{ getReducedMotionPreference \} from '..\/lib\/reducedMotionPreference';/);
    expect(quietBreathingSource).toMatch(snapshotPattern);
    expect(quietBreathingSource).toMatch(/import \{ getReducedMotionPreference \} from '..\/lib\/reducedMotionPreference';/);
  });
});
