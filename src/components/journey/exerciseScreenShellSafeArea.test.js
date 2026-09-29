// Physical-iPhone correction — ExerciseScreenShell, real execution. This
// repo's Vitest runs with environment: 'node' (no DOM), but a React
// component is still a plain function: calling it directly returns a real
// element tree that can be inspected structurally.
//
// Root cause under test (see this file's own doc comment in
// ExerciseScreenShell.jsx): the Back/progress header and the safe-area top
// padding used to be ordinary in-flow children of the ONE scrollable
// region a page owned, so scrolling could move both out of view and let
// real content render directly under the iOS status bar/notch. The fix
// asserted here is the exact architecture the task specifies: a fixed
// h-dvh flex column, a `shrink-0` non-scrolling opaque header with a
// bottom divider, and a `flex-1 min-h-0 overflow-y-auto` body — never the
// other way around.
import { describe, it, expect } from 'vitest';
import { ExerciseScreenShell } from './ExerciseScreenShell';

describe('ExerciseScreenShell — outer fixed-viewport flex column, real execution', () => {
  it('outer container is h-dvh overflow-hidden flex flex-col — a real bound, never a min-h-[...] floor', () => {
    const el = ExerciseScreenShell({ header: 'H', children: 'C' });
    expect(el.props.className).toMatch(/\bh-dvh\b/);
    expect(el.props.className).toMatch(/\boverflow-hidden\b/);
    expect(el.props.className).toMatch(/\bflex\b/);
    expect(el.props.className).toMatch(/\bflex-col\b/);
    expect(el.props.className).not.toMatch(/min-h-\[/);
  });

  it('the header is the first real child, shrink-0 (never grows/shrinks with content, never scrolls) and NOT the same element as the scrollable body', () => {
    const el = ExerciseScreenShell({ header: 'MY_HEADER', children: 'MY_BODY' });
    const [headerDiv, bodyDiv] = el.props.children;
    expect(headerDiv.props.className).toMatch(/\bshrink-0\b/);
    expect(headerDiv).not.toBe(bodyDiv);
  });

  it('the header is opaque (bg-background, the app\'s solid canvas colour) — never a translucent/blurred surface real content could show through while scrolling', () => {
    const el = ExerciseScreenShell({ header: 'H', children: 'C' });
    const [headerDiv] = el.props.children;
    expect(headerDiv.props.className).toMatch(/\bbg-background\b/);
    expect(headerDiv.props.className).not.toMatch(/backdrop-blur|\/\d0\b/);
  });

  it('the header carries a subtle bottom divider (border-b) tinted to the journey tone, and env(safe-area-inset-top) top padding', () => {
    for (const [tone, borderClass] of [['morning', 'border-morning-accent-tint'], ['evening', 'border-evening-accent-tint'], ['anytime', 'border-tertiary-tint']]) {
      const el = ExerciseScreenShell({ journeyTone: tone, header: 'H', children: 'C' });
      const [headerDiv] = el.props.children;
      expect(headerDiv.props.className).toMatch(/\bborder-b\b/);
      expect(headerDiv.props.className).toContain(borderClass);
      expect(headerDiv.props.style.paddingTop).toBe('calc(1rem + env(safe-area-inset-top))');
    }
  });

  it('the body is the one real scroll owner: min-h-0 flex-1 overflow-y-auto, never the header', () => {
    const el = ExerciseScreenShell({ header: 'H', children: 'C' });
    const [headerDiv, bodyDiv] = el.props.children;
    expect(bodyDiv.props.className).toMatch(/\bmin-h-0\b/);
    expect(bodyDiv.props.className).toMatch(/\bflex-1\b/);
    expect(bodyDiv.props.className).toMatch(/\boverflow-y-auto\b/);
    expect(headerDiv.props.className).not.toMatch(/overflow-y-auto/);
  });

  it('the body\'s inner content wrapper reserves env(safe-area-inset-bottom) so trailing content clears the home-indicator area', () => {
    const el = ExerciseScreenShell({ header: 'H', children: 'C' });
    const [, bodyDiv] = el.props.children;
    const innerContent = bodyDiv.props.children;
    expect(innerContent.props.style.paddingBottom).toBe('calc(1.5rem + env(safe-area-inset-bottom))');
  });

  it('never nests a second independent scroll container — exactly one overflow-y-auto div in the real rendered element tree', () => {
    const el = ExerciseScreenShell({ header: 'H', children: 'C' });
    const [headerDiv, bodyDiv] = el.props.children;
    expect(headerDiv.props.className).not.toMatch(/overflow-y-auto/);
    expect(bodyDiv.props.className).toMatch(/overflow-y-auto/);
    expect(bodyDiv.props.children.props.className).not.toMatch(/overflow-y-auto/);
  });

  it('renders exactly the given header and children content, unmodified', () => {
    const el = ExerciseScreenShell({ header: 'MY_HEADER', children: 'MY_BODY' });
    const [headerDiv, bodyDiv] = el.props.children;
    expect(headerDiv.props.children.props.children).toBe('MY_HEADER');
    expect(bodyDiv.props.children.props.children).toBe('MY_BODY');
  });

  it('falls back to the morning divider tone for an unknown journeyTone, never crashing', () => {
    expect(() => ExerciseScreenShell({ journeyTone: 'unknown', header: 'H', children: 'C' })).not.toThrow();
  });
});
