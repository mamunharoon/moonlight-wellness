// Build 15 Phase A — shared Morning/Evening tint token regression guard.
// Originally additive-only (Phase A defined the tokens, applied nowhere).
//
// Build 15 Phase B amendment: morning-tint/evening-tint (only - not their
// on-* pairs) changed format from a plain hex `var(--x)` reference to
// `rgb(var(--x) / <alpha-value>)`, discovered necessary live during Phase
// B's own responsive/visual verification - Tailwind silently generates NO
// rule at all for an opacity-modified utility (bg-morning-tint/10, as
// Home.jsx now uses) unless the color is expressed this way; the old
// format compiled but the /10 and /20 variants Home.jsx actually needs
// were simply absent, so the intended Morning/Evening tint never
// rendered. Same colors as Phase A picked (#fff2e2 -> "255 242 226",
// #121b2e -> "18 27 46"), not new values - see index.css's own comment.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const tailwindConfig = readFileSync(repoRoot + 'tailwind.config.js', 'utf-8');
const indexCss = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf-8');

describe('Shared Morning/Evening tint tokens (Phase A, opacity format fixed in Phase B)', () => {
  it('tailwind.config.js maps morning-tint/evening-tint through rgb(var(...) / <alpha-value>) so opacity modifiers actually compile; on-* pairs stay plain var()', () => {
    expect(tailwindConfig).toMatch(/"morning-tint":\s*"rgb\(var\(--color-morning-tint\) \/ <alpha-value>\)"/);
    expect(tailwindConfig).toMatch(/"on-morning-tint":\s*"var\(--color-on-morning-tint\)"/);
    expect(tailwindConfig).toMatch(/"evening-tint":\s*"rgb\(var\(--color-evening-tint\) \/ <alpha-value>\)"/);
    expect(tailwindConfig).toMatch(/"on-evening-tint":\s*"var\(--color-on-evening-tint\)"/);
  });

  it('index.css defines morning-tint/evening-tint as "R G B" channel triplets (not hex) inside the single frozen :root palette; on-* pairs stay plain hex', () => {
    expect(indexCss).toMatch(/--color-morning-tint:\s*255 242 226;/);
    expect(indexCss).toMatch(/--color-on-morning-tint:\s*#5a3820;/);
    expect(indexCss).toMatch(/--color-evening-tint:\s*18 27 46;/);
    expect(indexCss).toMatch(/--color-on-evening-tint:\s*#dae2fd;/);
  });

  it('the new token names do not collide with the existing, separately-namespaced Stage 3 token set', () => {
    expect(tailwindConfig).not.toMatch(/"morning-tint":\s*"var\(--stage3-/);
    expect(tailwindConfig).not.toMatch(/"evening-tint":\s*"var\(--stage3-/);
    expect(tailwindConfig).toMatch(/stage3-dawn/); // the pre-existing Stage 3 set is still present, unremoved
  });
});
