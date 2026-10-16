// Tester-reported defect: the progress bar couldn't seek to the beginning/
// end at all - it was a plain, non-interactive fill div with no pointer or
// keyboard handler wired to it whatsoever. Source-level checks, matching
// this file's own established no-DOM-harness convention (see
// AnytimeStretch.phase2cGate.test.js's own identical note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./AnytimeStretch.jsx');

describe('AnytimeStretch.jsx — the progress bar is now a real seek control', () => {
  it('seekFromClientX clamps to [0, total] and writes directly to the real <audio> element\'s currentTime, never a separate fake position', () => {
    const body = source.match(/const seekFromClientX = \(clientX\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/Math\.min\(Math\.max\(\(clientX - rect\.left\) \/ rect\.width, 0\), 1\)/);
    expect(body).toMatch(/el\.currentTime = fraction \* total;/);
  });

  it('bails out safely with no total duration known yet, never seeking against NaN/Infinity', () => {
    const body = source.match(/const seekFromClientX = \(clientX\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!el \|\| !track \|\| total <= 0\) return;/);
  });

  it('the track is a real slider: pointer down/move/up/cancel wired, role="slider" with live aria-value*, and keyboard seek (arrows/Home/End)', () => {
    const trackBlock = source.match(/<div\s+ref=\{trackRef\}[\s\S]*?\n {14}>/)?.[0] ?? '';
    expect(trackBlock).not.toBe('');
    expect(trackBlock).toMatch(/role="slider"/);
    expect(trackBlock).toMatch(/tabIndex=\{0\}/);
    expect(trackBlock).toMatch(/onPointerDown=\{handleTrackPointerDown\}/);
    expect(trackBlock).toMatch(/onPointerMove=\{handleTrackPointerMove\}/);
    expect(trackBlock).toMatch(/onPointerUp=\{stopSeeking\}/);
    expect(trackBlock).toMatch(/onKeyDown=\{handleTrackKeyDown\}/);
    expect(trackBlock).toMatch(/aria-valuenow=\{Math\.round\(currentTime\)\}/);
  });

  it('the visual fill div (width driven by progressPercent) is preserved unchanged inside the new interactive track - same layout, only interactivity added', () => {
    expect(source).toMatch(/<div className="h-full bg-tertiary transition-all duration-150" style=\{\{ width: `\$\{progressPercent\}%` \}\} \/>/);
  });

  it('keyboard seeking clamps Home/End to the real start/end and arrow keys step by a fixed amount, never past either bound', () => {
    const body = source.match(/const handleTrackKeyDown = \(e\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/Math\.min\(el\.currentTime \+ step, total\)/);
    expect(body).toMatch(/Math\.max\(el\.currentTime - step, 0\)/);
    expect(body).toMatch(/el\.currentTime = 0;/);
    expect(body).toMatch(/el\.currentTime = total;/);
  });
});

describe('AnytimeStretch.jsx — screen stays awake only while genuinely playing (tester-reported: screen sleeps mid-stretch)', () => {
  it('useWakeLock is called with the real isPlaying state, mirroring the native onPlay/onPause events, not the view string alone', () => {
    expect(source).toMatch(/import \{ useWakeLock \} from '\.\.\/hooks\/useWakeLock';/);
    expect(source).toMatch(/useWakeLock\(isPlaying\);/);
  });
});
