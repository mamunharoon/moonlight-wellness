// Alarm sound — AlarmSoundPicker.jsx (extracted from NotificationSettings.jsx
// during the Welcome alarm-status card work so Onboarding.jsx's own new
// alarm setup step can embed the identical, already-tested picker rather
// than a second implementation). Source-level regression guard, matching
// this codebase's established pattern for React component files that
// can't practically be rendered under this repo's Node-environment
// Vitest (no DOM - see signOutIsolation.test.js's own note).
//
// This file continues, unchanged in substance, the assertions previously
// written against NotificationSettings.jsx's own local AlarmSoundSection
// (see git history) - preserving every safety property the original
// single-button "Test alarm sound" control had (previewActiveRef
// ownership guard, 3s auto-stop, manual early stop, no overlapping
// playTrack calls, a real alarm ringing mid-preview is never cut short,
// cleanup on unmount, success/failure feedback, native-gated web
// guidance copy, 44px touch targets, visible focus rings) - now
// expressed per-row instead of for one hardcoded sound, and now shared
// by two real pages instead of one.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const source = read('./AlarmSoundPicker.jsx');
const alarmSoundsSource = read('../lib/alarmSounds.js');

describe('AlarmSoundPicker is a real, self-contained component', () => {
  it('is defined and exported', () => {
    expect(source).toMatch(/export const AlarmSoundPicker = \(\) => \{/);
  });

  it('imports the shared ALARM_SOUNDS registry - never a locally re-declared list that could drift from AlarmContext.jsx\'s own', () => {
    expect(source).toMatch(/import \{ ALARM_SOUNDS \} from '\.\.\/lib\/alarmSounds';/);
    expect(source).toMatch(/ALARM_SOUNDS\.map/);
  });

  it('reads and sets the real selection through useAlarm(), never a locally-invented selection state', () => {
    expect(source).toMatch(/const \{ isRinging, alarmSoundId, setAlarmSoundId \} = useAlarm\(\);/);
  });

  it('exposes a stable #alarm-sound anchor for deep-linking from elsewhere, rather than landing ambiguously at the top of a longer page', () => {
    expect(source).toMatch(/<section id="alarm-sound" className="space-y-2 scroll-mt-4">/);
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
    expect(source).toMatch(/role="radiogroup" aria-label="Alarm sound"/);
    expect(source).toMatch(/role="radio"/);
    expect(source).toMatch(/aria-checked=\{isSelected\}/);
  });

  it('selecting calls setAlarmSoundId, and is guarded to never fire for an unavailable sound', () => {
    const selectBody = source.match(/const handleSelectSound = \(sound\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(selectBody).toMatch(/if \(!sound\.available\) return;/);
    expect(selectBody).toMatch(/setAlarmSoundId\(sound\.id\);/);
  });

  it('unavailable sounds show a "Coming soon" badge and a disabled radio button', () => {
    expect(source).toMatch(/disabled=\{!sound\.available\}/);
    expect(source).toMatch(/Coming soon/);
  });

  it('only available sounds get a preview button', () => {
    expect(source).toMatch(/\{sound\.available && \(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => handlePreview\(sound\)\}/);
  });

  it('every interactive row control has a 44px minimum touch target and a visible focus-visible ring', () => {
    expect(source).toMatch(/min-h-\[44px\][^"]*px-3 py-2\.5[\s\S]{0,120}focus-visible:ring-2 focus-visible:ring-primary/);
    expect(source).toMatch(/min-h-\[44px\] min-w-\[44px\][\s\S]{0,200}focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('never schedules an alarm, changes wake time, or touches Morning/session state - only calls playTrack/stopTrack and setAlarmSoundId', () => {
    expect(source).not.toMatch(/updateRhythm|setAlarmTime|startSession|resetSession|useSession/);
  });
});

describe('preview lifecycle: start, auto-stop at ~3s, manual early stop, no overlap across rows', () => {
  it('uses a 3-second preview duration constant', () => {
    expect(source).toMatch(/const ALARM_SOUND_PREVIEW_MS = 3000;/);
    expect(source).toMatch(/ALARM_SOUND_PREVIEW_MS\);/);
  });

  it('handlePreview does nothing for an unavailable sound', () => {
    const handlerBody = source.match(/const handlePreview = \(sound\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handlerBody).toMatch(/if \(!sound\.available\) return;/);
  });

  it('always stops whatever is currently previewing first (a different row, or the same one) before deciding what to do next - guarantees exactly one preview in flight, ever', () => {
    const handlerBody = source.match(/const handlePreview = \(sound\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handlerBody).toMatch(/stopCurrentPreview\(\);/);
    const stopIndex = handlerBody.indexOf('stopCurrentPreview();');
    const startIndex = handlerBody.indexOf('previewActiveRef.current = true;');
    expect(stopIndex).toBeGreaterThan(-1);
    expect(startIndex).toBeGreaterThan(stopIndex);
  });

  it('tapping the currently-previewing row again stops it early instead of restarting it', () => {
    const handlerBody = source.match(/const handlePreview = \(sound\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handlerBody).toMatch(/const wasPreviewingThisRow = previewActiveRef\.current && previewingId === sound\.id;/);
    expect(handlerBody).toMatch(/if \(wasPreviewingThisRow\) \{[\s\S]*?return;\s*\n\s*\}/);
  });

  it('a real alarm ringing mid-preview is never cut short by the preview auto-stop (checks isRinging before stopping)', () => {
    expect(source).toMatch(/if \(isRinging\) \{/);
    expect(source).toMatch(/if \(!previewActiveRef\.current \|\| isRinging\) return;/);
  });
});

describe('cleanup: unmount/navigation stops only a preview this component itself started', () => {
  it('has an unmount effect that clears the timeout and stops audio only when previewActiveRef.current is true', () => {
    const cleanupEffect = source.match(/useEffect\(\s*\n\s*\(\) => \(\) => \{[\s\S]*?\n {4}\},\s*\n\s*\[stopTrack\]\s*\n\s*\);/)?.[0] ?? '';
    expect(cleanupEffect).not.toBe('');
    expect(cleanupEffect).toMatch(/clearTimeout\(previewTimeoutRef\.current\)/);
    expect(cleanupEffect).toMatch(/if \(previewActiveRef\.current\) \{/);
    expect(cleanupEffect).toMatch(/stopTrack\(\);/);
  });
});

describe('success/failure feedback', () => {
  it('announces status via role="status" aria-live="polite" (subtle, non-disruptive)', () => {
    expect(source).toMatch(/role="status" aria-live="polite"/);
  });

  it('shows a success message once the preview completes, and a structured failure message (naming playbackError) on rejection', () => {
    expect(source).toMatch(/Alarm sound played successfully\./);
    expect(source).toMatch(/playbackError\s*\?/);
    expect(source).toMatch(/site sound is allowed for WakeWise/);
  });

  it('the web/PWA guidance copy is gated to non-native (isNativePlatform), so it never shows in the native app', () => {
    expect(source).toMatch(/import \{ isNativePlatform \} from '\.\.\/lib\/platform';/);
    expect(source).toMatch(/\{!native && \(/);
    expect(source).toMatch(/Keep WakeWise open and allow site sound for browser alarms\./);
  });
});
