/* eslint-disable no-unused-vars */
import { Link } from 'react-router-dom';
import { getAlarmStatusCardCopy } from '../lib/alarmStatus';

// Welcome alarm-status card - shown on both Welcome screens (First Visit
// and Welcome Back), each with its own exact copy for the same three
// real states (see alarmStatus.js's own per-variant copy matrix).
// Morning gold throughout, since the alarm belongs to the Morning
// experience - never the peach primary or another journey's colour.
//
// Reads AlarmContext's own real state via props (alarmConfigured,
// isAlarmSet, alarmTime, alarmSoundId) sourced directly from useAlarm()
// by the caller - no second localStorage key, no separate persistence
// model, and no local state of its own to go stale across a sign-out/
// sign-in (the caller's own useAlarm() call already re-derives per
// identity - see AlarmContext.jsx's identity-sync effect).
//
// The action always deep-links to /onboarding - the one real screen that
// can change wake time, enable/disable, timezone and alarm sound
// together (see Onboarding.jsx) - with returnTo set to whichever Welcome
// route the card itself is rendered on, so Save/Close land back here
// rather than on Home.
const ICONS = { unset: 'wb_twilight', off: 'alarm_off', set: 'alarm' };

export const AlarmStatusCard = ({ variant, alarmConfigured, isAlarmSet, alarmTime, alarmSoundId, returnTo }) => {
  const { kind, heading, detail, actionLabel } = getAlarmStatusCardCopy({
    variant,
    alarmConfigured,
    isAlarmSet,
    alarmTime,
    alarmSoundId
  });

  // morning-accent-tint (not morning-accent/N) for every opacity-modified
  // use below: morning-accent is a plain hex CSS variable, and a
  // Tailwind opacity modifier on a plain-hex var resolves to transparent
  // (this exact bug class, and the -tint RGB-triplet fix, is already
  // established elsewhere in this app - see JourneyGlow.jsx and
  // PreparationCountdown.jsx). Solid text-morning-accent (no modifier)
  // is unaffected and used as-is.
  return (
    // WakeWise DEV — Welcome vertical-space fix: p-4 -> p-3 and the icon
    // chip w-12 h-12/text-2xl -> w-10 h-10/text-xl (reducing padding/size
    // before touching the heading/detail text itself, per this app's own
    // established trim-spacing-first convention) - this card only ever
    // renders on Introduction.jsx's two Welcome variants (confirmed by
    // grep - no other caller exists), so the trim is fully scoped there.
    <div className="w-full glass-panel rounded-2xl p-2 flex items-center gap-3.5 border border-morning-accent-tint/20">
      <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-morning-accent-tint/15 text-morning-accent">
        <span
          className="material-symbols-outlined text-lg"
          aria-hidden="true"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {ICONS[kind]}
        </span>
      </span>
      <span className="flex-1 min-w-0 space-y-0.5 text-left">
        <span className="block text-sm font-bold text-on-surface">{heading}</span>
        <span className="block text-xs text-on-surface-variant truncate">{detail}</span>
      </span>
      <Link
        to={`/onboarding?returnTo=${encodeURIComponent(returnTo)}`}
        className="shrink-0 min-h-[44px] min-w-[44px] px-3 inline-flex items-center justify-center rounded-full border border-morning-accent-tint/40 text-morning-accent text-xs font-bold hover:bg-morning-accent-tint/10 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morning-accent"
      >
        {actionLabel}
      </Link>
    </div>
  );
};
