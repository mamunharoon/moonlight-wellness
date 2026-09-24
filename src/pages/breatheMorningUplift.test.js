// Morning Visual Uplift (Build 16) — Breathe.jsx (both the pre-start
// pattern selector and the active "Center Yourself" grounding view).
// Breathe.jsx itself is Morning-exclusive (EveningBreathing.jsx and
// QuietBreathing.jsx are separate files - see
// breathingPatternRowSharedConsumers.test.js/
// musicPreferenceToggleSharedConsumers.test.js for their own shared-
// component safety proof), so this file mainly proves the real
// functional contract is untouched, plus a deliberate, disclosed scope
// decision: BreathingRing itself (the animated visualizer) is shared
// with Evening/Anytime and has no existing accent mechanism - rather
// than add a fourth shared-component accent prop, this phase leaves its
// own peach glow untouched and only recolours the surrounding screen
// text, keeping one consistent "breathing" ring identity across every
// context it appears in.
//
// No DOM rendering is available in this repo's Vitest (environment:
// 'node' - see vite.config.js) - source-level checks, matching every
// other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./Breathe.jsx');

describe('Breathe.jsx — pre-start pattern-selection view', () => {
  it('"Mindful Breathing" eyebrow is gold; "Choose Your Breathing Practice" uses the new Playfair Display token', () => {
    expect(source).toMatch(/text-xs text-morning-accent uppercase tracking-widest font-bold">Mindful Breathing/);
    expect(source).toMatch(/text-2xl font-bold text-on-surface font-morning-display italic">Choose Your Breathing Practice/);
  });

  it('the real supporting copy is unchanged', () => {
    expect(source).toMatch(/Choose a breathing rhythm, then begin when you&rsquo;re ready\./);
  });

  it('all 5 real breathing patterns are still rendered via BreathingPatternRow with accent="morning" (shared-component safety proven separately)', () => {
    expect(source).toMatch(/\{BREATHING_PATTERNS\.map\(\(pattern\) => \(/);
    const callSite = source.match(/<BreathingPatternRow[\s\S]{0,300}\/>/)?.[0] ?? '';
    expect(callSite).toMatch(/accent="morning"/);
  });
});

describe('Breathe.jsx — active "Center Yourself" grounding view', () => {
  it('"Grounding Exercise" eyebrow is gold; "Center Yourself" uses Playfair Display - this is the real active-breathing screen text, distinct from (and not to be confused with) the 4-step journey\'s own step id "breathe"', () => {
    expect(source).toMatch(/text-xs text-morning-accent uppercase tracking-widest font-bold">Grounding Exercise/);
    expect(source).toMatch(/text-2xl font-bold text-on-surface font-morning-display italic">Center Yourself/);
  });

  it('the real supporting copy is unchanged', () => {
    expect(source).toMatch(/Bring your attention to the present before the day becomes busy\./);
  });

  it('BreathingRing itself is rendered with its original two real props only (breatheState, secondsLeft) - no accent prop added, a deliberate scope decision since it is shared with Evening/Anytime and has no existing accent mechanism', () => {
    expect(source).toMatch(/<BreathingRing breatheState=\{breatheState\} secondsLeft=\{secondsLeft\} \/>/);
  });

  it('the active pattern label pill (activePattern.supportingLabel/label) stays the neutral bg-white/5 treatment - unchanged, since it is real per-pattern data, not a decorative moment this phase targets', () => {
    expect(source).toMatch(/text-\[10px\] bg-white\/5 border border-white\/10 px-3 py-1\.5 rounded-full text-on-surface-variant\/80 font-bold uppercase tracking-wider/);
  });
});

describe('Breathe.jsx — real functional contract untouched by the restyle', () => {
  it('MusicPreferenceToggle keeps its real isOn/onToggle/description wiring alongside the new accent="morning" prop', () => {
    const callSite = source.match(/<MusicPreferenceToggle[\s\S]{0,400}\/>/)?.[0] ?? '';
    expect(callSite).toMatch(/isOn=\{musicPreferenceOn\}/);
    expect(callSite).toMatch(/description="Play gentle music during your breathing practice\."/);
    expect(callSite).toMatch(/accent="morning"/);
  });

  it('the ProgressIndicator breadcrumb is still rendered with activeStep="breathe" - the Morning gold branch lives entirely inside ProgressIndicator.jsx itself, not duplicated here', () => {
    expect(source).toMatch(/<ProgressIndicator activeStep="breathe" onReviewStep=\{requestReview\} \/>/);
  });

  it('InteractiveAmbientMusic is still the one single, stable instance across the pre-start -> active transition - unchanged', () => {
    expect(source).toMatch(/musicVariantId=\{INTERACTIVE_BREATHING_MUSIC_ID\}/);
  });
});
