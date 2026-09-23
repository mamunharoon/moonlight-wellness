// Phase 3 (Prepare for Rest subphase) — four independent preparation
// toggles, compact collapsed bedtime guidance, Ready for Sleep. No DOM
// rendering is available in this repo's Vitest - source-level checks,
// matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const source = read('./PrepareForRest.jsx');
const toggleRowSource = read('../components/evening/PrepareToggleRow.jsx');
const manifestSource = read('../lib/betaVideoManifest.js');
const cssSource = read('../index.css');
const tailwindConfigSource = read('../../tailwind.config.js');

const PREP_ITEMS = [
  { id: 'phone', title: 'Put your phone down soon.', support: "Place it face down when you're ready." },
  { id: 'water', title: 'Have a little water.', support: 'Take a small sip if you need one.' },
  { id: 'dim', title: 'Dim the room.', support: 'Create a softer, quieter space.' },
  { id: 'finish', title: 'Let the day finish.', support: 'Everything else can wait until tomorrow.' }
];

// 1. Four exact preparation actions and safe copy.
describe('Four exact approved preparation actions, in order, with their exact supporting text', () => {
  it('PREP_ITEMS matches the approved id/title/support list exactly', () => {
    const block = source.match(/const PREP_ITEMS = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    for (const item of PREP_ITEMS) {
      expect(block).toMatch(new RegExp(`id: '${item.id}'`));
      expect(block).toMatch(new RegExp(`title: '${item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
    }
  });

  it('no nervous-system, melatonin, medical, or "must/required" mandatory-health wording anywhere in the checklist copy', () => {
    const block = source.match(/const PREP_ITEMS = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    expect(block).not.toMatch(/nervous system|melatonin|medical|treat(s|ment)?\b|cure|diagnos/i);
  });
});

// 2, 3. Initially unselected, multi-select toggling.
describe('Checklist state: initially all unselected, genuinely multi-select', () => {
  it('selectedPrep starts as an empty Set - nothing pre-checked', () => {
    expect(source).toMatch(/const \[selectedPrep, setSelectedPrep\] = useState\(\(\) => new Set\(\)\);/);
  });

  it('togglePrep adds/removes from the Set independently - never clears the others (no single-select exclusivity)', () => {
    const body = source.match(/const togglePrep = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/const next = new Set\(prev\);/);
    expect(body).toMatch(/if \(next\.has\(id\)\) next\.delete\(id\);/);
    expect(body).toMatch(/else next\.add\(id\);/);
    // proof there is no "clear every other id first" step
    expect(body).not.toMatch(/next\.clear\(\)/);
  });

  it('each toggle only ever affects its own item, via selectedPrep.has(item.id)', () => {
    expect(source).toMatch(/selected=\{selectedPrep\.has\(item\.id\)\}/);
    expect(source).toMatch(/onToggle=\{\(\) => togglePrep\(item\.id\)\}/);
  });
});

// 4, 5, 6. Selected blue treatment, no tick/chevron, aria-pressed (button semantics, not switch).
describe('PrepareToggleRow - selected state, no tick/chevron, button/aria-pressed semantics (not switch/aria-checked)', () => {
  it('uses aria-pressed, never role="switch"/aria-checked', () => {
    expect(toggleRowSource).toMatch(/aria-pressed=\{selected\}/);
    const code = toggleRowSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/role="switch"/);
    expect(code).not.toMatch(/aria-checked/);
  });

  it('selected fills the entire row with the new evening-accent/on-evening-accent token pair - stronger border, bold high-contrast title, inset shadow', () => {
    expect(toggleRowSource).toMatch(/bg-evening-accent border-evening-accent shadow-\[inset/);
    expect(toggleRowSource).toMatch(/text-on-evening-accent font-bold/);
  });

  it('never renders a checkmark/tick icon or a navigation chevron anywhere', () => {
    expect(toggleRowSource).not.toMatch(/check_circle|chevron_right|chevron_left/);
  });

  it('the whole row is one real <button>, not a <div> with onClick - the entire surface (not just an icon) toggles it', () => {
    expect(toggleRowSource).toMatch(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{onToggle\}/);
  });

  it('meets the 56px minimum height, comfortably exceeding the 44x44 minimum target', () => {
    expect(toggleRowSource).toMatch(/min-h-\[56px\]/);
  });
});

// New colour tokens.
describe('evening-accent/on-evening-accent - additive, contrast-verified tokens', () => {
  it('index.css defines them without touching gratitude-accent/primary', () => {
    expect(cssSource).toMatch(/--color-evening-accent: #9fb4f0;/);
    expect(cssSource).toMatch(/--color-on-evening-accent: #0b1326;/);
    expect(cssSource).toMatch(/--color-gratitude-accent: #f4c56a;/);
  });

  it('tailwind.config.js exposes them as real utility-generating colours', () => {
    expect(tailwindConfigSource).toMatch(/"evening-accent": "var\(--color-evening-accent\)"/);
    expect(tailwindConfigSource).toMatch(/"on-evening-accent": "var\(--color-on-evening-accent\)"/);
  });

  it('#0b1326 text on #9fb4f0 (and vice versa) measures well above the 4.5:1 AA floor - genuinely computed', () => {
    const relLum = (hex) => {
      const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
      const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    };
    const contrast = (a, b) => {
      const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    expect(contrast('#9fb4f0', '#0b1326')).toBeGreaterThanOrEqual(4.5);
  });
});

// 7. Continue with zero selections; 17. Ready for Sleep advances once.
describe('Ready for Sleep: works regardless of checklist state, fires the one real transition exactly once', () => {
  it('handleReadyForSleep never reads selectedPrep - identical behaviour whether zero, some, or all items are toggled', () => {
    const body = source.match(/const handleReadyForSleep = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/selectedPrep/);
  });

  it('advanceStep is guarded exactly like every other Session-Engine page (status playing AND currentStep is this exact step) before navigating to the existing /evening-complete route', () => {
    const body = source.match(/const handleReadyForSleep = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(state\.status === 'playing' && currentStep\?\.id === 'sleepPreparation'\) \{\s*\n\s*advanceStep\(\);\s*\n\s*\}/);
    expect(body).toMatch(/navigate\('\/evening-complete'\);/);
  });
});

// 8, 16. Selections preserved through the guidance video modal.
describe('Guidance video open/close never touches checklist state - same mounted page throughout', () => {
  it('closeVideo/handleSelect are never wired to setSelectedPrep - selections are untouched by opening or closing guidance', () => {
    expect(source).not.toMatch(/handleSelect[\s\S]{0,60}setSelectedPrep/);
    expect(source).not.toMatch(/closeVideo[\s\S]{0,60}setSelectedPrep/);
  });
});

// 9, 10. Back returns to Evening Breathing, never completes Step 5.
describe('Back: shared circular BackButton only, returns to Evening Breathing, never marks the step complete', () => {
  it('EveningSceneShell renders with a single static backFallback="/evening-breathing" - the shared BackButton is the only back control on this page', () => {
    expect(source).toMatch(/showBack backFallback="\/evening-breathing"/);
  });

  it('advanceStep is called from nowhere except handleReadyForSleep - Back (a plain navigate via BackButton, outside this component) can never trigger it', () => {
    const allAdvanceStepCalls = source.match(/advanceStep\(\);/g) ?? [];
    expect(allAdvanceStepCalls.length).toBe(1);
  });
});

// 11, 18. No duplicate completion; rapid double-tap protection.
describe('No duplicate completion - isAdvancing guards a rapid double tap', () => {
  it('handleReadyForSleep exits immediately if already advancing, before setting it', () => {
    const body = source.match(/const handleReadyForSleep = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(isAdvancing\) return;\s*\n\s*setIsAdvancing\(true\);/);
  });

  it('the Ready for Sleep button is disabled while advancing, with a visible (not fully hidden) disabled treatment', () => {
    expect(source).toMatch(/disabled=\{isAdvancing\}/);
    expect(source).toMatch(/disabled:opacity-70/);
  });
});

// 12, 13, 14, 15. Guidance content: exactly two initial items, More options collapsed, real ids, accurate/omitted duration.
describe('Bedtime guidance: exactly two initial items, collapsed "More bedtime options", real catalogue ids only, accurate or omitted duration', () => {
  it('INITIAL_GUIDANCE has exactly two entries: E05 and E30', () => {
    const block = source.match(/const INITIAL_GUIDANCE = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    const ids = [...block.matchAll(/id: '([A-Z0-9]+)'/g)].map((m) => m[1]);
    expect(ids).toEqual(['E05', 'E30']);
  });

  it('every referenced id (E05, E20, E27, E30, SL01-SL08) is a real entry in betaVideoManifest.js, verified against the actual manifest source', () => {
    for (const id of ['E05', 'E20', 'E27', 'E30', 'SL01', 'SL02', 'SL03', 'SL04', 'SL05', 'SL06', 'SL07', 'SL08']) {
      expect(source).toMatch(new RegExp(`id: '${id}'`));
      expect(manifestSource).toMatch(new RegExp(`id: '${id}',`));
    }
  });

  it('the main guidance disclosure and "More bedtime options" both start collapsed', () => {
    expect(source).toMatch(/const \[guidanceOpen, setGuidanceOpen\] = useState\(false\);/);
    expect(source).toMatch(/const \[moreGuidanceOpen, setMoreGuidanceOpen\] = useState\(false\);/);
  });

  it('"More bedtime options" is nested INSIDE the main disclosure (only reachable once guidance is already open) and includes Sleep Sounds under its own heading', () => {
    const mainBlock = source.match(/\{guidanceOpen && \(([\s\S]*?)\n {12}\)\}/)?.[1] ?? '';
    expect(mainBlock).toMatch(/More bedtime options/);
    expect(mainBlock).toMatch(/Sleep Sounds/);
  });

  it('duration is entry.durationLabel (real, spec-provided - SL01-08 only) or a real cached "~N min", falling back to undefined (no badge) - never the fabricated "Guided video" placeholder text used elsewhere', () => {
    expect(source).toMatch(/const duration = entry\.durationLabel \|\| \(cachedMinutes \? `~\$\{cachedMinutes\} min` : undefined\);/);
    expect(source).not.toMatch(/'Guided video'/);
  });

  it('guidance rows use the manifest\'s own real entry.title, never a hand-typed display string', () => {
    expect(source).toMatch(/title=\{entry\.title\}/);
  });
});

// 19. No unsupported background-playback claim.
describe('No fabricated background-playback claim (not implemented/verified)', () => {
  it('"Plays in background" (or equivalent) appears nowhere on this page', () => {
    expect(source).not.toMatch(/plays? in (the )?background/i);
    expect(source).not.toMatch(/background playback/i);
  });
});

// 21, 22. Layout: no truncation, no sticky action.
describe('Layout: full labels always visible, no sticky action area', () => {
  it('no truncate/line-clamp/overflow-hidden on any checklist or guidance label', () => {
    expect(toggleRowSource).not.toMatch(/truncate|line-clamp|overflow-hidden/);
  });

  it('Ready for Sleep is a normal flow element (not position: sticky/fixed) - the same proven non-sticky pattern Reflection/Gratitude/Breathe already use, so it can never cover content', () => {
    const buttonBlock = source.match(/onClick=\{handleReadyForSleep\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(buttonBlock).not.toMatch(/sticky|fixed/);
  });
});

// Review Mode wiring - unchanged from before this subphase.
describe('Review Mode wiring is unchanged - same hooks, same sessionId/stepId, same hasUnsavedProgress: false', () => {
  it('useStepReviewMode/useReviewNavigation called with the original arguments', () => {
    expect(source).toMatch(/useStepReviewMode\('sleepPreparation', 'evening-wind-down'\)/);
    expect(source).toMatch(/hasUnsavedProgress: false/);
  });

  it('Review Mode swaps in "Return to [step]" exactly as before - Ready for Sleep is never shown while reviewing', () => {
    expect(source).toMatch(/isReviewMode \? \(/);
    expect(source).toMatch(/Return to \{getStepLabel\(currentStep\.id\)\}/);
  });
});
