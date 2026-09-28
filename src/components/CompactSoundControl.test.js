// Morning Visual Uplift (Phase 6) — CompactSoundControl, real execution
// (calling the component function directly and inspecting the returned
// element tree - this repo's Vitest runs with environment: 'node', no
// DOM/jsdom, but a component is still a plain function; see
// MorningJourneyPathway.test.js's own identical rationale).
import { describe, it, expect } from 'vitest';
import { CompactSoundControl } from './CompactSoundControl';

describe('CompactSoundControl — real execution, operates the caller\'s existing preference state (no second audio state)', () => {
  it('never manages its own on/off state - isOn is read straight from props, onToggle is the caller\'s own handler, called with no arguments of its own', () => {
    let toggleCalls = 0;
    const onToggle = () => { toggleCalls += 1; };
    const element = CompactSoundControl({ isOn: true, onToggle, journeyTone: 'morning' });
    expect(element.props.onClick).toBe(onToggle);
    element.props.onClick();
    expect(toggleCalls).toBe(1);
  });

  it('role="switch" and aria-checked mirror the real isOn boolean exactly, both when on and off', () => {
    const on = CompactSoundControl({ isOn: true, onToggle: () => {} });
    const off = CompactSoundControl({ isOn: false, onToggle: () => {} });
    expect(on.props.role).toBe('switch');
    expect(on.props['aria-checked']).toBe(true);
    expect(off.props['aria-checked']).toBe(false);
  });

  it('the accessible label states the control and its current state in words - never colour alone', () => {
    const on = CompactSoundControl({ isOn: true, onToggle: () => {} });
    const off = CompactSoundControl({ isOn: false, onToggle: () => {} });
    expect(on.props['aria-label']).toBe('Background music: on');
    expect(off.props['aria-label']).toBe('Background music: off');
  });

  it('meets the 44x44 minimum touch target', () => {
    const element = CompactSoundControl({ isOn: false, onToggle: () => {} });
    expect(element.props.className).toMatch(/min-w-\[44px\]/);
    expect(element.props.className).toMatch(/min-h-\[44px\]/);
  });

  it('shows a real Material Symbol (volume_up/volume_off) - never an emoji - and its own visible "Sound" text label', () => {
    const on = CompactSoundControl({ isOn: true, onToggle: () => {} });
    const off = CompactSoundControl({ isOn: false, onToggle: () => {} });
    const [iconSpan, textSpan] = on.props.children;
    expect(iconSpan.props.children).toBe('volume_up');
    expect(iconSpan.props['aria-hidden']).toBe('true');
    expect(textSpan.props.children).toBe('Sound');
    const [offIconSpan] = off.props.children;
    expect(offIconSpan.props.children).toBe('volume_off');
  });

  it('journeyTone selects an existing, already-approved accent token - morning reuses morning-accent-tint, never a new colour; unknown/omitted tone falls back to primary, never a crash', () => {
    const morningOn = CompactSoundControl({ isOn: true, onToggle: () => {}, journeyTone: 'morning' });
    expect(morningOn.props.className).toMatch(/morning-accent-tint/);
    const unknownOn = CompactSoundControl({ isOn: true, onToggle: () => {}, journeyTone: 'not-a-real-journey' });
    expect(unknownOn.props.className).toMatch(/bg-primary\/15 text-primary border-primary\/40/);
  });
});
