// Welcome alarm-status card — AlarmStatusCard.jsx. Source-level
// regression guard (no DOM rendering in this repo's Vitest - see
// signOutIsolation.test.js's own note). Copy correctness itself is
// covered with real execution in alarmStatus.test.js; this file checks
// the component's own wiring: which props feed the copy resolver, the
// Morning-gold-only colour treatment (via the -tint opacity-safe token,
// never the plain-hex morning-accent var directly with a modifier), the
// deep-link destination, and touch target sizing.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./AlarmStatusCard.jsx');

describe('AlarmStatusCard reads its content from getAlarmStatusCardCopy, never invents its own copy', () => {
  it('imports the shared pure resolver and passes every real AlarmContext field through as props', () => {
    expect(source).toMatch(/import \{ getAlarmStatusCardCopy \} from '\.\.\/lib\/alarmStatus';/);
    expect(source).toMatch(/getAlarmStatusCardCopy\(\{\s*\n\s*variant,\s*\n\s*alarmConfigured,\s*\n\s*isAlarmSet,\s*\n\s*alarmTime,\s*\n\s*alarmSoundId\s*\n\s*\}\)/);
  });

  it('renders the resolved heading, detail and actionLabel - never a hardcoded string of its own for any of the three', () => {
    expect(source).toMatch(/\{heading\}/);
    expect(source).toMatch(/\{detail\}/);
    expect(source).toMatch(/\{actionLabel\}/);
  });
});

describe('Morning-gold-only colour treatment (the alarm belongs to the Morning experience, never another journey\'s colour)', () => {
  it('never uses a plain morning-accent/N opacity modifier (the established broken-on-plain-hex-var bug class) - only the -tint token', () => {
    expect(source).not.toMatch(/morning-accent\/\d/);
    expect(source).toMatch(/bg-morning-accent-tint\/15/);
    expect(source).toMatch(/border-morning-accent-tint\/20/);
    expect(source).toMatch(/border-morning-accent-tint\/40/);
  });

  it('solid text-morning-accent (no modifier) is used for the icon and action label text', () => {
    const matches = source.match(/text-morning-accent(?!-tint)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('never reaches for the peach primary or another journey\'s colour token', () => {
    expect(source).not.toMatch(/bg-primary|text-on-primary|evening-accent|bg-tertiary/);
  });
});

describe('deep-link destination', () => {
  it('always links to /onboarding with returnTo set to the caller-supplied Welcome route, URL-encoded', () => {
    expect(source).toMatch(/to=\{`\/onboarding\?returnTo=\$\{encodeURIComponent\(returnTo\)\}`\}/);
  });
});

describe('touch target and icon-per-state', () => {
  it('the action link is at least 44x44', () => {
    expect(source).toMatch(/min-h-\[44px\] min-w-\[44px\]/);
  });

  it('maps each of the three real kinds to its own icon - never a single icon regardless of state', () => {
    expect(source).toMatch(/const ICONS = \{ unset: 'wb_twilight', off: 'alarm_off', set: 'alarm' \};/);
  });
});
