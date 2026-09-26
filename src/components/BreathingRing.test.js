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

  it('the scale/opacity/size/brightness animation timing is completely unchanged - only colour classes were touched', () => {
    expect(source).toMatch(/duration-\[4000ms\]/);
    expect(source).toMatch(/breatheState === 'Inhale' \? 'scale-125 opacity-100' : 'scale-95 opacity-50'/);
    expect(source).toMatch(/breatheState === 'Inhale' \? 'w-48 h-48' : breatheState === 'Hold' \? 'w-48 h-48 brightness-110' : 'w-36 h-36'/);
  });

  it('breatheState/secondsLeft text content is unchanged', () => {
    expect(source).toMatch(/\{breatheState\}/);
    expect(source).toMatch(/\{secondsLeft\}s left/);
  });
});

describe('real consumer wiring — each embedded journey passes its own fixed tone; standalone passes its dynamically-resolved one', () => {
  it('Breathe.jsx (Morning) passes journeyTone="morning"', () => {
    expect(breatheSource).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} journeyTone="morning" \/>/);
  });

  it('EveningBreathing.jsx passes journeyTone="evening"', () => {
    expect(eveningBreathingSource).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} journeyTone="evening" \/>/);
  });

  it('QuietBreathing.jsx standalone branch passes the dynamic journeyTone={journeyTone}', () => {
    expect(quietBreathingSource).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} journeyTone=\{journeyTone\} \/>/);
  });

  it('QuietBreathing.jsx non-standalone (Support-embedded) branch omits journeyTone entirely - stays peach, per the existing approved brief this file\'s own doc comment already documents', () => {
    const nonStandaloneReturn = quietBreathingSource.slice(quietBreathingSource.lastIndexOf('return (\n    <EveningSceneShell'));
    expect(nonStandaloneReturn).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} \/>/);
  });
});
