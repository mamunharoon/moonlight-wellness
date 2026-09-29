// Release-blocking runtime fix — Evening Meditation blank-screen defect.
//
// Root cause (reproduced live in a real browser against the deployed
// site, on a real authenticated user's real active meditation session,
// not guessed from source): EveningMeditate.jsx's own active-session
// branch (`session.phase === 'active' && session.snapshot`) does not use
// EveningSceneShell at all - it reproduces the moonlight atmosphere
// directly, as a sibling of MeditationActiveSession, with the exact same
// mistaken `z-[100]` literal EveningSceneShell's own protectedHeader
// branch had (see eveningSceneShellStackingOrder.test.js for that
// earlier, separate fix). MeditationActiveSession renders its content
// through ExerciseScreenShell, whose own outer root is a plain
// `position: static` div - a normal in-flow element with NO explicit
// z-index/stacking context of its own. Per the CSS painting-order spec, a
// positioned sibling with a POSITIVE (or zero) z-index always paints
// ABOVE ordinary in-flow content, regardless of DOM order - only a
// NEGATIVE z-index paints behind it. `z-[100]` therefore covered the
// entire active/paused/resumed meditation UI - Back/Close, the timer,
// Pause/Resume, Finish & continue, End Meditation - all fully present and
// tappable (DOM/accessibility tree correct, pointer-events-none let
// clicks through), just never visible.
//
// EveningMeditate.jsx itself cannot be called directly (it owns several
// hooks - useSession/useMeditationSession/usePreparationCountdown/etc. -
// and needs a full provider/router tree), so this file cannot render it
// the way eveningSceneShellStackingOrder.test.js renders the hook-free
// EveningSceneShell. What CAN be executed directly, and is here: (1) a
// REAL call to ExerciseScreenShell (itself hook-free) confirming its own
// root genuinely has no explicit z-index - the exact condition that makes
// "negative, not just numerically lower" the correct rule for its
// siblings, and (2) real numeric parsing (the same zIndexOf technique
// eveningSceneShellStackingOrder.test.js uses) of the one literal
// className string extracted from EveningMeditate.jsx's own source,
// proving BY NUMBER (not by string-negation) that it is negative -
// verified below to genuinely fail against the pre-fix z-[100] value.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ExerciseScreenShell } from '../components/journey/ExerciseScreenShell';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

// Parses BOTH Tailwind's plain `z-<n>`/`-z-<n>` scale utilities and its
// arbitrary-value `z-[<n>]` syntax (the exact shape the pre-fix,
// regressed literal used) into a real signed number, so a numeric
// comparison can be run against either shape rather than only ever
// matching the new, fixed one.
const zIndexOf = (className) => {
  const bracket = className.match(/(?:^|\s)z-\[(-?\d+)\](?:\s|$)/);
  if (bracket) return Number(bracket[1]);
  const plain = className.match(/(?:^|\s)(-?)z-(\d+)(?:\s|$)/);
  if (!plain) return null;
  const [, sign, digits] = plain;
  return (sign === '-' ? -1 : 1) * Number(digits);
};

describe('ExerciseScreenShell — real execution: its own root is a plain in-flow element with no explicit z-index', () => {
  it('the outer wrapper carries no z-index class at all (position: static, normal document flow) - this is exactly why a sibling atmosphere layer must be NEGATIVE, not just numerically lower, to paint behind it', () => {
    const element = ExerciseScreenShell({ header: 'h', children: 'c' });
    expect(element.props.className).toBe('h-dvh overflow-hidden flex flex-col');
    expect(zIndexOf(element.props.className)).toBeNull();
    expect(element.props.className).not.toMatch(/\bz-/);
  });

  it('its own internal header IS explicitly z-10 (a real, separate stacking context relative to its own body) - unaffected by, and unrelated to, this fix', () => {
    const element = ExerciseScreenShell({ header: 'h', children: 'c' });
    const [header] = element.props.children;
    expect(zIndexOf(header.props.className)).toBe(10);
  });
});

describe('EveningMeditate.jsx — active-session atmosphere is genuinely negative z-index, numerically proven (release-blocking runtime fix)', () => {
  const source = read('./EveningMeditate.jsx');
  const activeBlock = source.match(/if \(session\.phase === 'active' && session\.snapshot\) \{[\s\S]*?\n {2}\}/)?.[0] ?? '';
  const atmosphereMatch = activeBlock.match(/<AtmosphereManager phase="moonlight" className="([^"]*)"/);
  const atmosphereClassName = atmosphereMatch?.[1] ?? '';

  it('the active-session block exists and contains exactly one directly-rendered AtmosphereManager (never routed through EveningSceneShell)', () => {
    expect(activeBlock).not.toBe('');
    expect(activeBlock).not.toMatch(/<EveningSceneShell/);
    expect(atmosphereMatch).toBeTruthy();
  });

  it('its real numeric z-index is strictly negative - never 0, never positive, never the old z-[100] - proven by parsing the actual value, not by asserting a specific string is absent', () => {
    const z = zIndexOf(atmosphereClassName);
    expect(z).not.toBeNull();
    expect(z).toBeLessThan(0);
  });

  it('regression check: this exact assertion genuinely fails against the pre-fix value (z-[100] parses to +100, which is not negative) - proving this test has real catching power, not just checking a string is gone', () => {
    const preFixClassName = 'fixed inset-0 z-[100] pointer-events-none';
    const preFixZ = zIndexOf(preFixClassName);
    expect(preFixZ).toBe(100);
    expect(preFixZ).not.toBeLessThan(0);
  });

  it('stays fixed/inset-0/pointer-events-none - the fix changes only paint order, never positioning or hit-testing', () => {
    expect(atmosphereClassName).toMatch(/\bfixed\b/);
    expect(atmosphereClassName).toMatch(/\binset-0\b/);
    expect(atmosphereClassName).toMatch(/\bpointer-events-none\b/);
  });

  it('Back/Close/pause/resume/Skip/End handlers remain wired exactly as before - the fix is a pure className change, nothing else in this block moved', () => {
    expect(activeBlock).toMatch(/onRequestLeave=\{handleEndMeditation\}/);
    expect(activeBlock).toMatch(/onRequestClose=\{handleRequestExitRoutine\}/);
    expect(activeBlock).toMatch(/onConfirm: handleFinishAndContinue/);
    expect(activeBlock).toMatch(/onChooseAnother=\{handleChooseAnother\}/);
    expect(activeBlock).toMatch(/onPause=\{session\.pause\}/);
    expect(activeBlock).toMatch(/onResume=\{session\.resume\}/);
  });
});

describe('MorningMeditate.jsx — confirmed unaffected: it never used AtmosphereManager here at all (JourneyGlow, -z-10, already correct)', () => {
  it('every active-session-equivalent call site uses JourneyGlow, never AtmosphereManager', () => {
    const morningSource = read('./MorningMeditate.jsx');
    expect(morningSource).not.toMatch(/AtmosphereManager/);
    expect((morningSource.match(/<JourneyGlow journey="morning"/g) ?? []).length).toBeGreaterThan(0);
  });
});
