// Alarm sound — NotificationSettings.jsx's AlarmSoundSection. Source-level
// regression guard, matching this codebase's established pattern for
// React component files that can't practically be rendered under this
// repo's Node-environment Vitest (no DOM - see signOutIsolation.test.js's
// own note).
//
// WakeWise DEV — alarm wake-up sound picker: this file was previously a
// single "Test alarm sound" button; it now covers the 5-sound picker
// (alarmSounds.js) that replaced it, preserving every safety property
// the original button had (previewActiveRef ownership guard, 3s
// auto-stop, manual early stop, no overlapping playTrack calls, a real
// alarm ringing mid-preview is never cut short, cleanup on unmount,
// success/failure feedback, native-gated web guidance copy, 44px touch
// targets, visible focus rings) - now expressed per-row instead of for
// one hardcoded sound. Behavioural correctness (play() actually
// resolving, currentTime advancing, the auto-stop firing at ~3s, unmount
// stopping playback, selecting a row persisting the choice) was verified
// live via Playwright during this session's manual verification pass,
// not fabricated here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const source = read('./NotificationSettings.jsx');
const alarmSoundSectionBody = source.match(/const AlarmSoundSection = \(\) => \{[\s\S]*?\n};/)?.[0] ?? '';
const alarmSoundsSource = read('../lib/alarmSounds.js');

describe('AlarmSoundSection exists and is wired into the page', () => {
  it('is defined', () => {
    expect(alarmSoundSectionBody).not.toBe('');
  });

  it('is rendered in NotificationSettings, next to MorningReminderSection (the established wake-time/alarm area)', () => {
    expect(source).toMatch(/<MorningReminderSection \/>\s*\n\s*<AlarmSoundSection \/>/);
  });

  it('imports the shared ALARM_SOUNDS registry - never a locally re-declared list that could drift from AlarmContext.jsx\'s own', () => {
    expect(source).toMatch(/import \{ ALARM_SOUNDS \} from '\.\.\/lib\/alarmSounds';/);
    expect(alarmSoundSectionBody).toMatch(/ALARM_SOUNDS\.map/);
  });

  it('reads and sets the real selection through useAlarm(), never a locally-invented selection state', () => {
    expect(alarmSoundSectionBody).toMatch(/const \{ isRinging, alarmSoundId, setAlarmSoundId \} = useAlarm\(\);/);
  });
});

describe('the sound registry itself', () => {
  it('has exactly 5 entries with the required names, Gentle Chimes first and marked available', () => {
    expect(alarmSoundsSource).toMatch(/id: 'gentle-chimes', label: 'Gentle Chimes', title: ALARM_CHIME_TITLE, url: ALARM_CHIME_URL, available: true/);
    for (const label of ['Morning Piano', 'Birdsong & Chimes', 'Warm Marimba', 'Bright Chimes']) {
      expect(alarmSoundsSource).toContain(`label: '${label}'`);
    }
  });

  it('the four not-yet-recorded sounds carry no url and are explicitly unavailable - never reassigned an unrelated existing track', () => {
    const unavailableEntries = alarmSoundsSource.match(/\{ id: '(?:morning-piano|birdsong-chimes|warm-marimba|bright-chimes)'[^}]*\}/g) ?? [];
    expect(unavailableEntries.length).toBe(4);
    for (const entry of unavailableEntries) {
      expect(entry).toMatch(/url: null/);
      expect(entry).toMatch(/available: false/);
    }
  });

  it('resolvePlayableAlarmSound always falls back to the real default for an unavailable or unknown id', () => {
    expect(alarmSoundsSource).toMatch(/export const resolvePlayableAlarmSound = \(id\) => \{/);
    expect(alarmSoundsSource).toMatch(/return sound\?\.available \? sound : ALARM_SOUNDS\.find\(\(s\) => s\.id === DEFAULT_ALARM_SOUND_ID\);/);
  });

  it('persistence is user-scoped, mirroring dailyCompletion.js\'s own established scopedKey pattern (never a bare unscoped key for a registered user)', () => {
    expect(alarmSoundsSource).toMatch(/const scopedKey = \(userId\) => \(userId \? `\$\{ALARM_SOUND_BASE_KEY\}:\$\{userId\}` : ALARM_SOUND_BASE_KEY\);/);
  });
});

