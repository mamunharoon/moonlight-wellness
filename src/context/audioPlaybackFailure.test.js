// Missing-sound diagnosis — source-level regression guard.
// AudioContext.jsx's playTrack() previously called audio.play() and set
// isPlaying(true) unconditionally, without ever checking the Promise
// play() returns - any real failure (CSP block, browser autoplay-policy
// rejection, a bad/blocked source) was completely silent: isPlaying
// stayed true and nothing in the UI could ever know playback had not
// actually started. Not practically renderable in this repo's
// Node-environment Vitest (no DOM/no real HTMLMediaElement - matches this
// codebase's established source-level pattern, see
// signOutIsolation.test.js's own note); the exact real-world rejections
// this guards against (NotAllowedError, NotSupportedError) were captured
// live via an instrumented HTMLMediaElement.prototype.play during manual
// verification, not fabricated here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const audioContextSource = read('./AudioContext.jsx');
const alarmActiveSource = read('../pages/AlarmActive.jsx');

describe('playTrack() awaits and handles the play() promise instead of firing isPlaying(true) unconditionally', () => {
  const playTrackBody = audioContextSource.match(/const playTrack = useCallback\(\(track, \{ loop = false \} = \{\}\) => \{[\s\S]*?\n {2}\}, \[currentTrack\]\);/)?.[0] ?? '';

  it('exists and captures the return value of audio.play()', () => {
    expect(playTrackBody).not.toBe('');
    expect(playTrackBody).toMatch(/const playPromise = audio\.play\(\);/);
  });

  it('only sets isPlaying(true) once the promise actually resolves', () => {
    expect(playTrackBody).toMatch(/playPromise\s*\n?\s*\.then\(\(\) => setIsPlaying\(true\)\)/);
  });

  it('on rejection, sets isPlaying(false) and records a structured playbackError (name + message) instead of throwing/crashing', () => {
    const catchBlock = playTrackBody.match(/\.catch\(\(err\) => \{[\s\S]*?\n {8}\}\);/)?.[0] ?? '';
    expect(catchBlock).toMatch(/setIsPlaying\(false\);/);
    expect(catchBlock).toMatch(/setPlaybackError\(\{ name: err\.name, message: err\.message \}\);/);
  });

  it('clears any previous playbackError at the start of a new playTrack() attempt', () => {
    const clearIndex = playTrackBody.indexOf('setPlaybackError(null)');
    const promiseIndex = playTrackBody.indexOf('audio.play()');
    expect(clearIndex).toBeGreaterThan(-1);
    expect(clearIndex).toBeLessThan(promiseIndex);
  });
});

describe('playbackError is real provider state, exposed through the context value', () => {
  it('declares playbackError via useState(null)', () => {
    expect(audioContextSource).toMatch(/const \[playbackError, setPlaybackError\] = useState\(null\);/);
  });

  it('exposes playbackError on the AudioContext.Provider value', () => {
    const providerValue = audioContextSource.match(/<AudioContext\.Provider value=\{\{[\s\S]*?\}\}>/)?.[0] ?? '';
    expect(providerValue).toMatch(/playbackError/);
  });

  it('the sign-out sweep clears playbackError along with the other now-stale audio state', () => {
    const signOutBlock = audioContextSource.match(/onSignOutBroadcast\(\(\) => \{[\s\S]*?\n {4}\}\);/)?.[0] ?? '';
    expect(signOutBlock).toMatch(/setPlaybackError\(null\);/);
  });
});

