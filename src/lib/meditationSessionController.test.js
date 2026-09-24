// Real-execution tests for the composed session controller - the heart of
// Self-Guided Meditation's testable behaviour. No jsdom/Audio global exists
// in this repo's Vitest (environment: 'node', see vite.config.js), so a
// plain fake object stands in for HTMLAudioElement via the controller's own
// injectable `createAudioElement`/`resolveUrl` seams - the same real
// createMeditationSessionController/createMeditationAudioController/
// createMeditationSession modules run underneath, unmocked.
import { describe, it, expect, vi } from 'vitest';
import { createMeditationSessionController } from './meditationSessionController';

// audioController.start() chains two real awaits (resolveUrl, then
// audio.play()) before its internal `started`/`isBusy` flags settle. A
// macrotask flush (not just one or two `await Promise.resolve()` guesses)
// reliably drains every pending microtask in between, so tests that assert
// on post-start() state never race the controller's own async internals.
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

const setup = ({ styleId = 'quiet', durationSeconds = 120, musicEnabled = true, resolveImpl } = {}) => {
  const elements = [];
  const createAudioElement = vi.fn(() => {
    const el = createFakeAudioElement();
    elements.push(el);
    return el;
  });
  const resolveUrl = vi.fn(resolveImpl || (async () => ({ url: 'https://signed.example/im01', expiresAt: Date.now() + 300_000 })));
  const controller = createMeditationSessionController({
    mediaId: 'IM01',
    styleId,
    durationSeconds,
    musicEnabled,
    createAudioElement,
    resolveUrl
  });
  return { controller, createAudioElement, resolveUrl, elements };
};

describe('createMeditationSessionController — no autoplay before Begin', () => {
  it('never calls resolveUrl/createAudioElement until begin() is called', () => {
    const { createAudioElement, resolveUrl } = setup();
    expect(createAudioElement).not.toHaveBeenCalled();
    expect(resolveUrl).not.toHaveBeenCalled();
  });
});

describe('createMeditationSessionController — Begin starts exactly one timer-tick source and one audio instance', () => {
  it('begin() is idempotent: calling it repeatedly (a double/duplicate Begin tap) creates at most one audio element and one resolveUrl request', async () => {
    const { controller, createAudioElement, resolveUrl } = setup();
    controller.begin();
    controller.begin();
    controller.begin();
    await flushAsync();
    expect(createAudioElement).toHaveBeenCalledTimes(1);
    expect(resolveUrl).toHaveBeenCalledTimes(1);
  });

  it('sets native loop=true on the audio element, so a 10-minute session repeats IM01 without any JS-level restart', async () => {
    const { controller, elements } = setup({ durationSeconds: 600 });
    controller.begin();
    await flushAsync();
    expect(elements[0].loop).toBe(true);
  });
});

describe('createMeditationSessionController — music On vs Off at Begin', () => {
  it('music On: audio starts (resolveUrl called) once begin() runs', async () => {
    const { controller, resolveUrl } = setup({ musicEnabled: true });
    controller.begin();
    await flushAsync();
    expect(resolveUrl).toHaveBeenCalledTimes(1);
  });

  it('music Off: begin() never starts audio, but the timer still runs and can complete normally (silent session, timer never blocked)', async () => {
    const { controller, resolveUrl } = setup({ musicEnabled: false, durationSeconds: 3 });
    controller.begin();
    await flushAsync();
    expect(resolveUrl).not.toHaveBeenCalled();
    expect(controller.tick()).toEqual({ completed: false });
    expect(controller.tick()).toEqual({ completed: false });
    expect(controller.tick()).toEqual({ completed: true });
    expect(controller.getSnapshot().status).toBe('completed');
  });
});

