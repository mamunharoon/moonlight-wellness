// Mobile correction #2 — compact Morning Stretch to match the approved
// phone layout. Physical-iPhone defect: only the first row of the four
// selected movement cards was reliably visible above the fold at
// 390x844/393x852; the approved screenshot shows all four within the
// initial screen. Fix: smallest-responsible spacing/sizing reductions -
// container space-y-5 -> 3, movement grid gap-3 -> 2, and
// MovementCheckboxRow's compact card min-h-76px -> 64px / py-3 -> 2.5 (see
// that file's own dedicated test for the card-level change). No text size,
// icon size, control size, or safe-area/Back-button clearance changed.
// Source-level regression guard (no DOM rendering in this repo's Vitest -
// see morningFlowStretchPreStart.test.js's own precedent).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./MorningFlow.jsx');

describe('MorningFlow.jsx (Stretch) — compaction reduces inter-section gaps, not text/control size', () => {
  it('the content container tightened from space-y-5 to space-y-3', () => {
    expect(source).toMatch(/className="flex flex-col space-y-3 select-none"/);
    expect(source).not.toMatch(/space-y-5 select-none/);
  });

  it('Morning Visual Uplift (Phase 6) — the movements area is now a vertically stacked list (space-y-2), not the former 2-column gap-2 grid', () => {
    expect(source).toMatch(/<div className="space-y-2" role="group" aria-label="Choose your movements">/);
    expect(source).not.toMatch(/grid grid-cols-2/);
  });

  // Physical-iPhone correction — safe-area handling for this screen moved
  // into the shared ExerciseScreenShell (its own header is now the
  // non-scrolling, safe-area-aware, opaque element; see
  // exerciseScreenShellSafeArea.test.js for the shell's own coverage).
  // This page no longer owns an inline safe-area style block itself - it
  // renders the shell instead.
  it('renders the shared ExerciseScreenShell with journeyTone="morning" instead of its own ad hoc safe-area wrapper', () => {
    expect(source).toMatch(/import \{ ExerciseScreenShell \} from '\.\.\/components\/journey\/ExerciseScreenShell';/);
    expect(source).toMatch(/<ExerciseScreenShell\s*\n\s*journeyTone="morning"/);
    expect(source).not.toMatch(/className="min-h-\[85vh\]/);
  });

  it('Begin Stretching keeps its full py-4 touch target and disabled-when-empty guard - not shrunk to fit', () => {
    const beginBlock = source.match(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{handleBeginStretching\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(beginBlock).toMatch(/py-4/);
    expect(beginBlock).toMatch(/disabled=\{selectedMovements\.size === 0\}/);
  });

  it('all four movements still render (steps.map, no filtering/hiding added to force fit)', () => {
    expect(source).toMatch(/\{steps\.map\(\(step, idx\) => \(/);
  });
});
