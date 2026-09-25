// Real-execution tests for the composed session controller - the heart of
// Self-Guided Meditation's testable behaviour, including the tri-state
// Sound Choices model (IM01 Gentle Ambient / IM02 Soft Piano / No Music).
// No jsdom/Audio global exists in this repo's Vitest (environment: 'node',
// see vite.config.js), so a plain fake object stands in for
// HTMLAudioElement via the controller's own injectable
// `createAudioElement`/`resolveUrl` seams - the same real
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

// Individual created elements/resolveUrl calls are inspected directly via
// each mock's own `.mock.results`/`.mock.calls` in the tests below - no
// separate bucketing needed since resolveUrl's own argument already
// identifies which track a given call/element belongs to.
const setup = ({ styleId = 'quiet', durationSeconds = 120, initialSoundId = 'IM01', resolveImpl } = {}) => {
  const createAudioElement = vi.fn(() => createFakeAudioElement());
  const resolveUrl = vi.fn(
    resolveImpl ||
      (async (mediaId) => ({ url: `https://signed.example/${mediaId}`, expiresAt: Date.now() + 300_000 }))
  );
  const controller = createMeditationSessionController({
    styleId,
    durationSeconds,
    initialSoundId,
    createAudioElement,
    resolveUrl
  });
  return { controller, createAudioElement, resolveUrl };
};

describe('createMeditationSessionController — no autoplay before Begin', () => {
  it('never calls resolveUrl/createAudioElement until begin() is called', () => {
    const { createAudioElement, resolveUrl } = setup();
    expect(createAudioElement).not.toHaveBeenCalled();
    expect(resolveUrl).not.toHaveBeenCalled();
  });
});

// Build 16 physical-iPhone correction (F4/F7) — preload() resolves and
// primes the current track's signed URL ahead of begin(), so a later
// begin() (fired at the end of the shared 5-second preparation countdown)
// can skip the network round trip entirely and call audio.play()
// immediately. Real-execution proof this is the actual fix for "music
// starts late," not merely a delay masked by the countdown.
describe('createMeditationSessionController — preload() primes audio ahead of begin(), without ever starting playback', () => {
  it('preload() resolves the signed URL and sets audio.src, but never calls play() and never starts the timer', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ initialSoundId: 'IM01' });
    controller.preload();
    await flushAsync();
    expect(resolveUrl).toHaveBeenCalledTimes(1);
    expect(resolveUrl).toHaveBeenCalledWith('IM01');
    expect(createAudioElement).toHaveBeenCalledTimes(1);
    const el = createAudioElement.mock.results[0].value;
    expect(el.src).toBe('https://signed.example/IM01');
    expect(el.paused).toBe(true); // never played
    expect(controller.getSnapshot().status).toBe('idle'); // timer never started
  });

  it('a later begin() reuses the preloaded element and its already-set src - it never re-resolves the URL a second time', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ initialSoundId: 'IM01' });
    controller.preload();
    await flushAsync();
    controller.begin();
    await flushAsync();
    // preload() + begin() together still only ever resolve/create once -
    // begin() found the already-primed element and skipped straight to
    // play(), never fetching a second signed URL.
    expect(resolveUrl).toHaveBeenCalledTimes(1);
    expect(createAudioElement).toHaveBeenCalledTimes(1);
    const el = createAudioElement.mock.results[0].value;
    expect(el.paused).toBe(false); // begin() did call play()
    expect(controller.getSnapshot().status).toBe('running');
  });

  it('preload() is a safe no-op for No Music (null) - it never calls resolveUrl/createAudioElement', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ initialSoundId: null });
    controller.preload();
    await flushAsync();
    expect(resolveUrl).not.toHaveBeenCalled();
    expect(createAudioElement).not.toHaveBeenCalled();
  });

  it('preload() is idempotent - calling it twice never issues a second resolveUrl/createAudioElement call', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ initialSoundId: 'IM02' });
    controller.preload();
    controller.preload();
    await flushAsync();
    expect(resolveUrl).toHaveBeenCalledTimes(1);
    expect(createAudioElement).toHaveBeenCalledTimes(1);
  });

  it('preload() after begin() is a safe no-op - it never re-primes or interferes with an already-running session', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    controller.preload();
    await flushAsync();
    expect(resolveUrl).toHaveBeenCalledTimes(1);
    expect(createAudioElement).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().status).toBe('running');
  });
});

