// Tester-reported defect: the screen sleeps mid-Morning-routine and
// mid-meditation (and, per Priority A's broader scope, mid-breathing-
// exercise too). Source-level checks per screen - matching each file's own
// established no-DOM-harness convention - confirming useWakeLock is wired
// to that screen's own real "is this activity genuinely active right now"
// condition, not merely "is this screen mounted."
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('MeditationActiveSession.jsx — screen stays awake only while actively meditating', () => {
  const source = read('../components/journey/MeditationActiveSession.jsx');
  it('useWakeLock mirrors the ring/Pause-Resume button\'s own snapshot.status check exactly, released by the same pause (including pauseForDialog) that already stops the audio', () => {
    expect(source).toMatch(/import \{ useWakeLock \} from '\.\.\/\.\.\/hooks\/useWakeLock';/);
    expect(source).toMatch(/useWakeLock\(snapshot\.status !== 'paused'\);/);
  });
});

describe('QuietBreathing.jsx — screen stays awake only during an active standalone breathing exercise', () => {
  const source = read('../pages/QuietBreathing.jsx');
  it('useWakeLock mirrors the standalone tick effect\'s own active-ticking guard exactly (hasBegun && !earlyEnded && !isCompleted && !endConfirmOpen)', () => {
    expect(source).toMatch(/import \{ useWakeLock \} from '\.\.\/hooks\/useWakeLock';/);
    expect(source).toMatch(/useWakeLock\(hasBegun && !earlyEnded && !isCompleted && !endConfirmOpen\);/);
  });
});

describe('MorningFlow.jsx — screen stays awake only while the timed-stretch countdown is genuinely ticking', () => {
  const source = read('../pages/MorningFlow.jsx');
  it('useWakeLock mirrors the countdown interval\'s own active-ticking guard, condition for condition - released for every one of that effect\'s own pause reasons', () => {
    expect(source).toMatch(/import \{ useWakeLock \} from '\.\.\/hooks\/useWakeLock';/);
    const body = source.match(/useWakeLock\(Boolean\([\s\S]*?\)\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    for (const flag of ['hasBegun', 'activeSequence', '!isInterrupted', '!isRepeatGated', '!isConfirming', '!isCompleted', '!backConfirmOpen']) {
      expect(body).toMatch(new RegExp(flag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
});

describe('BetaVideoModal.jsx — screen stays awake only while genuinely playing (every guided video/audio modal in the app)', () => {
  const source = read('../components/BetaVideoModal.jsx');
  it('useWakeLock is active only once started, actually playing (native play/pause events), and not yet ended', () => {
    expect(source).toMatch(/import \{ useWakeLock \} from '\.\.\/hooks\/useWakeLock';/);
    expect(source).toMatch(/useWakeLock\(hasStarted && isVideoPlaying && !hasEnded\);/);
  });
});
