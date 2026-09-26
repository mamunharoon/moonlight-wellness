/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useAudio } from './AudioContext';
import { useAuth } from './AuthContext';
import { useSession } from './SessionContext';
import { supabase } from '../lib/supabaseClient';
import {
  detectDeviceTimezone,
  isValidTimezone,
  getZonedParts,
  setCachedTimezone,
  getDismissedMismatchTimezone,
  setDismissedMismatchTimezone
} from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { sanitizeIntentions } from '../lib/intentionSelection';
import { onSignOutBroadcast } from '../lib/signOutCleanup';
import { buildAlarmOccurrenceKey, getHandledAlarmOccurrence, markAlarmOccurrenceHandled, clearHandledAlarmOccurrence } from '../lib/alarmOccurrence';
import { resolvePlayableAlarmSound, getStoredAlarmSoundId, setStoredAlarmSoundId, DEFAULT_ALARM_SOUND_ID } from '../lib/alarmSounds';

const AlarmContext = createContext();

// WakeWise DEV — alarm wake-up sound picker. A unique object identity
// (never `===` to any real userId string or to `null`) used as the
// initial "not yet synced" sentinel for alarmSoundId's own render-time
// resync below - see that state's own doc comment.
const NOT_YET_SYNCED = Symbol('not-yet-synced');

const INTENTIONS_KEY = 'moonlight_intentions';
const LEGACY_INTENTION_KEY = 'moonlight_today_intention';
const DEFAULT_INTENTIONS = ['Stay calm', 'Be kind to yourself'];

// F1 (pre-Build-15 usability pass) — suggested-vs-selected distinction.
// Found live: a fresh guest's `intentions` state settles to
// DEFAULT_INTENTIONS on first render, and the guest-persist effect below
// immediately writes that untouched default into INTENTIONS_KEY - so by
// the time Home reads `intentions`, a never-touched default is byte-
// identical to a guest who deliberately picked exactly those two values.
// Comparing the VALUE against DEFAULT_INTENTIONS can never distinguish
// them (explicitly ruled out by the brief). The one reliable signal is
// WHETHER A SAVE EVER HAPPENED:
//   - Authenticated: a `user_intentions` row already only ever exists
//     after a genuine save (IntentionSetup.jsx/ChangeIntention.jsx's own
//     saveIntentionsToCloud) - row-fetched-successfully is already the
//     correct signal, no schema change needed.
//   - Guest: no equivalent signal existed, so this one new boolean is
//     the smallest addition that creates one, mirroring INTENTIONS_KEY's
//     own guest-only localStorage shape exactly (same identity-guarded
//     persist effect below, same reset-on-account-switch handling).
const INTENTIONS_CONFIRMED_KEY = 'moonlight_intentions_confirmed';

const getInitialIntentionsConfirmed = () => {
  try {
    return localStorage.getItem(INTENTIONS_CONFIRMED_KEY) === 'true';
  } catch {
    return false;
  }
};

