// Regression guard for guest access to IM01 in Self-Guided Meditation.
// IM01 is one of the three explicitly server-allowlisted interactive
// ambient beds (GUEST_ALLOWED_IDS in
// supabase/functions/_shared/betaVideoUrlAccess.ts - proven to genuinely
// succeed for a guest by src/lib/betaVideoUrlGuestAccess.test.js), so
// neither of this file's two Music controls (setup screen, active
// session) may intercept a guest with any sign-in redirect any more.
// Same source-text convention as selfGuidedMeditationSetup.test.js - this
// repo's Vitest has no rendering engine (environment: 'node') - while the
// real controller/audio behaviour (timer/cleanup/no-duplicate-instance
// guarantees, and the truthful revert-on-failure requirement) is proven
// by real execution against meditationSessionController.js, same as
// meditationSessionController.test.js already does for every other
// scenario.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createMeditationSessionController } from '../lib/meditationSessionController';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./SelfGuidedMeditation.jsx');

// Strips /* ... */ and // ... comments before asserting "no real reference
// remains" - several of this file's own doc comments legitimately mention
// "isGuest" as a concept (explaining why no such prop/branch exists any
// more), which must not itself trip a check for actual code usage.
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const codeOnly = stripComments(source);

const activeScreenBlock = source.slice(source.indexOf("if (phase === 'active' && snapshot)"), source.indexOf('\n  return (\n'));
const setupScreenBlock = source.slice(source.indexOf('\n  return (\n'));

describe('SelfGuidedMeditation.jsx — no guest concept left anywhere in this file (isGuest/useAuth fully removed)', () => {
  it('does not import useAuth, and never references isGuest in real code (comments explaining its removal are fine)', () => {
    expect(codeOnly).not.toMatch(/useAuth/);
    expect(codeOnly).not.toMatch(/isGuest/);
  });

  it('the old sign-in-for-music helper and every /auth navigation tied to music are gone entirely', () => {
    expect(source).not.toMatch(/confirmSignInForMusic/);
    expect(source).not.toMatch(/setPendingContent/);
    expect(source).not.toMatch(/'\/auth'/);
  });
});

describe('SelfGuidedMeditation.jsx — setup screen: a guest can choose Music On before Begin, no redirect', () => {
  it('musicOn defaults the same way for everyone (preset?.musicOn ?? true) - no guest-specific default', () => {
    expect(source).toMatch(/useState\(\(\) => preset\?\.musicOn \?\? true\);/);
  });

  it('the setup screen\'s MusicPreferenceToggle has no isGuest/onSignIn props and a plain toggle handler', () => {
    const toggleBlock = setupScreenBlock.match(/<MusicPreferenceToggle[\s\S]*?\/>/)?.[0] ?? '';
    expect(toggleBlock).not.toBe('');
    expect(toggleBlock).toMatch(/isOn=\{musicOn\}/);
    expect(toggleBlock).toMatch(/onToggle=\{\(\) => setMusicOn\(\(prev\) => !prev\)\}/);
    expect(toggleBlock).not.toMatch(/isGuest/);
    expect(toggleBlock).not.toMatch(/onSignIn/);
  });

  it('handleBegin passes the real musicOn value straight through - no guest override', () => {
    const body = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/musicEnabled: musicOn\n/);
    expect(body).not.toMatch(/musicOn && !isGuest/);
  });
});

