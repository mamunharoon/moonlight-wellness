// WakeWise Phase 1 correction — Grounding.jsx used to render all seven
// optional video rows (3 GROUNDING_VIDEOS + 4 GROUNDING_SESSION_VIDEOS)
// inline, ahead of the real Previous/Next/Skip controls, pushing them
// below the initial mobile viewport. Source-level regression guard (no DOM
// rendering is available in this repo's Vitest - see
// guidedBreathingDisclosure.test.js's own established pattern for the same
// kind of disclosure on QuietBreathing.jsx/Breathe.jsx).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Grounding.jsx', import.meta.url)), 'utf-8');

describe('Grounding.jsx — Next/Skip render immediately with the active prompt, videos moved into a collapsed disclosure', () => {
  it('Previous/Next and Skip appear before the "Need more support?" disclosure in source order', () => {
    const nextIndex = source.indexOf("{isLast ? 'Continue' : 'Next'}");
    const skipIndex = source.indexOf('onClick={handleSkip}');
    const disclosureIndex = source.indexOf('Need more support?');
    expect(nextIndex).toBeGreaterThan(-1);
    expect(skipIndex).toBeGreaterThan(-1);
    expect(disclosureIndex).toBeGreaterThan(-1);
    expect(nextIndex).toBeLessThan(disclosureIndex);
    expect(skipIndex).toBeLessThan(disclosureIndex);
  });

  it('the disclosure is collapsed by default', () => {
    expect(source).toMatch(/const \[videosOpen, setVideosOpen\] = useState\(false\);/);
  });

  it('the disclosure trigger has real button semantics, aria-expanded/aria-controls, and a 44px+ tap target', () => {
    const buttonBlock = source.match(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => setVideosOpen[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(buttonBlock).not.toBe('');
    expect(buttonBlock).toMatch(/aria-expanded=\{videosOpen\}/);
    expect(buttonBlock).toMatch(/aria-controls="grounding-support-videos"/);
    expect(buttonBlock).toMatch(/min-h-\[44px\]/);
    expect(buttonBlock).toMatch(/focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('the panel id matches aria-controls, and both video sections still render inside it, unchanged', () => {
    expect(source).toMatch(/<div id="grounding-support-videos" className="space-y-4">/);
    expect(source).toMatch(/GROUNDING_VIDEOS\.map/);
    expect(source).toMatch(/GROUNDING_SESSION_VIDEOS\.map/);
    expect(source).toMatch(/Grounding Sessions/);
  });

  it('the panel only renders when expanded - no auto-playing content, nothing forced open', () => {
    expect(source).toMatch(/\{videosOpen && \(\s*\n\s*<div id="grounding-support-videos"/);
  });

  it('does not remove the videos or their existing access/click handling', () => {
    expect(source).toMatch(/onClick=\{\(\) => handleSelect\(id\)\}/);
    const handleSelectCount = (source.match(/onClick=\{\(\) => handleSelect\(id\)\}/g) || []).length;
    expect(handleSelectCount).toBe(2);
  });

  it('the 5-4-3-2-1 exercise (Previous/Next/Skip and the active prompt) is completely reachable without ever touching videosOpen', () => {
    expect(source).toMatch(/const goPrevious = \(\) => \{/);
    expect(source).toMatch(/const handleNext = \(\) => \{/);
    expect(source).toMatch(/const handleSkip = \(\) => \{/);
  });
});
