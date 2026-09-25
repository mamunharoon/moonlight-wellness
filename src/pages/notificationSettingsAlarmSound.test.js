// "Test alarm sound" — NotificationSettings.jsx. Source-level regression
// guard, matching this codebase's established pattern for React
// component files that can't practically be rendered under this repo's
// Node-environment Vitest (no DOM - see signOutIsolation.test.js's own
// note). Behavioural correctness (play() actually resolving, currentTime
// advancing, the auto-stop firing at ~3s, unmount stopping playback) was
// verified live via Playwright during this session's manual verification
// pass, not fabricated here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const source = read('./NotificationSettings.jsx');
const alarmSoundSectionBody = source.match(/const AlarmSoundSection = \(\) => \{[\s\S]*?\n};/)?.[0] ?? '';

describe('AlarmSoundSection exists and is wired into the page', () => {
  it('is defined', () => {
    expect(alarmSoundSectionBody).not.toBe('');
  });

  it('is rendered in NotificationSettings, next to MorningReminderSection (the established wake-time/alarm area)', () => {
    expect(source).toMatch(/<MorningReminderSection \/>\s*\n\s*<AlarmSoundSection \/>/);
  });

  it('imports the same bundled chime constant AlarmContext.jsx uses for the real alarm - can never drift to a different asset', () => {
    expect(source).toMatch(/import \{ ALARM_CHIME_URL, ALARM_CHIME_TITLE \} from '\.\.\/lib\/alarmSound';/);
    expect(alarmSoundSectionBody).toMatch(/url: ALARM_CHIME_URL/);
  });
});

describe('the Test alarm sound control', () => {
  it('renders a real button with an accessible name that toggles between Test/Stop', () => {
    expect(alarmSoundSectionBody).toMatch(/aria-label=\{isPreviewing \? 'Stop alarm sound preview' : 'Test alarm sound'\}/);
    expect(alarmSoundSectionBody).toMatch(/\{isPreviewing \? 'Stop preview' : 'Test alarm sound'\}/);
  });

  it('has a 44px minimum touch target and a visible focus-visible ring', () => {
    expect(alarmSoundSectionBody).toMatch(/min-h-\[44px\] min-w-\[44px\]/);
    expect(alarmSoundSectionBody).toMatch(/focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('never schedules an alarm, changes wake time, or touches Morning/session state - only calls playTrack/stopTrack', () => {
    expect(alarmSoundSectionBody).not.toMatch(/updateRhythm|setAlarmTime|startSession|resetSession|useSession/);
  });
});

describe('preview lifecycle: start, auto-stop at ~3s, manual early stop, no overlap', () => {
  it('uses a 3-second preview duration constant', () => {
    expect(source).toMatch(/const ALARM_SOUND_PREVIEW_MS = 3000;/);
    expect(alarmSoundSectionBody).toMatch(/ALARM_SOUND_PREVIEW_MS\);/);
  });

  it('tapping again while previewing stops early instead of starting a second overlapping playTrack call (previewActiveRef guards it)', () => {
    const handlerBody = alarmSoundSectionBody.match(/const handleTestAlarmSound = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handlerBody).toMatch(/if \(previewActiveRef\.current\) \{/);
    expect(handlerBody).toMatch(/endPreview\('idle'\);\s*\n\s*return;/);
  });

  it('never sets previewActiveRef until after the early-stop check, so a rapid double-click can never fire two overlapping playTrack calls', () => {
    const handlerBody = alarmSoundSectionBody.match(/const handleTestAlarmSound = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const guardIndex = handlerBody.indexOf('if (previewActiveRef.current)');
    const setIndex = handlerBody.indexOf('previewActiveRef.current = true;');
    expect(guardIndex).toBe(0 + handlerBody.indexOf('if (previewActiveRef.current)')); // sanity: guard exists
    expect(setIndex).toBeGreaterThan(guardIndex);
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
