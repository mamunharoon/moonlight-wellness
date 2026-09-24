// Regression guard for the guest Music On/Off redirect fix - during an
// active self-guided meditation, a guest tapping the Background music
// toggle used to navigate to /auth (see confirmSignInForMusic), abandoning
// the running session via this file's own unmount cleanup effect. Same
// source-text convention as selfGuidedMeditationSetup.test.js - this
// repo's Vitest has no rendering engine (environment: 'node'), so the
// active screen's control-wiring is verified at the source level, while
// the real controller/audio behaviour a guest actually exercises when
// toggling music mid-session is proven by real execution against
// meditationSessionController.js (already the case for every other
// guest/anonymous-playback scenario in meditationSessionController.test.js).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createMeditationSessionController } from '../lib/meditationSessionController';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./SelfGuidedMeditation.jsx');

const activeScreenBlock = source.slice(source.indexOf("if (phase === 'active' && snapshot)"), source.indexOf('\n  return (\n'));

describe('SelfGuidedMeditation.jsx — active-session Music toggle never redirects a guest', () => {
  it('handleToggleMusic (the active screen\'s handler) has no isGuest branch, no confirmSignInForMusic call, and no navigate call', () => {
    const body = source.match(/const handleToggleMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).not.toMatch(/isGuest/);
    expect(body).not.toMatch(/confirmSignInForMusic/);
    expect(body).not.toMatch(/navigate\(/);
  });

  it('handleToggleMusic always drives the real controller\'s setMusicEnabled - the same seam that already degrades gracefully for a guest', () => {
    const body = source.match(/const handleToggleMusic = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/controllerRef\.current\?\.setMusicEnabled\(next\)/);
  });

  it('the active screen\'s MusicPreferenceToggle is wired to handleToggleMusic with no isGuest/onSignIn props, so its onClick can never resolve to a sign-in redirect', () => {
    const toggleBlock = activeScreenBlock.match(/<MusicPreferenceToggle[\s\S]*?\/>/)?.[0] ?? '';
    expect(toggleBlock).not.toBe('');
    expect(toggleBlock).toMatch(/onToggle=\{handleToggleMusic\}/);
    expect(toggleBlock).not.toMatch(/isGuest/);
    expect(toggleBlock).not.toMatch(/onSignIn/);
  });

  it('the active screen\'s switch reflects the real musicOn state (not forced off for a guest), unlike the setup screen', () => {
    const toggleBlock = activeScreenBlock.match(/<MusicPreferenceToggle[\s\S]*?\/>/)?.[0] ?? '';
    expect(toggleBlock).toMatch(/isOn=\{musicOn\}/);
  });

  it('the "music unavailable" fallback line is shown to every user (including a guest) once audio actually fails, not hidden for guests', () => {
    expect(activeScreenBlock).toMatch(/\{snapshot\.audioError && musicOn && \(/);
    expect(activeScreenBlock).not.toMatch(/audioError && musicOn && !isGuest/);
  });
});

describe('SelfGuidedMeditation.jsx — setup screen\'s own guest gate is unrelated and untouched', () => {
  it('the setup screen\'s toggle still redirects a guest to sign-in before a session ever begins (unchanged authentication rule)', () => {
    const setupBlock = source.slice(source.indexOf('\n  return (\n'));
    expect(setupBlock).toMatch(/if \(isGuest\) \{\s*confirmSignInForMusic\(\);/);
    expect(setupBlock).toMatch(/isOn=\{musicOn && !isGuest\}/);
  });
});

// Real-execution proof that the engine a guest is now routed to (via
// handleToggleMusic -> controllerRef.current.setMusicEnabled) behaves
// exactly as required: Off pauses cleanly without touching the timer, On
// attempts to resume/start without resetting elapsed time or throwing, and
// no duplicate audio element/network request is ever created - the same
// real createMeditationSessionController/createMeditationAudioController
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

describe('createMeditationSessionController — guest toggling Music On/Off mid-session (the engine behind the fix)', () => {
  it('a guest session begun with music Off, then toggled On mid-session, attempts playback exactly once, never throws, and never touches the timer', async () => {
    const createAudioElement = vi.fn(createFakeAudioElement);
    // Mirrors the real 403 an anonymous user's signed-URL request gets from
    // get-beta-video-url/index.ts (user.is_anonymous) - the audio
    // controller's own catch path, exercised here through the composed
    // session controller exactly as SelfGuidedMeditation.jsx uses it.
    const resolveUrl = vi.fn(async () => {
      throw new Error('Please sign in to watch this preview.');
    });
    const controller = createMeditationSessionController({
      mediaId: 'IM01',
      styleId: 'quiet',
      durationSeconds: 120,
      musicEnabled: false, // guest's Begin-time value, same as handleBegin's `musicOn && !isGuest`
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
    // resolveUrl rejects before the controller ever reaches
    // createAudioElement (see meditationAudioController.js's start() -
    // resolveUrl is awaited first) - a guest whose request is always
    // blocked therefore never gets an audio element constructed at all,
    // not even one, on any attempt.
    expect(createAudioElement).not.toHaveBeenCalled();
    expect(resolveUrl).toHaveBeenCalledTimes(1); // Off never re-attempts the request
  });

  it('a guest repeatedly toggling music Off/On never throws and never constructs an audio element, even across several retries', async () => {
    const createAudioElement = vi.fn(createFakeAudioElement);
    const resolveUrl = vi.fn(async () => {
      throw new Error('Please sign in to watch this preview.');
    });
    const controller = createMeditationSessionController({
      mediaId: 'IM01',
      styleId: 'quiet',
      durationSeconds: 60,
      musicEnabled: true, // attempt #1, at begin()
      createAudioElement,
      resolveUrl
    });

    controller.begin();
    await flushAsync();
    expect(() => controller.setMusicEnabled(false)).not.toThrow();
    expect(() => controller.setMusicEnabled(true)).not.toThrow(); // attempt #2
    await flushAsync();
    expect(() => controller.setMusicEnabled(false)).not.toThrow();
    expect(() => controller.setMusicEnabled(true)).not.toThrow(); // attempt #3
    await flushAsync();

    // Each "On" is a fresh, legitimate retry (never having previously
    // succeeded) - not a leaked duplicate - but not one of those retries
    // ever gets far enough to construct an audio element.
    expect(resolveUrl).toHaveBeenCalledTimes(3);
    expect(createAudioElement).not.toHaveBeenCalled();
    expect(controller.getSnapshot().audioError).toBe(true);
    expect(controller.getSnapshot().status).toBe('running');
  });
});
