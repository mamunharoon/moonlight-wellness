// Journey Embedding — Audio lifecycle proof, consolidated across the whole
// embedded-meditation feature (complementing the per-file assertions
// already in useMeditationSession.test.js/meditationSessionController.
// test.js/meditationAudioController.test.js). Source-level, matching this
// repo's established convention (`node` Vitest environment, no DOM).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const hookSource = read('./useMeditationSession.js');
const morningMeditateSource = read('../pages/MorningMeditate.jsx');
const eveningMeditateSource = read('../pages/EveningMeditate.jsx');
const breatheSource = read('../pages/Breathe.jsx');
const eveningBreathingSource = read('../pages/EveningBreathing.jsx');
const interactiveAmbientMusicSource = read('../components/InteractiveAmbientMusic.jsx');
const audioControllerSource = read('../lib/meditationAudioController.js');

describe('Breathing audio is destroyed before Meditation audio begins', () => {
  it('the two screens are on different top-level routes, never composed together in one component tree - React unmounts the outgoing route (and its InteractiveAmbientMusic cleanup effect) before mounting the incoming one', () => {
    expect(breatheSource).toMatch(/navigate\('\/morning-meditate'\);/);
    expect(eveningBreathingSource).toMatch(/navigate\('\/evening-meditate'\);/);
    // Neither embedded meditation page renders InteractiveAmbientMusic -
    // it's a genuinely different audio source (meditationSessionController's
    // own controller), never sharing an element or overlapping mount.
    expect(morningMeditateSource).not.toMatch(/InteractiveAmbientMusic/);
    expect(eveningMeditateSource).not.toMatch(/InteractiveAmbientMusic/);
  });

  it('InteractiveAmbientMusic\'s own unmount cleanup (pause + removeAttribute(src) + load()) is unchanged - proven once, reused by every screen that renders it, including Breathe/EveningBreathing', () => {
    const cleanupEffect = interactiveAmbientMusicSource.match(/useEffect\(\(\) => \{\s*\n\s*const audio = audioRef\.current;\s*\n\s*return \(\) => \{[\s\S]*?\n {4}\};\s*\n {2}\}, \[\]\);/)?.[0] ?? '';
    expect(cleanupEffect).toMatch(/audio\.pause\(\);/);
    expect(cleanupEffect).toMatch(/audio\.removeAttribute\('src'\);/);
    expect(cleanupEffect).toMatch(/audio\.load\(\);/);
  });
});

