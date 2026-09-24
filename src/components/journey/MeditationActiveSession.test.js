// Source-level regression guard for MeditationActiveSession.jsx - the
// shared active-session screen extracted from SelfGuidedMeditation.jsx
// (Journey Embedding, Phase 2). Standalone's own exact copy is the
// component's default `endCopy`; Morning/Evening embedded callers override
// it (see MorningMeditate.test.js/EveningMeditate.test.js).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./MeditationActiveSession.jsx', import.meta.url)), 'utf-8');

describe('MeditationActiveSession — Back always routes through this component\'s own local leave-confirmation; Close does too UNLESS the caller provides onRequestClose', () => {
  it('JourneyHeader\'s onStepBack always opens the local confirm dialog directly - never overridable', () => {
    const block = source.match(/<JourneyHeader[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/showBackButton=\{false\}/);
    expect(block).toMatch(/onStepBack=\{\(\) => setLeaveConfirmOpen\(true\)\}/);
  });

  it('onClose falls back to the same local dialog only when the caller omits onRequestClose - a caller-provided onRequestClose bypasses the local dialog entirely (Morning\'s own separate "Leave this routine?" flow)', () => {
    const block = source.match(/<JourneyHeader[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/onClose=\{onRequestClose \?\? \(\(\) => setLeaveConfirmOpen\(true\)\)\}/);
  });

  it('never navigates itself - onRequestLeave is only ever called from the confirm dialog\'s own onConfirm, after the caller decides what "leaving" means', () => {
    // Comments stripped first - this file's own doc comment legitimately
    // says "never calls navigate() itself" in prose.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/navigate\(/);
    expect(codeOnly).not.toMatch(/from 'react-router-dom'/);
    expect(source).toMatch(/const handleConfirmLeave = \(\) => \{\s*\n\s*setLeaveConfirmOpen\(false\);\s*\n\s*onRequestLeave\(\);\s*\n\s*\};/);
  });
  // "never calls leaveActiveRoutine/interruptSession itself" is covered by
  // the dedicated onRequestClose describe block below, which states the
  // reasoning precisely (only a caller-supplied onRequestClose can ever
  // reach a whole-journey exit - this file never defines one itself).
});

describe('MeditationActiveSession — showHeaderClose (additive; default true, standalone/Morning unaffected)', () => {
  it('defaults to true and is forwarded to JourneyHeader as showCloseButton - a caller that omits the prop (standalone, Morning) keeps rendering both Back and Close in this component\'s own header, byte-identical to before this fix', () => {
    expect(source).toMatch(/showHeaderClose = true/);
    expect(source).toMatch(/showCloseButton=\{showHeaderClose\}/);
  });
});

describe('MeditationActiveSession — onRequestClose (additive, optional; standalone and Evening both omit it)', () => {
  it('is destructured as a plain optional prop, no default value - undefined when the caller omits it', () => {
    const propsBlock = source.match(/export const MeditationActiveSession = \(\{[\s\S]*?\}\) => \{/)?.[0] ?? '';
    expect(propsBlock).toMatch(/onRequestClose,/);
    expect(propsBlock).not.toMatch(/onRequestClose = /);
  });

  it('the big End Meditation button and onStepBack are both unaffected by onRequestClose - they always open the local dialog regardless', () => {
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).toMatch(/onClick=\{\(\) => setLeaveConfirmOpen\(true\)\}\s*\n\s*aria-label=\{copy\.buttonAriaLabel\}/);
  });

  it('End Meditation preserving only-meditation semantics: neither this component nor its local dialog ever calls leaveActiveRoutine/interruptSession - only onRequestClose (a caller-supplied function this file never defines) can reach a whole-journey exit', () => {
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/leaveActiveRoutine/);
    expect(codeOnly).not.toMatch(/interruptSession/);
  });
});

describe('MeditationActiveSession — default (standalone) leave-confirmation copy is byte-identical to the pre-extraction original', () => {
  it('default title, message and both action labels match exactly', () => {
    expect(source).toMatch(/buttonLabel: 'End Session'/);
    expect(source).toMatch(/buttonAriaLabel: 'End meditation session'/);
    expect(source).toMatch(/dialogTitle: 'Leave meditation\?'/);
    expect(source).toMatch(/dialogMessage: 'Your current meditation will end\.'/);
    expect(source).toMatch(/confirmLabel: 'End and Leave'/);
    expect(source).toMatch(/cancelLabel: 'Continue Meditation'/);
  });

  it('endCopy is an additive override (caller-supplied fields win, everything else falls back to the standalone default)', () => {
    expect(source).toMatch(/const copy = \{ \.\.\.DEFAULT_END_COPY, \.\.\.endCopy \};/);
  });

  it('uses the established mild-destructive severity, never the strong/red destructive one', () => {
    const block = source.match(/<ConfirmDialog[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/mildDestructive/);
    expect(block).not.toMatch(/\bdestructive\b(?!\s*=\s*\{false\})/);
  });
});

describe('MeditationActiveSession — End button uses quiet caution styling, not alarming bright red', () => {
  it('reuses the existing mild-destructive colour token (#b3555f, same as ConfirmDialog.jsx), never Tailwind red/bg-red', () => {
    const block = source.match(/aria-label=\{copy\.buttonAriaLabel\}[\s\S]{0,20}className="([^"]+)"/)?.[1] ?? '';
    expect(block).toMatch(/#b3555f/);
    expect(block).not.toMatch(/bg-red/);
  });
});

describe('MeditationActiveSession — sound can be seen and changed live, on the active screen', () => {
  it('renders the "Choose your sound" radiogroup, mapping over MEDITATION_SOUNDS', () => {
    expect(source).toMatch(/role="radiogroup" aria-label="Choose your sound"/);
    expect(source).toMatch(/\{MEDITATION_SOUNDS\.map\(\(sound\) => \(/);
  });

  it('the unavailable-message container reserves its height unconditionally, so switching tracks never shifts the layout', () => {
    expect(source).toMatch(/min-h-\[1\.5em\]/);
  });
});

describe('MeditationActiveSession — Pause/Resume reflect the live snapshot status, never a separately-tracked boolean', () => {
  it('branches on snapshot.status === \'paused\' to decide which single button renders', () => {
    expect(source).toMatch(/snapshot\.status === 'paused'/);
    expect(source).toMatch(/onClick=\{onResume\}/);
    expect(source).toMatch(/onClick=\{onPause\}/);
  });
});

describe('MeditationActiveSession — reduced motion passed straight through to the progress ring', () => {
  it('reducedMotion is forwarded to MeditationProgressRing, defaulting to false', () => {
    expect(source).toMatch(/reducedMotion = false/);
    expect(source).toMatch(/reducedMotion=\{reducedMotion\}/);
  });
});

describe('MeditationActiveSession — safe-area insets, matching this app\'s established pattern', () => {
  it('respects env(safe-area-inset-*)', () => {
    expect(source).toMatch(/env\(safe-area-inset-left\)/);
    expect(source).toMatch(/env\(safe-area-inset-right\)/);
    expect(source).toMatch(/env\(safe-area-inset-top\)/);
  });
});
