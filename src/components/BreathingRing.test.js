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
  it('Breathe.jsx (Morning) passes journeyTone="morning" and the Phase 1 reducedMotion prop', () => {
    expect(breatheSource).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} journeyTone="morning" reducedMotion=\{reducedMotion\} \/>/);
  });

  it('EveningBreathing.jsx passes journeyTone="evening" and the Phase 1 reducedMotion prop', () => {
    expect(eveningBreathingSource).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} journeyTone="evening" reducedMotion=\{reducedMotion\} \/>/);
  });

  it('QuietBreathing.jsx standalone branch passes the dynamic journeyTone={journeyTone} and the Phase 1 reducedMotion prop', () => {
    expect(quietBreathingSource).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} journeyTone=\{journeyTone\} reducedMotion=\{reducedMotion\} \/>/);
  });

  it('QuietBreathing.jsx non-standalone (Support-embedded) branch omits journeyTone entirely - stays peach, per the existing approved brief this file\'s own doc comment already documents - but still passes the Phase 1 reducedMotion prop', () => {
    const nonStandaloneReturn = quietBreathingSource.slice(quietBreathingSource.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(nonStandaloneReturn).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} reducedMotion=\{reducedMotion\} \/>/);
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