describe('At most one meditation audio instance plays at a time', () => {
  it('meditationSessionController.js (reused verbatim, zero changes) already guarantees this via its Map-keyed audioControllers, one per track id - see that module\'s own real-execution tests', () => {
    expect(hookSource).toMatch(/import \{ createMeditationSessionController \} from '\.\.\/lib\/meditationSessionController';/);
    // Build 16 physical-iPhone correction (F3/F4/F7) — the hook itself
    // still never constructs a second controller INSTANCE: the one real
    // assignment now lives in getOrCreateController() (guarded by its own
    // `if (!controllerRef.current)` check), called from both preload()
    // and begin() - either can be first, but only one of them ever
    // actually creates the instance for a given visit. Two null-reset
    // sites now exist (cleanupSession, unchanged; and the new
    // cancelPreload(), which destroys a preloaded-but-never-begun
    // controller on Back/Cancel during the countdown) - both are
    // deliberate, not a duplication of the same concern.
    const controllerAssignments = hookSource.match(/controllerRef\.current = createMeditationSessionController\(/g) ?? [];
    expect(controllerAssignments.length).toBe(1);
    const nullResets = hookSource.match(/controllerRef\.current = null;/g) ?? [];
    expect(nullResets.length).toBe(2);
  });
});

describe('Skip starts no audio', () => {
  it('handleSkip in both embedded pages calls handleComplete, which never calls session.begin() - the only function that ever constructs an audio-capable controller', () => {
    expect(morningMeditateSource).toMatch(/const handleSkip = \(\) => handleComplete\(\);/);
    expect(eveningMeditateSource).toMatch(/const handleSkip = \(\) => handleComplete\(\);/);
    const morningCompleteBody = morningMeditateSource.match(/const handleComplete = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const eveningCompleteBody = eveningMeditateSource.match(/const handleComplete = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(morningCompleteBody).not.toMatch(/\.begin\(\)/);
    expect(eveningCompleteBody).not.toMatch(/\.begin\(\)/);
  });
});

describe('End Meditation destroys audio', () => {
  it('endSession calls cleanupSession, which destroys the controller (and, via the controller\'s own destroy(), every audio track it ever created this session)', () => {
    const body = hookSource.match(/const endSession = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/cleanupSession\(\);/);
    const cleanupBody = hookSource.match(/const cleanupSession = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(cleanupBody).toMatch(/controllerRef\.current\?\.destroy\(\);/);
  });
});

describe('Completion destroys audio before navigation', () => {
  it('cleanupSession() runs before onComplete() is called - the caller\'s navigate() can never fire while the controller/audio is still alive', () => {
    const beginBody = hookSource.match(/const begin = \(\) => \{[\s\S]*?\n\s*\}, 1000\);\s*\n {2}\};/)?.[0] ?? '';
    const cleanupIndex = beginBody.indexOf('cleanupSession();');
    const onCompleteIndex = beginBody.indexOf('onComplete?.(finished);');
    expect(cleanupIndex).toBeGreaterThan(0);
    expect(onCompleteIndex).toBeGreaterThan(cleanupIndex);
  });
});

describe('Back/Exit/refresh/unmount all destroy audio', () => {
  it('the hook\'s one unmount effect is the single place audio/interval are torn down for every one of these exits - Back and Exit in the embedded pages never navigate away without this effect firing (a real route change always unmounts the page)', () => {
    expect(hookSource).toMatch(/useEffect\(\(\) => \(\) => cleanupSession\(\), \[\]\);/);
  });

  it('a refresh remounts the page fresh - no elapsed-seconds/audio state is persisted anywhere in this file, so a reload can never resume a stale, already-destroyed audio element', () => {
    const codeOnly = hookSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/localStorage/);
    expect(codeOnly).not.toMatch(/sessionStorage/);
  });
});

describe('IM01/IM02 guest allowlist remains unchanged', () => {
  it('meditationAudioController.js still resolves through the same requestBetaVideoUrl - no new auth branch, no isGuest check introduced', () => {
    expect(audioControllerSource).toMatch(/import \{ requestBetaVideoUrl \} from '\.\/betaVideoAccess';/);
    const codeOnly = audioControllerSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/isGuest/);
  });

  it('the stale guest-access comment is corrected (IM01/IM02 are guest-allowlisted, not guest-restricted) without changing any real behaviour - same requestBetaVideoUrl call, same catch block, same lastError handling', () => {
    expect(audioControllerSource).toMatch(/GUEST_ALLOWED_IDS/);
    expect(audioControllerSource).toMatch(/NOT a\s*\n\s*\/\/ guest-vs-signed-in distinction/);
    expect(audioControllerSource).not.toMatch(/the Edge Function requires a signed-in, non-anonymous user/);
    // The real code path is untouched - still one resolveUrl call, one
    // catch, one lastError assignment.
    const startBody = audioControllerSource.match(/const start = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(startBody).toMatch(/await resolveUrl\(mediaId\);/);
    expect(startBody).toMatch(/lastError = error;/);
  });
});

describe('Guided catalogue authentication is unchanged', () => {
  it('no file touched by Journey Embedding imports or modifies betaVideoUrlAccess.ts / the Edge Function itself', () => {
    for (const source of [hookSource, morningMeditateSource, eveningMeditateSource, audioControllerSource]) {
      expect(source).not.toMatch(/resolveBetaVideoUrlRequest/);
      expect(source).not.toMatch(/GUEST_ALLOWED_IDS\.add|GUEST_ALLOWED_IDS\.delete/);
    }
  });
});
