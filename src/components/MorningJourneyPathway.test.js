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
// Physical-iPhone correction — labelSpan's own children is now an array
// (the label text, plus a conditional sr-only completed/current suffix
// that may be `false`) rather than a bare string, since currentStepNumber
// added per-step state. Label text is always the first element.
const collectSteps = (element) => {
  const listItems = element.props.children.filter((child) => child?.props?.role === 'listitem');
  return listItems.map((item) => {
    const [iconCol] = item.props.children;
    const [iconBadge, labelSpan] = iconCol.props.children;
    const iconSpan = iconBadge.props.children;
    const labelChildren = labelSpan.props.children;
    const label = Array.isArray(labelChildren) ? labelChildren[0] : labelChildren;
    return { icon: iconSpan.props.children, label };
  });
};

// Physical-iPhone correction — per-step completed/current/upcoming state,
// derived the same way the component itself derives it (stepNumber vs.
// currentStepNumber), for the new state-aware tests below.
const collectStepStates = (element) => {
  const listItems = element.props.children.filter((child) => child?.props?.role === 'listitem');
  return listItems.map((item, idx) => {
    const [iconCol] = item.props.children;
    const [iconBadge, labelSpan] = iconCol.props.children;
    const iconSpan = iconBadge.props.children;
    const labelChildren = labelSpan.props.children;
    const srOnly = Array.isArray(labelChildren) ? labelChildren[1] : false;
    return {
      stepNumber: idx + 1,
      iconGlyph: iconSpan.props.children,
      srSuffix: srOnly && srOnly.props ? srOnly.props.children : null
    };
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

  it('called with no props at all (bare JSX usage, e.g. <MorningJourneyPathway />) never throws - currentStepNumber defaults safely', () => {
    expect(() => MorningJourneyPathway()).not.toThrow();
  });
});

describe('MorningJourneyPathway — currentStepNumber state (Physical-iPhone correction: the pathway now appears, state-aware, in every Morning Home card)', () => {
  it('omitted (not-started): every step shows its own real activity icon (never a checkmark) and carries no sr-only completed/current suffix - byte-identical to the original not-started look', () => {
    const outer = MorningJourneyPathway({});
    const element = outer.props.children;
    const states = collectStepStates(element);
    expect(states.map((s) => s.iconGlyph)).toEqual(['flag', 'self_improvement', 'air', 'spa', 'auto_awesome']);
    for (const s of states) expect(s.srSuffix).toBeNull();
  });

  it('in-progress (currentStepNumber=3, "Breathe"): steps 1-2 show a check icon and an sr-only "- completed" suffix, step 3 keeps its own activity icon with an sr-only "- current" suffix, steps 4-5 stay in the plain upcoming look', () => {
    const outer = MorningJourneyPathway({ currentStepNumber: 3 });
    const element = outer.props.children;
    const states = collectStepStates(element);
    expect(states[0]).toMatchObject({ iconGlyph: 'check', srSuffix: ' - completed' });
    expect(states[1]).toMatchObject({ iconGlyph: 'check', srSuffix: ' - completed' });
    expect(states[2]).toMatchObject({ iconGlyph: 'air', srSuffix: ' - current' });
    expect(states[3]).toMatchObject({ iconGlyph: 'spa', srSuffix: null });
    expect(states[4]).toMatchObject({ iconGlyph: 'auto_awesome', srSuffix: null });
  });

  it('completed (currentStepNumber=6, past the last real step): all five steps show a check icon and an sr-only "- completed" suffix - never a current step', () => {
    const outer = MorningJourneyPathway({ currentStepNumber: 6 });
    const element = outer.props.children;
    const states = collectStepStates(element);
    for (const s of states) expect(s).toMatchObject({ iconGlyph: 'check', srSuffix: ' - completed' });
  });

  it('completed/current are communicated by more than colour alone - a real check icon (not just a colour swap) marks completed, and a real sr-only text suffix marks both completed and current for assistive tech', () => {
    const outer = MorningJourneyPathway({ currentStepNumber: 2 });
    const element = outer.props.children;
    const states = collectStepStates(element);
    expect(states[0].iconGlyph).toBe('check');
    expect(states[0].srSuffix).toBe(' - completed');
    expect(states[1].srSuffix).toBe(' - current');
  });
});