// Verification-pass correction (F4 acceptance audit) — a REAL bug found
// live via the required "Start now before preload completes" test:
// meditationAudioController.js's preload() and start() used to share one
// `isBusy` flag. begin() (via reconcileAudio -> audioController.start())
// called while preload()'s own resolveUrl() was still in flight hit
// `if (isBusy || started) return;` and silently returned WITHOUT EVER
// PLAYING - nothing later retried it, so the session ran with no music at
// all despite the timer/countdown transitioning completely normally.
// Reproduced live (self-guided-meditation, real Supabase network): play()
// call count 0, active state reached true. Fixed by giving start() its
// own separate `startInFlight` guard (never touched by preload()) and
// having it `await` an in-flight `preloadPromise` instead of bailing -
// confirmed fixed live afterward: play() call count 1. This test
// reproduces the exact race with a controllable (deferred) resolveUrl,
// rather than relying on real network timing.
describe('createMeditationSessionController — begin() racing an in-flight preload() still plays (the real "Start now before preload completes" fix)', () => {
  const deferred = () => {
    let resolve;
    const promise = new Promise((res) => { resolve = res; });
    return { promise, resolve };
  };

  it('begin() called WHILE preload()\'s resolveUrl is still pending waits for it, then still calls play() exactly once - it never silently drops playback', async () => {
    const gate = deferred();
    const { controller, createAudioElement } = setup({ initialSoundId: 'IM01', resolveImpl: () => gate.promise });

    // Kick off preload() - its resolveUrl() call is now pending on `gate`.
    controller.preload();
    await flushAsync();

    // begin() (Start now) fires WHILE that same fetch is still in flight -
    // this is the exact race the live "Start now before preload completes"
    // test reproduces.
    controller.begin();
    await flushAsync();

    // Still nothing has played yet - the gate hasn't opened.
    expect(controller.getSnapshot().audioStarted).toBe(false);

    // The in-flight preload's own fetch finally resolves.
    gate.resolve({ url: 'https://signed.example/IM01', expiresAt: Date.now() + 300_000 });
    await flushAsync();
    await flushAsync();

    // play() must still have been called, exactly once - not silently lost.
    const el = createAudioElement.mock.results[0].value;
    expect(el.paused).toBe(false);
    expect(controller.getSnapshot().audioStarted).toBe(true);
    expect(controller.getSnapshot().status).toBe('running');
    expect(createAudioElement).toHaveBeenCalledTimes(1);
  });
});