describe('each row: selectable, previewable if available, disabled and badged if not', () => {
  it('renders a real radiogroup with one radio button per sound', () => {
    expect(alarmSoundSectionBody).toMatch(/role="radiogroup" aria-label="Alarm sound"/);
    expect(alarmSoundSectionBody).toMatch(/role="radio"/);
    expect(alarmSoundSectionBody).toMatch(/aria-checked=\{isSelected\}/);
  });

  it('selecting calls setAlarmSoundId, and is guarded to never fire for an unavailable sound', () => {
    const selectBody = alarmSoundSectionBody.match(/const handleSelectSound = \(sound\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(selectBody).toMatch(/if \(!sound\.available\) return;/);
    expect(selectBody).toMatch(/setAlarmSoundId\(sound\.id\);/);
  });

  it('unavailable sounds show a "Coming soon" badge and a disabled radio button', () => {
    expect(alarmSoundSectionBody).toMatch(/disabled=\{!sound\.available\}/);
    expect(alarmSoundSectionBody).toMatch(/Coming soon/);
  });

  it('only available sounds get a preview button', () => {
    expect(alarmSoundSectionBody).toMatch(/\{sound\.available && \(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => handlePreview\(sound\)\}/);
  });

  it('every interactive row control has a 44px minimum touch target and a visible focus-visible ring', () => {
    expect(alarmSoundSectionBody).toMatch(/min-h-\[44px\][^"]*px-3 py-2\.5[\s\S]{0,120}focus-visible:ring-2 focus-visible:ring-primary/);
    expect(alarmSoundSectionBody).toMatch(/min-h-\[44px\] min-w-\[44px\][\s\S]{0,200}focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('never schedules an alarm, changes wake time, or touches Morning/session state - only calls playTrack/stopTrack and setAlarmSoundId', () => {
    expect(alarmSoundSectionBody).not.toMatch(/updateRhythm|setAlarmTime|startSession|resetSession|useSession/);
  });
});

describe('preview lifecycle: start, auto-stop at ~3s, manual early stop, no overlap across rows', () => {
  it('uses a 3-second preview duration constant', () => {
    expect(source).toMatch(/const ALARM_SOUND_PREVIEW_MS = 3000;/);
    expect(alarmSoundSectionBody).toMatch(/ALARM_SOUND_PREVIEW_MS\);/);
  });

  it('handlePreview does nothing for an unavailable sound', () => {
    const handlerBody = alarmSoundSectionBody.match(/const handlePreview = \(sound\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handlerBody).toMatch(/if \(!sound\.available\) return;/);
  });

  it('always stops whatever is currently previewing first (a different row, or the same one) before deciding what to do next - guarantees exactly one preview in flight, ever', () => {
    const handlerBody = alarmSoundSectionBody.match(/const handlePreview = \(sound\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handlerBody).toMatch(/stopCurrentPreview\(\);/);
    const stopIndex = handlerBody.indexOf('stopCurrentPreview();');
    const startIndex = handlerBody.indexOf('previewActiveRef.current = true;');
    expect(stopIndex).toBeGreaterThan(-1);
    expect(startIndex).toBeGreaterThan(stopIndex);
  });

  it('tapping the currently-previewing row again stops it early instead of restarting it', () => {
    const handlerBody = alarmSoundSectionBody.match(/const handlePreview = \(sound\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handlerBody).toMatch(/const wasPreviewingThisRow = previewActiveRef\.current && previewingId === sound\.id;/);
    expect(handlerBody).toMatch(/if \(wasPreviewingThisRow\) \{[\s\S]*?return;\s*\n\s*\}/);
  });

  it('a real alarm ringing mid-preview is never cut short by the preview auto-stop (checks isRinging before stopping)', () => {
    expect(alarmSoundSectionBody).toMatch(/if \(isRinging\) \{/);
    expect(alarmSoundSectionBody).toMatch(/if \(!previewActiveRef\.current \|\| isRinging\) return;/);
  });
});

describe('cleanup: unmount/navigation stops only a preview this component itself started', () => {
  it('has an unmount effect that clears the timeout and stops audio only when previewActiveRef.current is true', () => {
    const cleanupEffect = alarmSoundSectionBody.match(/useEffect\(\s*\n\s*\(\) => \(\) => \{[\s\S]*?\n {4}\},\s*\n\s*\[stopTrack\]\s*\n\s*\);/)?.[0] ?? '';
    expect(cleanupEffect).not.toBe('');
    expect(cleanupEffect).toMatch(/clearTimeout\(previewTimeoutRef\.current\)/);
    expect(cleanupEffect).toMatch(/if \(previewActiveRef\.current\) \{/);
    expect(cleanupEffect).toMatch(/stopTrack\(\);/);
  });
});

describe('success/failure feedback', () => {
  it('announces status via role="status" aria-live="polite" (subtle, non-disruptive)', () => {
    expect(alarmSoundSectionBody).toMatch(/role="status" aria-live="polite"/);
  });

  it('shows a success message once the preview completes, and a structured failure message (naming playbackError) on rejection', () => {
    expect(alarmSoundSectionBody).toMatch(/Alarm sound played successfully\./);
    expect(alarmSoundSectionBody).toMatch(/playbackError\s*\?/);
    expect(alarmSoundSectionBody).toMatch(/site sound is allowed for WakeWise/);
  });

  it('the web/PWA guidance copy is gated to non-native (isNativePlatform), so it never shows in the native app', () => {
    expect(source).toMatch(/import \{ isNativePlatform \} from '\.\.\/lib\/platform';/);
    expect(alarmSoundSectionBody).toMatch(/\{!native && \(/);
    expect(alarmSoundSectionBody).toMatch(/Keep WakeWise open and allow site sound for browser alarms\./);
  });
});

describe('honest platform-limit disclosure: this picker never claims to affect the native background reminder notification', () => {
  it('MorningReminderSection\'s own enabled-state copy now clarifies the picker only applies while WakeWise is open', () => {
    expect(source).toMatch(/Uses your iPhone's default notification sound, even if you choose a different sound below/);
    expect(source).toMatch(/the Alarm sound\s*\n\s*picker only applies while WakeWise is open\./);
  });
});
