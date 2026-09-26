// Alarm sound — NotificationSettings.jsx's own wiring to the shared
// AlarmSoundPicker component. Source-level regression guard, matching
// this codebase's established pattern for React component files that
// can't practically be rendered under this repo's Node-environment
// Vitest (no DOM - see signOutIsolation.test.js's own note).
//
// The picker's own full behavioural test suite (registry integrity,
// select/preview separation, disabled+badge behaviour, touch targets,
// preview lifecycle, cleanup, feedback, native gating) now lives in
// src/components/AlarmSoundPicker.test.js, next to the component itself
// (Welcome alarm-status card work - the picker was extracted out of this
// page so Onboarding.jsx's own new alarm setup step could embed the
// exact same, already-tested implementation instead of a second one).
// This file keeps only what's specific to THIS page: that it actually
// renders the shared picker, and its own deep-link scroll behaviour.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const source = read('./NotificationSettings.jsx');

describe('NotificationSettings imports and renders the shared AlarmSoundPicker', () => {
  it('imports it from the shared components directory - never a locally re-declared picker', () => {
    expect(source).toMatch(/import \{ AlarmSoundPicker \} from '\.\.\/components\/AlarmSoundPicker';/);
  });

  it('is rendered next to MorningReminderSection (the established wake-time/alarm area)', () => {
    expect(source).toMatch(/<MorningReminderSection \/>\s*\n\s*<AlarmSoundPicker \/>/);
  });
});

describe('deep-link scroll: /settings/notifications#alarm-sound lands directly on the Alarm Sound section', () => {
  it('reads the current hash via useLocation', () => {
    expect(source).toMatch(/import \{ useLocation \} from 'react-router-dom';/);
    expect(source).toMatch(/const \{ hash \} = useLocation\(\);/);
  });

  it('scrolls the #alarm-sound element into view only when the hash actually targets it', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(hash !== '#alarm-sound'\) return;[\s\S]*?\n {2}\}, \[hash\]\);/)?.[0] ?? '';
    expect(effectBody).not.toBe('');
    expect(effectBody).toMatch(/document\.getElementById\('alarm-sound'\)\?\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\);/);
  });
});

describe('honest platform-limit disclosure: this picker never claims to affect the native background reminder notification', () => {
  it('MorningReminderSection\'s own enabled-state copy clarifies the picker only applies while WakeWise is open', () => {
    expect(source).toMatch(/Uses your iPhone's default notification sound, even if you choose a different sound below/);
    expect(source).toMatch(/the Alarm sound\s*\n\s*picker only applies while WakeWise is open\./);
  });
});