describe('createMeditationSessionController — Begin with a track starts exactly one instance', () => {
  it('Begin with IM01 selected starts exactly one IM01 request/element', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    expect(resolveUrl).toHaveBeenCalledTimes(1);
    expect(resolveUrl).toHaveBeenCalledWith('IM01');
    expect(createAudioElement).toHaveBeenCalledTimes(1);
  });

  it('Begin with IM02 selected starts exactly one IM02 request/element', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ initialSoundId: 'IM02' });
    controller.begin();
    await flushAsync();
    expect(resolveUrl).toHaveBeenCalledTimes(1);
    expect(resolveUrl).toHaveBeenCalledWith('IM02');
    expect(createAudioElement).toHaveBeenCalledTimes(1);
  });

  it('Begin with No Music (null) starts no audio at all, but the timer runs', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ initialSoundId: null, durationSeconds: 3 });
    controller.begin();
    await flushAsync();
    expect(resolveUrl).not.toHaveBeenCalled();
    expect(createAudioElement).not.toHaveBeenCalled();
    expect(controller.tick()).toEqual({ completed: false });
    expect(controller.tick()).toEqual({ completed: false });
    expect(controller.tick()).toEqual({ completed: true });
    expect(controller.getSnapshot().status).toBe('completed');
  });

  it('begin() is idempotent: repeated calls never create a second request/element', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ initialSoundId: 'IM01' });
    controller.begin();
    controller.begin();
    controller.begin();
    await flushAsync();
    expect(resolveUrl).toHaveBeenCalledTimes(1);
    expect(createAudioElement).toHaveBeenCalledTimes(1);
  });

  it('sets native loop=true, so a 10-minute session repeats either track without any JS-level restart', async () => {
    const created = [];
    const createAudioElement = vi.fn(() => {
      const el = createFakeAudioElement();
      created.push(el);
      return el;
    });
    const resolveUrl = vi.fn(async (id) => ({ url: `https://signed.example/${id}` }));
    const controller = createMeditationSessionController({
      styleId: 'quiet',
      durationSeconds: 600,
      initialSoundId: 'IM02',
      createAudioElement,
      resolveUrl
    });
    controller.begin();
    await flushAsync();
    expect(created[0].loop).toBe(true);
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

  it('5-minute (300s) session completes at exactly the 300th tick, even though IM02 is ~300.37s (slightly longer)', async () => {
    const { controller } = setup({ durationSeconds: 300, initialSoundId: 'IM02' });
    controller.begin();
    await flushAsync();
    const results = [];
    for (let i = 0; i < 300; i += 1) results.push(controller.tick());
    expect(results.slice(0, 299).every((r) => r.completed === false)).toBe(true);
    expect(results[299]).toEqual({ completed: true });
  });

  it('10-minute (600s) session completes at exactly the 600th tick, with the track started only once across the whole session', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ durationSeconds: 600, initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    const results = [];
    for (let i = 0; i < 600; i += 1) results.push(controller.tick());
    expect(results.slice(0, 599).every((r) => r.completed === false)).toBe(true);
    expect(results[599]).toEqual({ completed: true });
    expect(createAudioElement).toHaveBeenCalledTimes(1);
    expect(resolveUrl).toHaveBeenCalledTimes(1);
  });

  it('natural completion stops the current track', async () => {
    const { controller, createAudioElement } = setup({ durationSeconds: 2, initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    const el = createAudioElement.mock.results[0].value;
    controller.tick();
    controller.tick();
    expect(el.paused).toBe(true);
  });
});

describe('createMeditationSessionController — Pause/Resume affect both timer and the selected track', () => {
  it('pause() freezes elapsed progress and pauses the current track', async () => {
    const { controller, createAudioElement } = setup({ durationSeconds: 120, initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    const el = createAudioElement.mock.results[0].value;
    controller.tick();
    controller.tick();
    controller.pause();
    expect(el.paused).toBe(true);
    expect(controller.getSnapshot().status).toBe('paused');
    controller.tick();
    controller.tick();
    expect(controller.getSnapshot().elapsedSeconds).toBe(2);
  });

  it('resume() continues the timer from where it paused and resumes the same element - no re-fetch, no restart', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ durationSeconds: 120, initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    const el = createAudioElement.mock.results[0].value;
    controller.tick();
    controller.pause();
    expect(el.paused).toBe(true);
    controller.resume();
    expect(el.paused).toBe(false);
    expect(resolveUrl).toHaveBeenCalledTimes(1);
    controller.tick();
    expect(controller.getSnapshot().elapsedSeconds).toBe(2);
  });

  it('Pause/Resume with No Music selected never touches any audio', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ durationSeconds: 60, initialSoundId: null });
    controller.begin();
    await flushAsync();
    controller.pause();
    controller.resume();
    expect(createAudioElement).not.toHaveBeenCalled();
    expect(resolveUrl).not.toHaveBeenCalled();
  });
});

describe('createMeditationSessionController — switching sounds mid-session', () => {
  it('IM01 -> IM02: stops IM01 cleanly and starts exactly one IM02 instance, preserving elapsed progress', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ durationSeconds: 120, initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    const im01El = createAudioElement.mock.results[0].value;
    controller.tick();
    controller.tick();

    controller.setSoundId('IM02');
    await flushAsync();

    expect(im01El.paused).toBe(true); // stopped cleanly
    expect(resolveUrl).toHaveBeenCalledTimes(2);
    expect(resolveUrl).toHaveBeenNthCalledWith(2, 'IM02');
    expect(createAudioElement).toHaveBeenCalledTimes(2); // exactly one new instance for IM02
    const im02El = createAudioElement.mock.results[1].value;
    expect(im02El.paused).toBe(false);
    expect(controller.getSnapshot().soundId).toBe('IM02');
    expect(controller.getSnapshot().elapsedSeconds).toBe(2); // untouched by the switch

    controller.tick();
    expect(controller.getSnapshot().elapsedSeconds).toBe(3);
  });

  it('IM02 -> IM01: stops IM02 cleanly and starts exactly one IM01 instance, preserving elapsed progress', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ durationSeconds: 120, initialSoundId: 'IM02' });
    controller.begin();
    await flushAsync();
    const im02El = createAudioElement.mock.results[0].value;
    controller.tick();

    controller.setSoundId('IM01');
    await flushAsync();

    expect(im02El.paused).toBe(true);
    expect(resolveUrl).toHaveBeenNthCalledWith(2, 'IM01');
    expect(createAudioElement).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().soundId).toBe('IM01');
    expect(controller.getSnapshot().elapsedSeconds).toBe(1);
  });

  it('switching IM01 -> IM01 (no-op, same id) never re-fetches or re-creates anything', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    controller.setSoundId('IM01');
    expect(resolveUrl).toHaveBeenCalledTimes(1);
    expect(createAudioElement).toHaveBeenCalledTimes(1);
  });

  it('track -> No Music: stops and releases the active audio while the timer keeps running', async () => {
    const { controller, createAudioElement } = setup({ durationSeconds: 60, initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    const el = createAudioElement.mock.results[0].value;
    controller.tick();

    controller.setSoundId(null);

    expect(el.paused).toBe(true);
    expect(el.src).toBe(''); // released (removeAttribute), not merely paused
    expect(controller.getSnapshot().soundId).toBeNull();
    controller.tick();
    expect(controller.getSnapshot().elapsedSeconds).toBe(2); // timer unaffected
  });

  it('No Music -> track: starts the selected track fresh without resetting the timer', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ durationSeconds: 60, initialSoundId: null });
    controller.begin();
    await flushAsync();
    controller.tick();
    controller.tick();
    expect(controller.getSnapshot().elapsedSeconds).toBe(2);

    controller.setSoundId('IM02');
    await flushAsync();

    expect(resolveUrl).toHaveBeenCalledTimes(1);
    expect(resolveUrl).toHaveBeenCalledWith('IM02');
    expect(createAudioElement).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().elapsedSeconds).toBe(2); // never reset
    expect(controller.getSnapshot().soundId).toBe('IM02');
  });

  it('never plays both tracks simultaneously: at any point at most one element is unpaused', async () => {
    const { controller, createAudioElement } = setup({ durationSeconds: 120, initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    controller.setSoundId('IM02');
    await flushAsync();
    controller.setSoundId('IM01'); // switch back - IM01 element already exists (paused, warm)
    const unpaused = createAudioElement.mock.results.filter((r) => r.value.paused === false);
    expect(unpaused.length).toBeLessThanOrEqual(1);
  });

  it('switching back to a previously-used track resumes the same element rather than re-fetching', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ durationSeconds: 120, initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    const im01El = createAudioElement.mock.results[0].value;
    controller.setSoundId('IM02');
    await flushAsync();
    controller.setSoundId('IM01');
    expect(resolveUrl).toHaveBeenCalledTimes(2); // one for IM01, one for IM02 - never a third for the IM01 return
    expect(createAudioElement).toHaveBeenCalledTimes(2);
    expect(im01El.paused).toBe(false); // resumed, not re-created
  });
});

