// Morning Visual Uplift (Phase 6) — MorningJourneyPathway, real execution.
// This repo's Vitest runs with environment: 'node' (no DOM/jsdom - see
// every other regression guard's own doc comment), but a React component
// is still a plain function: calling it directly returns a real element
// tree (plain objects from React.createElement), which can be inspected
// without any renderer. Preferred here over source-string assertions
// since the five-step order and icon/label pairing are exactly the kind
// of thing real execution catches that a regex could silently drift from.
import { describe, it, expect } from 'vitest';
import { MorningJourneyPathway } from './MorningJourneyPathway';

const EXPECTED_STEPS = [
  { label: 'Focus', icon: 'flag' },
  { label: 'Stretch', icon: 'self_improvement' },
  { label: 'Breathe', icon: 'air' },
  { label: 'Meditate', icon: 'spa' },
  { label: 'Affirm', icon: 'auto_awesome' }
];

// Walk the real returned element tree and collect every step's icon glyph
// + label text, in DOM order, purely by structural shape (each step is a
// `role="listitem"` div containing an icon span then a label span) -
// never by re-deriving the STEPS array from MorningJourneyPathway.jsx
// itself, so this genuinely proves the rendered output, not just that the
// source module re-exports its own constant.
const collectSteps = (element) => {
  const listItems = element.props.children.filter((child) => child?.props?.role === 'listitem');
  return listItems.map((item) => {
    const [iconCol] = item.props.children;
    const [iconBadge, labelSpan] = iconCol.props.children;
    const iconSpan = iconBadge.props.children;
    return { icon: iconSpan.props.children, label: labelSpan.props.children };
  });
};

describe('MorningJourneyPathway — real execution', () => {
  const outer = MorningJourneyPathway();
  // 320px structural safety wrapper - see MorningJourneyPathway.jsx's own
  // doc comment: an outer overflow-x-auto div (matching
  // ProgressIndicator.jsx's own established narrow-screen pattern) wraps
  // the real role="list" element.
  const element = outer.props.children;

  it('renders exactly the five approved steps, in the exact approved order: Focus, Stretch, Breathe, Meditate, Affirm', () => {
    expect(collectSteps(element)).toEqual(EXPECTED_STEPS);
  });

  it('every icon is a real Material Symbol name - never an emoji character', () => {
    for (const step of collectSteps(element)) {
      expect(step.icon).toMatch(/^[a-z_]+$/);
    }
  });

  it('is a real accessible list (role="list" on the root, role="listitem" per step) with an aria-label naming the full sequence', () => {
    expect(element.props.role).toBe('list');
    expect(element.props['aria-label']).toBe('Morning Reset steps: Focus, Stretch, Breathe, Meditate, Affirm');
  });

  it('320px structural safety: the outer wrapper is horizontally scrollable, never a source of page-wide overflow, matching ProgressIndicator.jsx\'s own established narrow-screen pattern', () => {
    expect(outer.props.className).toMatch(/overflow-x-auto/);
  });

  it('never renders a link or button - this is a decorative preview, not a second navigation control', () => {
    const collectTypes = (node, seen = new Set(), out = []) => {
      if (!node || typeof node !== 'object' || seen.has(node)) return out;
      seen.add(node);
      if (node.type !== undefined) out.push(node.type);
      const children = node.props?.children;
      if (Array.isArray(children)) children.forEach((c) => collectTypes(c, seen, out));
      else collectTypes(children, seen, out);
      return out;
    };
    const types = collectTypes(outer);
    expect(types.length).toBeGreaterThan(0);
    for (const type of types) {
      expect(typeof type === 'string' ? type : type?.name).not.toBe('a');
      expect(typeof type === 'string' ? type : type?.name).not.toBe('button');
      expect(typeof type === 'string' ? type : type?.name).not.toBe('Link');
    }
  });

  it('every icon is aria-hidden - the visible text label is the only accessible name for each step', () => {
    const listItems = element.props.children.filter((child) => child?.props?.role === 'listitem');
    for (const item of listItems) {
      const [iconCol] = item.props.children;
      const [iconBadge] = iconCol.props.children;
      const iconSpan = iconBadge.props.children;
      expect(iconSpan.props['aria-hidden']).toBe('true');
    }
  });
});