describe('AlarmActive.jsx surfaces a visible, non-blocking warning when playback failed', () => {
  it('reads playbackError from useAudio()', () => {
    expect(alarmActiveSource).toMatch(/import \{ useAudio \} from '\.\.\/context\/AudioContext';/);
    expect(alarmActiveSource).toMatch(/const \{ playbackError \} = useAudio\(\);/);
  });

  it('renders a status message when playbackError is set, without hiding or disabling the three resolution controls', () => {
    expect(alarmActiveSource).toMatch(/\{playbackError && \(/);
    expect(alarmActiveSource).toMatch(/role="status"/);
    // The three resolution actions must remain in the JSX unconditionally -
    // the warning is additive, never a replacement/gate for them.
    expect(alarmActiveSource).toMatch(/Begin Your Morning/);
    expect(alarmActiveSource).toMatch(/Remind me shortly/);
    expect(alarmActiveSource).toMatch(/Skip this morning/);
  });
});

// Production-readiness correction: the alarm previously used a hardcoded
// third-party SoundHelix demo URL with no confirmed commercial license,
// production hotlink intent, or stability guarantee for WakeWise (an
// earlier version of this fix expanded both CSP declarations' media-src
// to allow soundhelix.com so that placeholder URL would load - that was
// explicitly the wrong fix; see docs/background-music-asset-manifest.md).
// It is now replaced by a first-party, locally bundled, mathematically-
// generated WakeWise chime (docs/wakewise-alarm-sound-provenance.md),
// served from the app's own origin - no CSP change was needed or made.
// This guard fails the build if a third-party media host, or either
// alarm reference, is silently reintroduced.
describe('the CSP media-src directive stays first-party-only (no external audio host has ever been approved)', () => {
  const vercelJsonSource = read('../../vercel.json');
  const indexHtmlSource = read('../../index.html');

  const extract = (src) => src.match(/media-src ([^;]+);/)?.[1];

  it('vercel.json\'s media-src allows only \'self\', blob:, and the app\'s own Supabase project - no third-party host', () => {
    expect(extract(vercelJsonSource)).toBe("'self' blob: https://kvdxuhyndevrfvsalgnx.supabase.co");
  });

  it('index.html\'s <meta> CSP (the policy that also governs the native Capacitor build) matches exactly - no soundhelix.com or any other external host', () => {
    expect(extract(indexHtmlSource)).toBe("'self' blob: https://kvdxuhyndevrfvsalgnx.supabase.co");
  });

  it('both CSP declarations stay in sync with each other', () => {
    expect(extract(vercelJsonSource)).toBe(extract(indexHtmlSource));
  });
});

describe('AlarmContext.jsx uses the bundled first-party WakeWise chime, with no SoundHelix or Unsplash reference remaining', () => {
  const alarmContextSource = read('./AlarmContext.jsx');

  it('imports ALARM_CHIME_URL/ALARM_CHIME_TITLE from lib/alarmSound', () => {
    expect(alarmContextSource).toMatch(/import \{ ALARM_CHIME_URL, ALARM_CHIME_TITLE \} from '\.\.\/lib\/alarmSound';/);
  });

  it('plays the bundled chime with loop:true, and no soundhelix.com or unsplash.com reference remains anywhere in the file', () => {
    expect(alarmContextSource).toMatch(/playTrack\(\{ title: ALARM_CHIME_TITLE, url: ALARM_CHIME_URL \}, \{ loop: true \}\);/);
    expect(alarmContextSource).not.toMatch(/soundhelix\.com/i);
    expect(alarmContextSource).not.toMatch(/unsplash\.com/i);
  });

  it('dismissAlarm() (shared by Begin and Skip) and snooze() both call stopTrack() to end the ring', () => {
    const dismissBody = alarmContextSource.match(/const dismissAlarm = \([\s\S]*?\n {2}\};/)?.[0] ?? '';
    const snoozeBody = alarmContextSource.match(/const snooze = \([\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(dismissBody).toMatch(/stopTrack\(\);/);
    expect(snoozeBody).toMatch(/stopTrack\(\);/);
  });
});

describe('the shared ALARM_CHIME_URL constant points at a locally bundled asset', () => {
  const alarmSoundSource = read('../lib/alarmSound.js');

  it('is a root-relative path under /audio, not an external URL', () => {
    expect(alarmSoundSource).toMatch(/export const ALARM_CHIME_URL = '\/audio\/wakewise-alarm-chime\.wav';/);
  });
});

describe('AudioContext.jsx supports looping and a genuine stop, both stable across renders', () => {
  const audioContextSource = read('./AudioContext.jsx');

  it('playTrack accepts an optional loop flag and sets it on the audio element', () => {
    expect(audioContextSource).toMatch(/const playTrack = useCallback\(\(track, \{ loop = false \} = \{\}\) => \{/);
    expect(audioContextSource).toMatch(/audio\.loop = loop;/);
  });

  it('exposes a stopTrack() that pauses, resets position/loop, and clears the current track', () => {
    const stopTrackBody = audioContextSource.match(/const stopTrack = useCallback\(\(\) => \{[\s\S]*?\n {2}\}, \[\]\);/)?.[0] ?? '';
    expect(stopTrackBody).toMatch(/audio\.pause\(\);/);
    expect(stopTrackBody).toMatch(/audio\.currentTime = 0;/);
    expect(stopTrackBody).toMatch(/audio\.loop = false;/);
    expect(stopTrackBody).toMatch(/setCurrentTrack\(null\);/);
  });

  it('playTrack, stopTrack, togglePlay and seek are all wrapped in useCallback - stable identities across unrelated renders (progress ticks) for any effect that lists them as a dependency', () => {
    expect(audioContextSource).toMatch(/const playTrack = useCallback\(/);
    expect(audioContextSource).toMatch(/const stopTrack = useCallback\(/);
    expect(audioContextSource).toMatch(/const togglePlay = useCallback\(/);
    expect(audioContextSource).toMatch(/const seek = useCallback\(/);
  });

  it('stopTrack is exposed on the provider value', () => {
    const providerValue = audioContextSource.match(/<AudioContext\.Provider value=\{\{[\s\S]*?\}\}>/)?.[0] ?? '';
    expect(providerValue).toMatch(/stopTrack/);
  });
});

describe('the bundled WAV asset itself (public/audio/wakewise-alarm-chime.wav) is a valid, non-clipping, appropriately-sized PCM file', () => {
  const buf = readFileSync(fileURLToPath(new URL('../../public/audio/wakewise-alarm-chime.wav', import.meta.url)));

  it('is a canonical PCM WAV: RIFF/WAVE/fmt /data, mono, 44.1kHz, 16-bit', () => {
    expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
    expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
    expect(buf.toString('ascii', 12, 16)).toBe('fmt ');
    expect(buf.readUInt16LE(20)).toBe(1); // PCM
    expect(buf.readUInt16LE(22)).toBe(1); // mono
    expect(buf.readUInt32LE(24)).toBe(44100);
    expect(buf.readUInt16LE(34)).toBe(16); // bit depth
    expect(buf.toString('ascii', 36, 40)).toBe('data');
  });

  it('declares a data size consistent with the actual file length', () => {
    const dataSize = buf.readUInt32LE(40);
    expect(44 + dataSize).toBe(buf.length);
  });

  it('duration is within the ~8-10s target and file size is a few hundred KB to ~1MB', () => {
    const dataSize = buf.readUInt32LE(40);
    const durationSeconds = dataSize / 2 / 44100;
    expect(durationSeconds).toBeGreaterThanOrEqual(8);
    expect(durationSeconds).toBeLessThanOrEqual(10);
    expect(buf.length).toBeGreaterThan(200_000);
    expect(buf.length).toBeLessThan(1_100_000);
  });

  it('never clips (no sample at or beyond +-32767) and peaks within -6..-9 dBFS', () => {
    let maxAbs = 0;
    for (let off = 44; off < buf.length; off += 2) {
      const abs = Math.abs(buf.readInt16LE(off));
      if (abs > maxAbs) maxAbs = abs;
    }
    expect(maxAbs).toBeLessThan(32767);
    const peakDbfs = 20 * Math.log10(maxAbs / 32768);
    expect(peakDbfs).toBeGreaterThanOrEqual(-9);
    expect(peakDbfs).toBeLessThanOrEqual(-6);
  });

  it('the first audible sample arrives within ~100-200ms (no long silence at the start)', () => {
    let firstNonZero = -1;
    for (let off = 44; off < buf.length; off += 2) {
      if (buf.readInt16LE(off) !== 0) {
        firstNonZero = (off - 44) / 2;
        break;
      }
    }
    expect(firstNonZero).toBeGreaterThan(-1);
    const ms = (firstNonZero / 44100) * 1000;
    expect(ms).toBeGreaterThanOrEqual(50);
    expect(ms).toBeLessThanOrEqual(250);
  });

  it('ends with a smooth trailing quiet period, not a hard cut, for a seamless-enough loop restart', () => {
    const dataSize = buf.readUInt32LE(40);
    const totalSamples = dataSize / 2;
    let lastLoud = -1;
    for (let off = 44; off < buf.length; off += 2) {
      if (Math.abs(buf.readInt16LE(off)) > 200) lastLoud = (off - 44) / 2;
    }
    const trailingSilenceSeconds = (totalSamples - lastLoud) / 44100;
    expect(trailingSilenceSeconds).toBeGreaterThan(0.2);
  });
});

describe('the generator script (scripts/generate-wakewise-alarm-chime.mjs) is deterministic and uses no external audio/network source', () => {
  const generatorSource = read('../../scripts/generate-wakewise-alarm-chime.mjs');

  it('never calls fetch/http/https or reads any external audio file - pure math synthesis only', () => {
    expect(generatorSource).not.toMatch(/\bfetch\(/);
    expect(generatorSource).not.toMatch(/require\(['"]https?['"]\)/);
    expect(generatorSource).not.toMatch(/\.mp3['"]|\.wav['"].*readFileSync|readFileSync.*\.(mp3|wav|ogg)/i);
  });

  it('has no source of randomness - Math.sin only, no Math.random - so it reproduces byte-for-byte on every run', () => {
    expect(generatorSource).not.toMatch(/Math\.random/);
    expect(generatorSource).toMatch(/Math\.sin/);
  });

  it('targets the documented sample rate, bit depth, and peak level', () => {
    expect(generatorSource).toMatch(/const SAMPLE_RATE = 44100;/);
    expect(generatorSource).toMatch(/const BITS_PER_SAMPLE = 16;/);
    expect(generatorSource).toMatch(/const CHANNELS = 1;/);
    expect(generatorSource).toMatch(/const TARGET_PEAK_DBFS = -7\.5;/);
  });

  it('writes to the exact path ALARM_CHIME_URL expects', () => {
    expect(generatorSource).toMatch(/'public', 'audio', 'wakewise-alarm-chime\.wav'/);
  });
});
