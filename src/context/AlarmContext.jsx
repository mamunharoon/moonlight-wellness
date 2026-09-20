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

const AlarmContext = createContext();

const INTENTIONS_KEY = 'moonlight_intentions';
const LEGACY_INTENTION_KEY = 'moonlight_today_intention';
const DEFAULT_INTENTIONS = ['Stay calm', 'Be kind to yourself'];

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
  const { playTrack } = useAudio();
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
    return onSignOutBroadcast(() => setJourneyStep(''));
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
    } else if (typeof data.intention === 'string' && data.intention.trim().length > 0) {
      setIntentions([data.intention]);
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
        return;
      }

      setIntentions(DEFAULT_INTENTIONS);
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
        lastFiredKeyRef.current = firedKey;
        setIsRinging(true);
        setJourneyStep('alarm');
        playTrack({
          title: 'Morning Rise Alarm',
          url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          image: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=150'
        });

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
  }, [alarmTime, isAlarmSet, isRinging, playTrack, sessionState.status, effectiveTimezone]);

  // Snooze bumps today's alarm by 5 minutes - a temporary, one-off delay,
  // not a change to the user's configured wake-time preference. It must
  // not be persisted (local or cloud).
  const snooze = () => {
    setIsRinging(false);
    setJourneyStep('');

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

  const dismissAlarm = () => {
    setIsRinging(false);
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
      isAlarmSet,
      setIsAlarmSet,
      isRinging,
      setIsRinging,
      intentions,
      setIntentions,
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