describe('createMeditationSessionController — rapid/repeated switching creates no overlap or duplicates', () => {
  it('rapid IM01 -> IM02 -> IM01 -> IM02 taps before the first fetch resolves never start a stale, no-longer-selected track', async () => {
    const pendingResolvers = [];
    const resolveUrl = vi.fn(
      (mediaId) =>
        new Promise((resolve) => {
          pendingResolvers.push({ mediaId, resolve });
        })
    );
    const created = [];
    const createAudioElement = vi.fn(() => {
      const el = createFakeAudioElement();
      created.push(el);
      return el;
    });
    const controller = createMeditationSessionController({
      styleId: 'quiet',
      durationSeconds: 120,
      initialSoundId: 'IM01',
      createAudioElement,
      resolveUrl
    });

    controller.begin(); // starts IM01's fetch (pending)
    controller.setSoundId('IM02'); // now current; IM01's fetch still pending
    controller.setSoundId('IM01'); // back to IM01 again before either fetch resolved

    // Resolve every pending fetch now, in the order they were requested.
    for (const { mediaId, resolve } of pendingResolvers) {
      resolve({ url: `https://signed.example/${mediaId}` });
    }
    await flushAsync();
    await flushAsync();

    // At most one element ends up genuinely audible.
    const unpaused = created.filter((el) => el.paused === false);
    expect(unpaused.length).toBeLessThanOrEqual(1);
    expect(controller.getSnapshot().soundId).toBe('IM01');
  });

  it('several rapid setSoundId calls to the same target are deduped (2nd/3rd are no-ops) and IM01\'s late-resolving fetch aborts cleanly rather than creating a stale element', async () => {
    const { controller, createAudioElement, resolveUrl } = setup({ initialSoundId: 'IM01' });
    controller.begin(); // fires IM01's fetch
    controller.setSoundId('IM02'); // switches away before IM01's fetch resolves; fires IM02's fetch
    controller.setSoundId('IM02'); // same id as current - a no-op, no second IM02 fetch
    controller.setSoundId('IM02'); // still a no-op
    await flushAsync();

    expect(resolveUrl).toHaveBeenCalledTimes(2); // exactly IM01 once (begin) + IM02 once (the first real switch)
    // IM01's fetch resolves after the switch away, so it correctly aborts
    // before ever touching an element (see meditationAudioController.js's
    // own isCurrent guard) - only IM02 ends up with a real element.
    expect(createAudioElement).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().soundId).toBe('IM02');
    expect(controller.getSnapshot().audioStarted).toBe(true);
  });

  it('rapid switching never creates more than one timer tick source - tick() remains a plain, single, idempotent counter', async () => {
    const { controller } = setup({ durationSeconds: 5, initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    controller.setSoundId('IM02');
    controller.setSoundId(null);
    controller.setSoundId('IM01');
    controller.tick();
    controller.tick();
    expect(controller.getSnapshot().elapsedSeconds).toBe(2); // exactly one tick per call, never doubled
  });
});

describe('createMeditationSessionController — prompts (unaffected by sound switching)', () => {
  it('prompt scheduling is deterministic and independent of which sound is selected', () => {
    const withSound = setup({ styleId: 'mindful-pause', durationSeconds: 300, initialSoundId: 'IM01' });
    const withoutSound = setup({ styleId: 'mindful-pause', durationSeconds: 300, initialSoundId: null });
    withSound.controller.begin();
    withoutSound.controller.begin();
    for (let i = 0; i < 210; i += 1) {
      withSound.controller.tick();
      withoutSound.controller.tick();
    }
    expect(withSound.controller.getSnapshot().promptText).toBe(withoutSound.controller.getSnapshot().promptText);
  });
});

describe('createMeditationSessionController — track-resolution/playback failure falls back truthfully', () => {
  it('a rejected resolveUrl leaves the session fully functional and reports audioError on the current (failed) track', async () => {
    const { controller } = setup({
      durationSeconds: 3,
      initialSoundId: 'IM01',
      resolveImpl: async () => {
        throw new Error('network down');
      }
    });
    controller.begin();
    await flushAsync();
    expect(controller.getSnapshot().audioError).toBe(true);
    expect(controller.getSnapshot().soundId).toBe('IM01'); // controller doesn't self-revert - the page does (see SelfGuidedMeditation.jsx)
    expect(controller.tick()).toEqual({ completed: false });
    expect(controller.tick()).toEqual({ completed: false });
    expect(controller.tick()).toEqual({ completed: true });
  });

  it('the page-level fallback (setSoundId(null) after an observed audioError) truthfully reports No Music with no error', async () => {
    const { controller } = setup({
      durationSeconds: 60,
      initialSoundId: 'IM02',
      resolveImpl: async () => {
        throw new Error('network down');
      }
    });
    controller.begin();
    await flushAsync();
    expect(controller.getSnapshot().audioError).toBe(true);
    controller.setSoundId(null); // what SelfGuidedMeditation.jsx's own heartbeat does on audioError
    const snapshot = controller.getSnapshot();
    expect(snapshot.soundId).toBeNull();
    expect(snapshot.audioError).toBe(false); // no "current" track left to report an error for
  });

  it('a play() rejection is caught the same way - never throws out of begin()', async () => {
    const createAudioElement = () => ({
      ...createFakeAudioElement(),
      play: () => Promise.reject(new Error('NotAllowedError'))
    });
    const resolveUrl = async (id) => ({ url: `https://signed.example/${id}` });
    const controller = createMeditationSessionController({
      styleId: 'quiet',
      durationSeconds: 2,
      initialSoundId: 'IM01',
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

describe('createMeditationSessionController — End Session and destroy()', () => {
  it('end() stops the current track and marks the session completed', async () => {
    const { controller, createAudioElement } = setup({ durationSeconds: 120, initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    const el = createAudioElement.mock.results[0].value;
    controller.end();
    expect(el.paused).toBe(true);
    expect(controller.getSnapshot().status).toBe('completed');
  });

  it('destroy() (unmount/route-change) releases every track ever created this session, including one paused-but-warm from an earlier switch', async () => {
    const { controller, createAudioElement } = setup({ durationSeconds: 120, initialSoundId: 'IM01' });
    controller.begin();
    await flushAsync();
    controller.setSoundId('IM02'); // IM01 now paused-but-warm, not destroyed
    await flushAsync();
    const im01El = createAudioElement.mock.results[0].value;
    const im02El = createAudioElement.mock.results[1].value;
    const im01Load = vi.spyOn(im01El, 'load');
    const im02Load = vi.spyOn(im02El, 'load');

    controller.destroy();

    expect(im01El.paused).toBe(true);
    expect(im01El.src).toBe('');
    expect(im01Load).toHaveBeenCalled();
    expect(im02El.paused).toBe(true);
    expect(im02El.src).toBe('');
    expect(im02Load).toHaveBeenCalled();
  });

  it('destroy() with No Music selected (nothing ever played) never throws', () => {
    const { controller } = setup({ initialSoundId: null });
    controller.begin();
    expect(() => controller.destroy()).not.toThrow();
  });
});