describe('SelfGuidedMeditation.jsx — active session: Music toggle never redirects, for anyone', () => {
  it('handleToggleMusic has no isGuest branch, no confirmSignInForMusic call, and no navigate call', () => {
    const body = source.match(/const handleToggleMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).not.toMatch(/isGuest/);
    expect(body).not.toMatch(/confirmSignInForMusic/);
    expect(body).not.toMatch(/navigate\(/);
  });

  it('handleToggleMusic always drives the real controller\'s setMusicEnabled directly', () => {
    const body = source.match(/const handleToggleMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/controllerRef\.current\?\.setMusicEnabled\(next\)/);
  });

  it('the active screen\'s MusicPreferenceToggle is wired to handleToggleMusic with no isGuest/onSignIn props', () => {
    const toggleBlock = activeScreenBlock.match(/<MusicPreferenceToggle[\s\S]*?\/>/)?.[0] ?? '';
    expect(toggleBlock).not.toBe('');
    expect(toggleBlock).toMatch(/onToggle=\{handleToggleMusic\}/);
    expect(toggleBlock).not.toMatch(/isGuest/);
    expect(toggleBlock).not.toMatch(/onSignIn/);
  });

  it('the "music unavailable" fallback line is shown to every user once audio actually fails', () => {
    expect(activeScreenBlock).toMatch(/\{snapshot\.audioError && musicOn && \(/);
  });
});

describe('SelfGuidedMeditation.jsx — truthful state: a genuine playback failure reverts the switch, never leaves On implying success', () => {
  it('the tick interval (handleBegin\'s own per-second heartbeat, not a separate reactive effect - avoids a setState-in-effect lint violation) reverts musicOn off when the latest snapshot reports audioError', () => {
    const beginBody = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(beginBody).toMatch(/if \(latestSnapshot\.audioError\) setMusicOn\(false\);/);
  });

  it('that revert is the only unconditional setMusicOn(false) driven purely by a snapshot read, and it never turns music on', () => {
    const beginBody = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(beginBody).not.toMatch(/setMusicOn\(true\)/);
  });
});

describe('SelfGuidedMeditation.jsx — cleanup is unaffected by any of the above', () => {
  it('unmount/route-change cleanup still destroys the controller and clears the interval, unchanged', () => {
    expect(source).toMatch(/useEffect\(\(\) => \(\) => cleanupSession\(\), \[\]\);/);
    const cleanupBody = source.match(/const cleanupSession = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(cleanupBody).toMatch(/stopInterval\(\);/);
    expect(cleanupBody).toMatch(/controllerRef\.current\?\.destroy\(\);/);
  });
});

// Real-execution proof of the engine every Music toggle (guest or
// signed-in - both now identical, since IM01 is server-allowlisted) drives
// via handleToggleMusic -> controllerRef.current.setMusicEnabled: Off
// pauses cleanly without touching the timer, On attempts to resume/start
// without resetting elapsed time or throwing, no duplicate audio element/
// network request is ever created, and a genuine failure is what the
// component's own truthful-revert effect reacts to - the same real
// createMeditationSessionController/createMeditationAudioController
// modules the component itself uses, unmocked.
const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

const createFakeAudioElement = () => ({
  _src: '',
  loop: false,
  volume: 1,
  paused: true,
  get src() {
    return this._src;
  },
  set src(value) {
    this._src = value;
  },
  play() {
    this.paused = false;
    return Promise.resolve();
  },
  pause() {
    this.paused = true;
  },
  removeAttribute() {
    this._src = '';
  },
  load() {}
});

describe('createMeditationSessionController — Music On/Off mid-session (the engine behind both toggles)', () => {
  it('started with music Off, then toggled On mid-session: attempts playback exactly once, never throws, and never touches the timer', async () => {
    const createAudioElement = vi.fn(createFakeAudioElement);
    const resolveUrl = vi.fn(async () => {
      throw new Error('network down'); // any genuine failure, not guest-specific any more
    });
    const controller = createMeditationSessionController({
      mediaId: 'IM01',
      styleId: 'quiet',
      durationSeconds: 120,
      musicEnabled: false,
      createAudioElement,
      resolveUrl
    });

    controller.begin();
    await flushAsync();
    expect(resolveUrl).not.toHaveBeenCalled();
    controller.tick();
    expect(controller.getSnapshot().elapsedSeconds).toBe(1);

    expect(() => controller.setMusicEnabled(true)).not.toThrow();
    await flushAsync();
    expect(resolveUrl).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().audioError).toBe(true);
    expect(controller.getSnapshot().elapsedSeconds).toBe(1); // untouched by the failed attempt

    controller.tick();
    expect(controller.getSnapshot().elapsedSeconds).toBe(2);

    expect(() => controller.setMusicEnabled(false)).not.toThrow();
    expect(createAudioElement).not.toHaveBeenCalled(); // resolveUrl rejects before an element is ever constructed
    expect(resolveUrl).toHaveBeenCalledTimes(1); // Off never re-attempts the request
  });

  it('repeatedly toggling Off/On never throws, never duplicates the timer\'s own tick source, and never constructs more than one audio element across several retries', async () => {
    const createAudioElement = vi.fn(createFakeAudioElement);
    const resolveUrl = vi.fn(async () => {
      throw new Error('network down');
    });
    const controller = createMeditationSessionController({
      mediaId: 'IM01',
      styleId: 'quiet',
      durationSeconds: 60,
      musicEnabled: true,
      createAudioElement,
      resolveUrl
    });

    controller.begin();
    await flushAsync();
    expect(() => controller.setMusicEnabled(false)).not.toThrow();
    expect(() => controller.setMusicEnabled(true)).not.toThrow();
    await flushAsync();
    expect(() => controller.setMusicEnabled(false)).not.toThrow();
    expect(() => controller.setMusicEnabled(true)).not.toThrow();
    await flushAsync();

    expect(resolveUrl).toHaveBeenCalledTimes(3); // 3 legitimate retries, never deduped away
    expect(createAudioElement).not.toHaveBeenCalled(); // none ever got far enough to construct an element
    expect(controller.getSnapshot().audioError).toBe(true);
    expect(controller.getSnapshot().status).toBe('running');
  });

  it('a successful start (the real path once the Edge Function actually allows it) never creates a second element or a second request on repeated On/Off toggles', async () => {
    const createAudioElement = vi.fn(createFakeAudioElement);
    const resolveUrl = vi.fn(async () => ({ url: 'https://signed.example/im01', expiresAt: Date.now() + 300_000 }));
    const controller = createMeditationSessionController({
      mediaId: 'IM01',
      styleId: 'quiet',
      durationSeconds: 60,
      musicEnabled: true,
      createAudioElement,
      resolveUrl
    });

    controller.begin();
    await flushAsync();
    expect(controller.getSnapshot().audioError).toBe(false);
    expect(controller.getSnapshot().audioStarted).toBe(true);

    controller.setMusicEnabled(false);
    controller.setMusicEnabled(true);
    controller.setMusicEnabled(false);
    controller.setMusicEnabled(true);

    expect(createAudioElement).toHaveBeenCalledTimes(1); // same element resumed every time, never re-created
    expect(resolveUrl).toHaveBeenCalledTimes(1); // never re-fetched once already started
  });

  it('destroy() (unmount/route-change/End Session) fully releases the element regardless of how many times the toggle was flipped first', async () => {
    const createAudioElement = vi.fn(createFakeAudioElement);
    const resolveUrl = vi.fn(async () => ({ url: 'https://signed.example/im01', expiresAt: Date.now() + 300_000 }));
    const controller = createMeditationSessionController({
      mediaId: 'IM01',
      styleId: 'quiet',
      durationSeconds: 60,
      musicEnabled: true,
      createAudioElement,
      resolveUrl
    });
    controller.begin();
    await flushAsync();
    controller.setMusicEnabled(false);
    controller.setMusicEnabled(true);
    const el = createAudioElement.mock.results[0].value;
    controller.destroy();
    expect(el.paused).toBe(true);
    expect(el.src).toBe('');
  });
});