describe('createMeditationSessionController — exact completion boundaries', () => {
  it('2-minute (120s) session completes at exactly the 120th tick', async () => {
    const { controller } = setup({ durationSeconds: 120 });
    controller.begin();
    await flushAsync();
    const results = [];
    for (let i = 0; i < 120; i += 1) results.push(controller.tick());
    expect(results.slice(0, 119).every((r) => r.completed === false)).toBe(true);
    expect(results[119]).toEqual({ completed: true });
  });

  it('5-minute (300s) session completes at exactly the 300th tick', async () => {
    const { controller } = setup({ durationSeconds: 300 });
    controller.begin();
    await flushAsync();
    const results = [];
    for (let i = 0; i < 300; i += 1) results.push(controller.tick());
    expect(results.slice(0, 299).every((r) => r.completed === false)).toBe(true);
    expect(results[299]).toEqual({ completed: true });
  });

  it('10-minute (600s) session completes at exactly the 600th tick, with audio started only once across the whole session (no duplicate audio, no timer restart on loop)', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ durationSeconds: 600 });
    controller.begin();
    await flushAsync();
    const results = [];
    for (let i = 0; i < 600; i += 1) results.push(controller.tick());
    expect(results.slice(0, 599).every((r) => r.completed === false)).toBe(true);
    expect(results[599]).toEqual({ completed: true });
    expect(createAudioElement).toHaveBeenCalledTimes(1);
    expect(resolveUrl).toHaveBeenCalledTimes(1);
  });

  it('natural completion stops the audio element', async () => {
    const { controller, elements } = setup({ durationSeconds: 2 });
    controller.begin();
    await flushAsync();
    controller.tick();
    controller.tick();
    expect(elements[0].paused).toBe(true);
  });
});

describe('createMeditationSessionController — Pause/Resume affect both timer and music', () => {
  it('pause() freezes elapsed progress and pauses the audio element', async () => {
    const { controller, elements } = setup({ durationSeconds: 120 });
    controller.begin();
    await flushAsync();
    controller.tick();
    controller.tick();
    controller.pause();
    expect(elements[0].paused).toBe(true);
    expect(controller.getSnapshot().status).toBe('paused');
    controller.tick();
    controller.tick();
    expect(controller.getSnapshot().elapsedSeconds).toBe(2);
  });

  it('resume() continues the timer from where it paused and resumes the same audio element - no re-fetch, no restart', async () => {
    const { controller, elements, resolveUrl } = setup({ durationSeconds: 120 });
    controller.begin();
    await flushAsync();
    controller.tick();
    controller.pause();
    expect(elements[0].paused).toBe(true);
    controller.resume();
    expect(elements[0].paused).toBe(false);
    expect(resolveUrl).toHaveBeenCalledTimes(1); // still just the original start() call
    controller.tick();
    expect(controller.getSnapshot().elapsedSeconds).toBe(2);
  });
});

describe('createMeditationSessionController — toggling music mid-session', () => {
  it('turning music Off mid-session pauses the track cleanly without affecting the timer', async () => {
    const { controller, elements } = setup({ durationSeconds: 120, musicEnabled: true });
    controller.begin();
    await flushAsync();
    controller.tick();
    controller.setMusicEnabled(false);
    expect(elements[0].paused).toBe(true);
    controller.tick();
    expect(controller.getSnapshot().elapsedSeconds).toBe(2);
  });

  it('turning music back On resumes the existing element rather than starting a new one', async () => {
    const { controller, elements, resolveUrl, createAudioElement } = setup({ durationSeconds: 120, musicEnabled: true });
    controller.begin();
    await flushAsync();
    controller.setMusicEnabled(false);
    expect(elements[0].paused).toBe(true);
    controller.setMusicEnabled(true);
    expect(elements[0].paused).toBe(false);
    expect(resolveUrl).toHaveBeenCalledTimes(1);
    expect(createAudioElement).toHaveBeenCalledTimes(1);
  });

  it('starting a session with music Off, then turning it On mid-session, starts audio for the first time at that point', async () => {
    const { controller, resolveUrl } = setup({ durationSeconds: 120, musicEnabled: false });
    controller.begin();
    await flushAsync();
    expect(resolveUrl).not.toHaveBeenCalled();
    controller.setMusicEnabled(true);
    await flushAsync();
    expect(resolveUrl).toHaveBeenCalledTimes(1);
  });

  it('music toggled Off while paused, then session resumed with music back On: audio resumes, timer continues, no restart', async () => {
    const { controller, elements, resolveUrl } = setup({ durationSeconds: 120, musicEnabled: true });
    controller.begin();
    await flushAsync();
    controller.tick();
    controller.pause();
    controller.setMusicEnabled(false);
    expect(elements[0].paused).toBe(true);
    controller.setMusicEnabled(true);
    controller.resume();
    expect(controller.getSnapshot().status).toBe('running');
    expect(elements[0].paused).toBe(false);
    expect(resolveUrl).toHaveBeenCalledTimes(1);
    controller.tick();
    expect(controller.getSnapshot().elapsedSeconds).toBe(2);
  });
});

