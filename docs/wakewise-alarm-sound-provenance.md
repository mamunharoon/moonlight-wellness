# WakeWise Alarm Chime — Provenance

## Summary

`public/audio/wakewise-alarm-chime.wav` was generated specifically for WakeWise, entirely from mathematically synthesised sine tones. It contains no external recording, sample, loop, or third-party music of any kind, and does not reproduce any recognisable existing melody.

- **Generated**: 2026-09-25
- **Generator script**: `scripts/generate-wakewise-alarm-chime.mjs` (tracked in this repository)
- **Regeneration command**: `node scripts/generate-wakewise-alarm-chime.mjs` (deterministic — no randomness is used anywhere in the script, so re-running it reproduces the exact same file byte-for-byte)
- **SHA-256**: `2f44796092c5cdbf160cb549e0d48444b6402268de40e201ae08609750f99ff2`
- **Intended use**: WakeWise's foreground (in-page) alarm — both the real ringing/looping alarm sound and the "Test alarm sound" preview control in Notification Settings.

## Technical specification

| Property | Value |
|---|---|
| Format | PCM WAV (canonical 44-byte header) |
| Channels | 1 (mono) |
| Sample rate | 44,100 Hz |
| Bit depth | 16-bit signed |
| Duration | 8.30 seconds |
| File size | 732,104 bytes (~715 KB) |
| Peak level | −7.50 dBFS (verified via direct PCM sample inspection — no clipping; every sample stays within ±13,818 of the ±32,767 16-bit range) |
| First audible sample | ~150 ms from start |

## Sound design

Four individual pure sine tones, each with its own amplitude envelope, overlapping in onset to form a soft ascending arpeggio rather than four sequential beeps:

| Tone | Frequency | Onset | Decay |
|---|---|---|---|
| C5 | 523.25 Hz | 0.15 s | 3.4 s |
| E5 | 659.25 Hz | 1.00 s | 3.4 s |
| G5 | 783.99 Hz | 1.85 s | 3.6 s |
| C6 (resolution) | 1046.50 Hz | 2.90 s | 4.4 s |

Each tone's envelope is a short (20 ms) raised-cosine attack — smooth, no harsh click — followed by a pure exponential ("bell-like") decay reaching roughly 1% of its peak amplitude by the end of its own decay window. A 1-second true-silence pad follows the last tone's decay, so the real alarm's continuous loop always restarts during silence rather than cutting off mid-decay.

This is a generic four-note major-key ascending arpeggio (root, major third, perfect fifth, octave-plus-major-third) — a tonal shape used constantly in original scoring and UI sound design, not a transcription of, or reference to, any specific existing copyrighted melody.

## Confirmation

No external sample, recording, loop, or third-party music was used at any stage. The entire waveform is produced by summing sine functions (`Math.sin`) shaped by the envelope function described above, computed sample-by-sample in `scripts/generate-wakewise-alarm-chime.mjs`. The final buffer is peak-normalised (not compressed, clipped, or otherwise processed) to land at the target −7.5 dBFS.

This document records the factual generation history only and makes no legal/licensing claim beyond that history.