// One or two intentions, ordered (index 0 = Primary, index 1 =
// Supporting), distinct case-insensitively - sanitizeIntentions is the
// single shared source of truth for that shape (also used to validate a
// freshly-fetched Supabase row), so a stored value with the wrong shape
// (empty, too many items, duplicates, non-strings) is never trusted
// as-is. A pre-existing single-intention record ([  'Stay calm'  ], from
// before this feature) already satisfies this and loads unchanged.
const readStoredIntentions = () => {
  try {
    const raw = localStorage.getItem(INTENTIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeIntentions(parsed);
    return sanitized.length > 0 ? sanitized : null;
  } catch {
    return null;
  }
};

// One-time local backward-compatibility migration from the retired
// moonlight_today_intention key (not the Stage 2B Group 5 cloud migration).
const migrateLegacyIntention = () => {
  let legacy = null;
  try {
    legacy = localStorage.getItem(LEGACY_INTENTION_KEY);
  } catch {
    return null;
  }
  if (!legacy || !legacy.trim()) return null;

  const migrated = [legacy.trim()];
  try {
    localStorage.setItem(INTENTIONS_KEY, JSON.stringify(migrated));
    // Only remove the legacy key once the new value has been written successfully.
    localStorage.removeItem(LEGACY_INTENTION_KEY);
  } catch {
    // Write failed - keep the legacy key for a future attempt, but still use
    // the migrated value in memory for this session.
  }
  return migrated;
};

const getInitialIntentions = () =>
  readStoredIntentions() || migrateLegacyIntention() || DEFAULT_INTENTIONS;

export const AlarmProvider = ({ children }) => {
  const { playTrack, stopTrack } = useAudio();
  const { user, loading: authLoading, isGuest, migrationRevision } = useAuth();
  // Stage 3C Group 3B2: a new, standalone line — does not modify the
  // protected useAuth() destructure above. See the Background Clock
  // Observer below for the only place this is actually used.
  const { state: sessionState, resetSession } = useSession();
  const userId = user && !user.is_anonymous ? user.id : null;
  const [alarmTime, setAlarmTime] = useState(() => {
    return localStorage.getItem('moonlight_wake_up_time') || '07:30';
  }); // HH:MM
  const [bedTime, setBedTime] = useState(() => {
    return localStorage.getItem('moonlight_bedtime') || '22:00';
  }); // HH:MM
  // WakeWise DEV — alarm wake-up sound picker. Local-only (see
  // alarmSounds.js's own doc comment for why this deliberately has no
  // Supabase column), read once auth has settled (below) so a registered
  // user never briefly sees a different identity's - or a guest's -
  // stored choice on this device before their own scoped value loads.
  const [alarmSoundId, setAlarmSoundIdState] = useState(DEFAULT_ALARM_SOUND_ID);
  // A plain state value (not a ref - React's own hooks rules disallow
  // reading/writing a ref during render, only inside effects/handlers),
  // matching React's own documented "adjust state during render" pattern
  // exactly (comparing against a previous-value state, not a ref). The
  // unique sentinel object (distinct from any real userId string or
  // null-for-guest) guarantees the very first real authLoading===false
  // render always re-syncs at least once.
  const [syncedIdentity, setSyncedIdentity] = useState(NOT_YET_SYNCED);
  // Global timezone correctness: the user's confirmed IANA timezone
  // (mirrors alarmTime/bedTime's own guest-localStorage/registered-
  // Supabase split below). null means "not yet confirmed" - every
  // day/reminder calculation in this app falls back to deviceTimezone
  // while it's null, so nothing is ever left uncomputable, but the app
  // still shows a one-time confirmation banner until the user (or
  // onboarding) explicitly sets it. Never guessed/defaulted to a fixed
  // zone like Melbourne - see the migration's own doc comment.
  const [timezone, setTimezoneState] = useState(() => {
    const stored = localStorage.getItem('moonlight_timezone');
    return isValidTimezone(stored) ? stored : null;
  });
  // Live device zone, re-read on mount only - if it changes mid-session
  // (rare; usually requires an OS timezone change or a page reload after
  // landing in a new zone) the mismatch check below re-evaluates on the
  // next full load, which is when it actually matters in practice.
  const [deviceTimezone] = useState(detectDeviceTimezone);
  const effectiveTimezone = timezone || deviceTimezone;
  // "Ask me later" - deliberately in-memory/session-only (never
  // localStorage), so the banner reliably reappears on the next full
  // load rather than being silently suppressed forever like a persisted
  // dismissal would be. Distinct from keepSavedTimezone's persisted,
  // value-specific dismissal below.
  const [mismatchSnoozedThisSession, setMismatchSnoozedThisSession] = useState(false);
  const timezoneMismatch = Boolean(
    timezone &&
    timezone !== deviceTimezone &&
    !mismatchSnoozedThisSession &&
    getDismissedMismatchTimezone() !== deviceTimezone
  );
  // First-time confirmation case: a real user (not still resolving auth)
  // with no confirmed timezone at all yet - distinct copy/actions from
  // the ongoing mismatch banner (see AlarmActive-style banners wherever
  // this is consumed).
  const timezoneUnconfirmed = Boolean(!authLoading && timezone === null && !mismatchSnoozedThisSession);
  const askTimezoneLater = () => setMismatchSnoozedThisSession(true);
  const [isAlarmSet, setIsAlarmSet] = useState(true);
  const [isRinging, setIsRinging] = useState(false);
  const [intentions, setIntentions] = useState(getInitialIntentions);
  // F1 — see getInitialIntentionsConfirmed's own doc comment above. This
  // initial value is only ever correct for the guest case (the
  // authenticated case is necessarily async - fetchIntention below - same
  // unavoidable limitation `intentions` itself already has); the
  // identity-sync layout effect further below corrects it before paint
  // either way, exactly like `intentions`.
  const [intentionsConfirmed, setIntentionsConfirmed] = useState(getInitialIntentionsConfirmed);

  // Morning Journey Progress State (With local storage synchronization for resume support)
  const [routineDuration, setRoutineDuration] = useState(() => {
    return localStorage.getItem('moonlight_duration') || 'standard';
  });
  const [journeyStep, setJourneyStep] = useState(() => {
    return localStorage.getItem('moonlight_journey_step') || '';
  });

  useEffect(() => {
    localStorage.setItem('moonlight_duration', routineDuration);
  }, [routineDuration]);

  useEffect(() => {
    localStorage.setItem('moonlight_journey_step', journeyStep);
  }, [journeyStep]);

  // Logout / cross-user client-state audit — journeyStep is this legacy
  // tracker's own React state, initialized once at mount and otherwise
  // never resynced on sign-out (unlike intentions/rhythm below, which
  // already re-sync per userId). A non-empty leftover value here feeds
  // useActiveRoutineStep's legacy-string fallback and could force the
  // next signed-in identity into a route that was never theirs. Resetting
  // it to '' also clears moonlight_journey_step via the persist effect
  // just above (it fires on every journeyStep change) — no separate
  // localStorage call needed.
  useEffect(() => {
    return onSignOutBroadcast(() => {
      setJourneyStep('');
      // Same-minute re-trigger defect fix — hygiene sweep, not load-
      // bearing for correctness (the stored key already embeds identity,
      // so a stale entry from the outgoing identity could never match a
      // different incoming identity's own computed key anyway) - see
      // alarmOccurrence.js's own doc comment.
      clearHandledAlarmOccurrence();
    });
  }, []);

  // Tracks the userId that `alarmTime`/`bedTime` currently reflect. On the
  // render where an authenticated user signs out, that state still briefly
  // holds their cloud rhythm before the identity-sync effect below corrects
  // it - without this guard that stale value would get written into guest
  // localStorage, permanently overwriting the guest's own saved rhythm.
  const settledRhythmUserIdRef = useRef(userId);

  // Guest-only local persistence. Wait for auth resolution to finish so a
  // signed-in user's session (still resolving on initial load) never gets
  // mistaken for guest state and written to localStorage.
  useEffect(() => {
    if (authLoading || !isGuest) return;
    if (settledRhythmUserIdRef.current !== userId) return;
    localStorage.setItem('moonlight_wake_up_time', alarmTime);
  }, [alarmTime, authLoading, isGuest, userId]);

  useEffect(() => {
    if (authLoading || !isGuest) return;
    if (settledRhythmUserIdRef.current !== userId) return;
    localStorage.setItem('moonlight_bedtime', bedTime);
  }, [bedTime, authLoading, isGuest, userId]);

  useEffect(() => {
    if (authLoading || !isGuest) return;
    if (settledRhythmUserIdRef.current !== userId) return;
    if (timezone) localStorage.setItem('moonlight_timezone', timezone);
    else localStorage.removeItem('moonlight_timezone');
  }, [timezone, authLoading, isGuest, userId]);

  // WakeWise DEV — alarm wake-up sound picker. Unlike alarmTime/bedTime/
  // timezone above, this is local-only for BOTH guests and registered
  // users (see alarmSounds.js's own doc comment) - so this reads the
  // current identity's own scoped value once auth has settled, for
  // either case, rather than splitting on isGuest like the rhythm
  // effects above do (those split because only guests persist to
  // localStorage at all; the signed-in half goes to Supabase instead -
  // this preference has no Supabase half to fall through to).
  //
  // React's own documented "adjust state during render" pattern (not a
  // useEffect) - deliberately, to avoid the react-hooks/set-state-in-effect
  // violation a plain `useEffect(() => setAlarmSoundIdState(...), [userId])`
  // would trip (already established elsewhere in this codebase - see
  // BetaVideoModal.jsx's own doc comment on the same rule). `syncedIdentityRef`
  // tracks which identity (or `undefined` for "not yet resolved") the
  // current `alarmSoundId` state actually reflects; a render whose real
  // identity has moved on from that recorded value adjusts state right
  // here, synchronously, before paint - React explicitly supports calling
  // setState during render for exactly this "resync to a changed input"
  // case, and coalesces it into the same render pass rather than
  // triggering the effect-timing cascade the lint rule warns about.
  if (!authLoading && syncedIdentity !== userId) {
    setSyncedIdentity(userId);
    const stored = getStoredAlarmSoundId(userId);
    if (stored !== alarmSoundId) setAlarmSoundIdState(stored);
  }

  const setAlarmSoundId = (id) => {
    setAlarmSoundIdState(id);
    setStoredAlarmSoundId(userId, id);
  };

  // Synchronous cache mirror for plain-JS modules outside React (see
  // src/lib/timezone.js's file header) - kept in sync for BOTH guests and
  // registered users, unlike the guest-only persistence effect above.
  // Mirrors effectiveTimezone (falls back to the live device zone while
  // unconfirmed) so a reminder never has no zone to compute against.
  useEffect(() => {
    setCachedTimezone(effectiveTimezone);
  }, [effectiveTimezone]);

  // Tracks the userId that `intentions` state currently reflects. On the
  // render where an authenticated user signs out, `intentions` still briefly
  // holds their cloud value before the identity-sync effect below corrects
  // it - without this guard that stale value would get written into guest
  // localStorage, permanently overwriting the guest's own saved intention.
  const settledIntentionsUserIdRef = useRef(userId);

  useEffect(() => {
    if (authLoading || !isGuest) return;
    if (settledIntentionsUserIdRef.current !== userId) return;
    localStorage.setItem(INTENTIONS_KEY, JSON.stringify(intentions));
  }, [intentions, authLoading, isGuest, userId]);

  // F1 — same identity guard as the intentions-persist effect just above,
  // so a stale outgoing identity's confirmed flag can never be written
  // into the next guest's storage.
  useEffect(() => {
    if (authLoading || !isGuest) return;
    if (settledIntentionsUserIdRef.current !== userId) return;
    localStorage.setItem(INTENTIONS_CONFIRMED_KEY, intentionsConfirmed ? 'true' : 'false');
  }, [intentionsConfirmed, authLoading, isGuest, userId]);

  // Fetch sleep/wake rhythms from Supabase
  const fetchRhythm = async (uid) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('rhythms')
      .select('wake_up_time, bedtime, timezone')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.error('Error fetching rhythm:', error.message);
      return;
    }

    if (data) {
      setAlarmTime(data.wake_up_time);
      setBedTime(data.bedtime);
      setTimezoneState(isValidTimezone(data.timezone) ? data.timezone : null);
    }
  };

  // Keep rhythm state in sync with the current auth identity, mirroring the
  // intentions identity-sync below. Guests (including right after sign-out)
  // always restore their own stored rhythm, never a previous session's cloud
  // values. Authenticated users are reset to the neutral defaults before
  // fetching their own row, so switching between two accounts never briefly
  // shows the prior account's rhythm.
  // useLayoutEffect (not useEffect): the synchronous reset to a neutral
  // value below must commit before the browser paints, so a mounted Home
  // can never paint even one frame of the outgoing identity's rhythm
  // while this identity's own fetch is still in flight.
  useLayoutEffect(() => {
    const syncRhythm = async () => {
      if (!userId) {
        const guestAlarm = localStorage.getItem('moonlight_wake_up_time') || '07:30';
        const guestBed = localStorage.getItem('moonlight_bedtime') || '22:00';
        const guestTimezone = localStorage.getItem('moonlight_timezone');
        setAlarmTime(guestAlarm);
        setBedTime(guestBed);
        setTimezoneState(isValidTimezone(guestTimezone) ? guestTimezone : null);
        // Only mark this identity settled once the guest values are in
        // place, so the persist-write effects above never fire in between.
        settledRhythmUserIdRef.current = userId;
        return;
      }

      setAlarmTime('07:30');
      setBedTime('22:00');
      setTimezoneState(null);
      await fetchRhythm(userId);
      // Only mark this identity settled once the fetch has resolved, so the
      // transition into this account's rhythm is fully established first.
      settledRhythmUserIdRef.current = userId;
    };

    syncRhythm();
    // migrationRevision: re-run this same identity-sync logic after a
    // successful guest-to-account migration (Group 5.3), so a rhythm row
    // written during migration appears without requiring a manual page
    // refresh. Idempotent either way - re-fetching an unchanged cloud state
    // just re-sets the same values.
  }, [userId, migrationRevision]);

  // Fetch the current authenticated user's saved intentions (one or two,
  // ordered - Primary first) from Supabase. No row yet is not an error -
  // the existing local/default state is left untouched and nothing is
  // written back during a fetch. `intentions` (jsonb array) is
  // authoritative; `intention` (the older single-value column, still
  // mirrored to intentions[0] on every save) is only a defensive
  // fallback for the theoretical case of a row whose `intentions` column
  // is missing/empty - every real row was backfilled by
  // 20260919130000_user_intentions_ordered_list.sql, so this fallback
  // should never actually be exercised in practice.
  const fetchIntention = async (uid) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('user_intentions')
      .select('intention, intentions')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.error('Error fetching intention:', error.message);
      return;
    }
    if (!data) return;

    const fetched = sanitizeIntentions(data.intentions);
    if (fetched.length > 0) {
      setIntentions(fetched);
      // F1 — a row existing at all is already proof of a genuine past
      // save (see this file's own top comment); never inferred from the
      // fetched VALUE.
      setIntentionsConfirmed(true);
    } else if (typeof data.intention === 'string' && data.intention.trim().length > 0) {
      setIntentions([data.intention]);
      setIntentionsConfirmed(true);
    }
  };

  // Keep intention state in sync with the current auth identity. Guests
  // (including right after sign-out) always restore from the local guest
  // source, never from a previous session's cloud data. Authenticated users
  // are reset to the default before fetching their own row, so switching
  // between two accounts never briefly shows the prior account's intention.
  // useLayoutEffect (not useEffect): User A's intentions must never paint
  // for even one frame while User B's own fetch is in flight - the
  // synchronous reset below must commit before the browser paints.
  useLayoutEffect(() => {
    const syncIntentions = async () => {
      // Mark this identity as settled before touching state, so the guest
      // persist-write effect above never captures the outgoing identity's
      // stale intentions value on this same render.
      settledIntentionsUserIdRef.current = userId;

      if (!userId) {
        setIntentions(getInitialIntentions());
        // F1 — re-read fresh on every guest transition (e.g. right after
        // sign-out), exactly like getInitialIntentions() itself just
        // above - never carried over from a previous identity's state.
        setIntentionsConfirmed(getInitialIntentionsConfirmed());
        return;
      }

      setIntentions(DEFAULT_INTENTIONS);
      // F1 — reset to unconfirmed before the fetch, so a freshly signed-in
      // identity never briefly inherits a previous identity's confirmed
      // flag while its own row is still loading. fetchIntention sets this
      // true only if a real row exists.
      setIntentionsConfirmed(false);
      await fetchIntention(userId);
    };

    syncIntentions();
    // migrationRevision: see the matching rhythm-sync effect above - same
    // reasoning applies to a migrated intention row.
  }, [userId, migrationRevision]);

  // Same-minute re-fire guard for the Background Clock Observer below -
  // see its own doc comment.
  const lastFiredKeyRef = useRef(null);

  // Background Clock Observer
  //
  // Global timezone correctness: compares against the user's own
  // EFFECTIVE timezone's wall-clock time (getZonedParts), never the raw
  // device clock's getHours()/getMinutes(). This is the actual fix for
  // "two users with the same 6:30 AM wake time must both fire at 6:30 AM
  // their own local time" - effectiveTimezone falls back to the live
  // device zone only until the user has a confirmed timezone, and stays
  // pinned to their last-confirmed zone across travel until they
  // explicitly choose "Use current timezone" on the mismatch banner
  // (see timezoneMismatch/useCurrentTimezone below) - so a saved-zone
  // alarm keeps firing at the SAVED zone's 6:30 AM even mid-flight,
  // exactly as required, not wherever the device clock currently reads.
  useEffect(() => {
    const checkTime = () => {
      // Stage 3C Group 3D Batch E: re-fire guard now reads the Session
      // Engine directly instead of journeyStep. 'playing' and 'completed'
      // are the only two statuses that always coincide with a non-empty
      // journeyStep (mid-journey, and finished-but-not-yet-returned-home
      // respectively) - both must keep blocking a new alarm. 'interrupted'
      // (snooze) and 'skipped' (Skip Routine) both coincide with an EMPTY
      // journeyStep today and must keep allowing a fresh fire - snooze's
      // whole purpose is a delayed re-fire, and an abandoned session must
      // not permanently block the next alarm. 'idle' obviously allows it.
      if (!isAlarmSet || isRinging || sessionState.status === 'playing' || sessionState.status === 'completed') return;

      const zoned = getZonedParts(effectiveTimezone, devNow());
      const currentTimeString = zoned.hm;

      // Global timezone correctness fix-along: dismissing the alarm
      // (Begin/Snooze/Skip, all three clear isRinging) within the same
      // clock-minute it fired used to let the very next 1-second tick
      // immediately re-fire it, since isAlarmSet/isRinging/session-status
      // were all clear again and currentTimeString still equalled
      // alarmTime for the rest of that real minute - a real repeating-
      // alarm bug, not just a testing artifact (reproduced directly while
      // verifying alarm firing across timezones with a held clock).
      // firedKey (day + minute, in the user's own zone) makes a fire a
      // once-per-minute-per-day event: dismissing no longer risks an
      // immediate re-fire, and a genuinely new minute (or a new alarmTime
      // from Snooze) always clears it naturally since the key changes.
      const firedKey = `${zoned.dateKey}T${currentTimeString}`;
      if (lastFiredKeyRef.current === firedKey) return;

      if (currentTimeString === alarmTime) {
        // Same-minute re-trigger defect fix — lastFiredKeyRef alone only
        // protects the current live session; it resets to null on any
        // reload/remount. This second, PERSISTED check catches the exact
        // case that leaves open: the user already explicitly resolved
        // this occurrence (Begin/Remind/Skip - see dismissAlarm/snooze
        // below) before a reload/manual URL navigation happened to land
        // within the same due-minute. Never true merely because the
        // alarm started ringing - only an explicit resolution writes this
        // marker - so a genuinely UNRESOLVED, still-ringing alarm is
        // still expected to reappear after a reload within the same
        // minute (the established, unchanged product decision - see
        // alarmOccurrence.js's own doc comment for the full reasoning).
        const occurrenceKey = buildAlarmOccurrenceKey({ identity: userId || 'guest', dateKey: zoned.dateKey, alarmTime });
        if (getHandledAlarmOccurrence() === occurrenceKey) {
          lastFiredKeyRef.current = firedKey;
          return;
        }

        lastFiredKeyRef.current = firedKey;
        setIsRinging(true);
        setJourneyStep('alarm');
        // Bundled, first-party WakeWise chime (docs/wakewise-alarm-sound-
        // provenance.md) - served from 'self', no CSP allowance needed, no
        // external request. Replaces the previous unlicensed third-party
        // SoundHelix placeholder. No `image` field - the previous
        // Unsplash decorative image was itself unlicensed AND separately
        // CSP-blocked (img-src); AlarmActive.jsx already has its own
        // purpose-built visual design and icon, so this is intentionally
        // omitted rather than replaced. loop: true - a real alarm must
        // keep ringing until the user explicitly resolves it via Begin/
        // Remind/Skip, not stop after one ~8s clip; every resolution path
        // (dismissAlarm/snooze, below) calls stopTrack() to end the loop.
        // WakeWise DEV — alarm wake-up sound picker: plays whichever real
        // sound the user selected (NotificationSettings.jsx's own
        // AlarmSoundSection); resolvePlayableAlarmSound always falls back
        // to the real default chime for an unavailable/unknown id, so
        // this can never silently play nothing or a broken URL.
        const ringingSound = resolvePlayableAlarmSound(alarmSoundId);
        playTrack({ title: ringingSound.title, url: ringingSound.url }, { loop: true });

        // Close Remaining Daily-Journey Limitations: the alarm/reminder
        // firing must only ever display AlarmActive - it must never create
        // or start a Session Engine session itself. The user's explicit
        // choice on that screen (Begin Rise & Reset / Snooze / Skip this
        // morning) is now the sole place a morning session can start (see
        // AlarmActive.jsx's handleUnlock). This intentionally removes the
        // previous eager startSession('morning-routine') call that used to
        // run here, ahead of any user choice.
      }
    };

    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
    // userId added (same-minute re-trigger defect fix) — checkTime now
    // reads it to build the occurrence key; without it in the dependency
    // list, a sign-in/sign-out that doesn't also change one of the other
    // deps in the same render could leave this closure using a stale
    // identity for the occurrence check.
  }, [alarmTime, isAlarmSet, isRinging, playTrack, sessionState.status, effectiveTimezone, userId, alarmSoundId]);

  // Snooze bumps today's alarm by 5 minutes - a temporary, one-off delay,
  // not a change to the user's configured wake-time preference. It must
  // not be persisted (local or cloud).
  const snooze = () => {
    // Same-minute re-trigger defect fix — mark the OLD (currently-due)
    // occurrence explicitly handled before shifting alarmTime, computed
    // fresh from the current effectiveTimezone/alarmTime (not from
    // lastFiredKeyRef, which only tracks the fired MINUTE, never the
    // identity-scoped occurrence). The new, +5-minute alarmTime set below
    // produces a genuinely different, never-yet-marked occurrence key on
    // its own - no separate "make the snoozed occurrence eligible" step
    // is needed; see alarmOccurrence.js's own doc comment.
    const zoned = getZonedParts(effectiveTimezone, devNow());
    markAlarmOccurrenceHandled(buildAlarmOccurrenceKey({ identity: userId || 'guest', dateKey: zoned.dateKey, alarmTime }));
    setIsRinging(false);
    setJourneyStep('');
    // Stops the looping ring immediately - it must not keep sounding
    // through the snooze interval until the new, later time fires.
    stopTrack();

    // Close Remaining Daily-Journey Limitations: the alarm/reminder no
    // longer starts a session on fire, so there is nothing to interrupt
    // here - Snooze never creates or touches a Session Engine session at
    // all. Defensive reset kept only for the unlikely case a stale
    // 'playing'/'interrupted' session survives from an unrelated flow, so
    // Snooze can never leave the engine in a state that blocks the next
    // alarm fire or a manually-started routine.
    if (sessionState.status === 'playing' || sessionState.status === 'interrupted') {
      resetSession();
    }

    const [hours, minutes] = alarmTime.split(':').map(Number);
    let newMinutes = minutes + 5;
    let newHours = hours;
    if (newMinutes >= 60) {
      newMinutes -= 60;
      newHours = (newHours + 1) % 24;
    }
    const newAlarmString = `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    setAlarmTime(newAlarmString);
  };

  // Same-minute re-trigger defect fix — the shared resolution path for
  // both Begin Your Morning and Skip This Morning (AlarmActive.jsx calls
  // this from both handlers): marks the current occurrence explicitly
  // handled, exactly like snooze() above, before clearing isRinging. This
  // is what makes Skip - which otherwise starts no session and never
  // touches alarmTime - immune to the same reload race Begin already
  // happened to be protected from by its own session start.
  const dismissAlarm = () => {
    const zoned = getZonedParts(effectiveTimezone, devNow());
    markAlarmOccurrenceHandled(buildAlarmOccurrenceKey({ identity: userId || 'guest', dateKey: zoned.dateKey, alarmTime }));
    setIsRinging(false);
    // Shared by Begin Your Morning and Skip This Morning - both must stop
    // the looping ring immediately, not leave it sounding (and stuck as
    // Layout.jsx's global persistent-audio mini-player) into the Morning
    // routine or after skipping.
    stopTrack();
  };

  // Explicit save for registered users only - a true upsert on the
  // rhythms_user_id_key unique constraint. No select-before-write.
  // newTimezone is nullable (still unconfirmed) - explicitly upserted as
  // such rather than omitted, so a real "not yet set" is never confused
  // with "leave whatever is already in the row alone".
  const saveRhythm = async (newAlarm, newBed, newTimezone) => {
    if (!supabase || !userId) return;

    const { error } = await supabase
      .from('rhythms')
      .upsert(
        {
          user_id: userId,
          wake_up_time: newAlarm,
          bedtime: newBed,
          timezone: newTimezone ?? null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error saving rhythm:', error.message);
    }
  };

  // Single explicit entry point for pages to commit a configured wake/bed
  // (and, since global timezone correctness, timezone) change. Always
  // updates local state (which guests already persist to localStorage via
  // the effect above); additionally persists to Supabase for registered
  // users only. Callers do not need to know whether the current user is a
  // guest or registered. newTimezone is optional - omitted (undefined)
  // means "don't change the currently-held timezone", so existing
  // wake/bed-only call sites can't accidentally clear an already-
  // confirmed timezone.
  const updateRhythm = (newAlarm, newBed, newTimezone) => {
    // Same-minute re-trigger defect fix, edited-alarm gap: the
    // handled-occurrence key is (identity, today's dateKey, alarmTime) -
    // editing the alarm to a different time and then back to an
    // already-resolved time LATER THE SAME DAY reproduces that exact same
    // key, so without this it would stay wrongly suppressed even though
    // the user just made a fresh, explicit choice to set the alarm for
    // that time today. Only a genuine time change clears it - a
    // timezone-only call (TimezoneSettings.jsx passes the SAME alarmTime
    // back unchanged) must not void an already-resolved occurrence for
    // today, per the established product decision that a TZ change alone
    // doesn't reopen a handled alarm. See alarmOccurrence.js's own doc
    // comment for why superseding is otherwise "free" (a genuinely new
    // time already produces a genuinely new key on its own) - this is the
    // one case where the OLD key can recur, so it needs an explicit clear.
    if (newAlarm !== alarmTime) {
      clearHandledAlarmOccurrence();
    }
    setAlarmTime(newAlarm);
    setBedTime(newBed);
    const resolvedTimezone = newTimezone !== undefined ? newTimezone : timezone;
    if (newTimezone !== undefined) setTimezoneState(newTimezone);

    if (!authLoading && !isGuest && userId) {
      saveRhythm(newAlarm, newBed, resolvedTimezone);
    }
  };

  // Global timezone correctness: resolves the "Your timezone appears to
  // have changed" banner (and the equivalent first-time confirmation when
  // timezone is still null) by adopting the live device zone as the
  // user's confirmed timezone.
  const useCurrentTimezone = () => {
    setTimezoneState(deviceTimezone);
    if (!authLoading && !isGuest && userId) {
      saveRhythm(alarmTime, bedTime, deviceTimezone);
    }
  };

  // Keeps the already-saved timezone, but remembers this specific device
  // zone so the banner doesn't re-nag on every subsequent app open while
  // still travelling in the same foreign zone - it reappears only if the
  // device zone changes again to something else.
  const keepSavedTimezone = () => {
    setDismissedMismatchTimezone(deviceTimezone);
  };

  return (
    <AlarmContext.Provider value={{
      userId,
      alarmTime,
      setAlarmTime,
      bedTime,
      setBedTime,
      alarmSoundId,
      setAlarmSoundId,
      isAlarmSet,
      setIsAlarmSet,
      isRinging,
      setIsRinging,
      intentions,
      setIntentions,
      intentionsConfirmed,
      setIntentionsConfirmed,
      snooze,
      dismissAlarm,
      updateRhythm,
      saveRhythm,
      routineDuration,
      setRoutineDuration,
      journeyStep,
      setJourneyStep,
      timezone,
      deviceTimezone,
      effectiveTimezone,
      timezoneMismatch,
      timezoneUnconfirmed,
      useCurrentTimezone,
      keepSavedTimezone,
      askTimezoneLater
    }}>
      {children}
    </AlarmContext.Provider>
  );
};

export const useAlarm = () => useContext(AlarmContext);