describe('createMeditationSessionController — prompts (Body Awareness / Loving-Kindness real behaviour)', () => {
  it('Body Awareness snapshot shows its own prompts at the right elapsed sections of a 10-minute session', () => {
    const { controller } = setup({ styleId: 'body-awareness', durationSeconds: 600, musicEnabled: false });
    controller.begin();
    expect(controller.getSnapshot().promptText).toBe('Notice where your body meets the surface beneath you.');
    for (let i = 0; i < 400; i += 1) controller.tick();
    expect(controller.getSnapshot().promptText).toBe('Notice sensations without needing to change them.');
  });

  it('Loving-Kindness snapshot shows its own prompts, distinct from Body Awareness at the same elapsed time', () => {
    const { controller } = setup({ styleId: 'loving-kindness', durationSeconds: 600, musicEnabled: false });
    controller.begin();
    for (let i = 0; i < 400; i += 1) controller.tick();
    expect(controller.getSnapshot().promptText).toBe('Bring someone you care about gently to mind.');
  });

  it('prompt scheduling is deterministic - replaying the same number of ticks always yields the same prompt', () => {
    const first = setup({ styleId: 'mindful-pause', durationSeconds: 300, musicEnabled: false });
    const second = setup({ styleId: 'mindful-pause', durationSeconds: 300, musicEnabled: false });
    first.controller.begin();
    second.controller.begin();
    for (let i = 0; i < 210; i += 1) {
      first.controller.tick();
      second.controller.tick();
    }
    expect(first.controller.getSnapshot().promptText).toBe(second.controller.getSnapshot().promptText);
  });
});

describe('createMeditationSessionController — signed-URL/playback failure falls back to silent meditation', () => {
  it('a rejected resolveUrl leaves the session fully functional: timer still ticks and completes, snapshot flags the audio error', async () => {
    const { controller } = setup({
      durationSeconds: 3,
      musicEnabled: true,
      resolveImpl: async () => {
        throw new Error('network down');
      }
    });
    controller.begin();
    await flushAsync();
    expect(controller.getSnapshot().audioError).toBe(true);
    expect(controller.tick()).toEqual({ completed: false });
    expect(controller.tick()).toEqual({ completed: false });
    expect(controller.tick()).toEqual({ completed: true });
  });

  it('a play() rejection (e.g. a guest/anonymous session) is caught the same way - never throws out of begin()', async () => {
    const createAudioElement = () => ({
      ...createFakeAudioElement(),
      play: () => Promise.reject(new Error('NotAllowedError'))
    });
    const resolveUrl = async () => ({ url: 'https://signed.example/im01', expiresAt: Date.now() + 1000 });
    const controller = createMeditationSessionController({
      mediaId: 'IM01',
      styleId: 'quiet',
      durationSeconds: 2,
      musicEnabled: true,
      createAudioElement,
      resolveUrl
    });
    expect(() => controller.begin()).not.toThrow();
    await flushAsync();
    expect(controller.getSnapshot().audioError).toBe(true);
    expect(controller.tick()).toEqual({ completed: false });
    expect(controller.tick()).toEqual({ completed: true });
  });
});

describe('createMeditationSessionController — destroy()', () => {
  it('destroy() releases the audio element (pause + removeAttribute + load), matching the established IB01/IS01 cleanup shape', async () => {
    const { controller, elements } = setup({ durationSeconds: 120 });
    controller.begin();
    await flushAsync();
    const el = elements[0];
    const loadSpy = vi.spyOn(el, 'load');
    controller.destroy();
    expect(el.paused).toBe(true);
    expect(el.src).toBe('');
    expect(loadSpy).toHaveBeenCalled();
  });
});
