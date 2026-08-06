/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAudio } from './AudioContext';
import { useAuth } from './AuthContext';
import { useSession } from './SessionContext';
import { supabase } from '../lib/supabaseClient';

const AlarmContext = createContext();

const INTENTIONS_KEY = 'moonlight_intentions';
const LEGACY_INTENTION_KEY = 'moonlight_today_intention';
const DEFAULT_INTENTIONS = ['Stay calm', 'Be kind to yourself'];

const isValidIntentionsArray = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => typeof item === 'string' && item.trim().length > 0);

const readStoredIntentions = () => {
  try {
    const raw = localStorage.getItem(INTENTIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidIntentionsArray(parsed) ? parsed : null;
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
  const { state: sessionState, startSession, resetSession } = useSession();
  const userId = user && !user.is_anonymous ? user.id : null;
  const [alarmTime, setAlarmTime] = useState(() => {
    return localStorage.getItem('moonlight_wake_up_time') || '07:30';
  }); // HH:MM
  const [bedTime, setBedTime] = useState(() => {
    return localStorage.getItem('moonlight_bedtime') || '22:00';
  }); // HH:MM
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
      .select('wake_up_time, bedtime')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.error('Error fetching rhythm:', error.message);
      return;
    }

    if (data) {
      setAlarmTime(data.wake_up_time);
      setBedTime(data.bedtime);
    }
  };

  // Keep rhythm state in sync with the current auth identity, mirroring the
  // intentions identity-sync below. Guests (including right after sign-out)
  // always restore their own stored rhythm, never a previous session's cloud
  // values. Authenticated users are reset to the neutral defaults before
  // fetching their own row, so switching between two accounts never briefly
  // shows the prior account's rhythm.
  useEffect(() => {
    const syncRhythm = async () => {
      if (!userId) {
        const guestAlarm = localStorage.getItem('moonlight_wake_up_time') || '07:30';
        const guestBed = localStorage.getItem('moonlight_bedtime') || '22:00';
        setAlarmTime(guestAlarm);
        setBedTime(guestBed);
        // Only mark this identity settled once the guest values are in
        // place, so the persist-write effects above never fire in between.
        settledRhythmUserIdRef.current = userId;
        return;
      }

      setAlarmTime('07:30');
      setBedTime('22:00');
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

  // Fetch the current authenticated user's saved intention from Supabase.
  // No row yet is not an error - the existing local/default state is left
  // untouched and nothing is written back during a fetch.
  const fetchIntention = async (uid) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('user_intentions')
      .select('intention')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      console.error('Error fetching intention:', error.message);
      return;
    }

    if (data && typeof data.intention === 'string' && data.intention.trim().length > 0) {
      setIntentions([data.intention]);
    }
  };

  // Keep intention state in sync with the current auth identity. Guests
  // (including right after sign-out) always restore from the local guest
  // source, never from a previous session's cloud data. Authenticated users
  // are reset to the default before fetching their own row, so switching
  // between two accounts never briefly shows the prior account's intention.
  useEffect(() => {
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

  // Background Clock Observer
  useEffect(() => {
    const checkTime = () => {
      if (!isAlarmSet || isRinging || journeyStep !== '') return;

      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMinutes = now.getMinutes().toString().padStart(2, '0');
      const currentTimeString = `${currentHours}:${currentMinutes}`;

      if (currentTimeString === alarmTime) {
        setIsRinging(true);
        setJourneyStep('alarm');
        playTrack({
          title: 'Morning Rise Alarm',
          url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          image: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=150'
        });

        // Stage 3C Group 3B2: mirror the alarm-fire event into the Session
        // Engine. journeyStep (above) remains the sole authoritative driver
        // of navigation - this call only keeps the Session Engine's runtime
        // state in step, per the approved Group 3B2 design. A leftover
        // 'playing'/'interrupted' mirror (only possible today as a stale
        // remnant from a prior day, since no production page yet completes
        // or resets it - that is Group 3D scope) is reset before starting
        // fresh, so a new alarm always produces a clean mirror rather than
        // being silently rejected by the reducer's own already-approved
        // START_SESSION guard (see src/session/sessionReducer.js).
        if (sessionState.status === 'playing' || sessionState.status === 'interrupted') {
          resetSession();
        }
        startSession('morning-routine');
      }
    };

    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [alarmTime, isAlarmSet, isRinging, journeyStep, playTrack, sessionState.status, startSession, resetSession]);

  // Snooze bumps today's alarm by 5 minutes - a temporary, one-off delay,
  // not a change to the user's configured wake-time preference. It must
  // not be persisted (local or cloud).
  const snooze = () => {
    setIsRinging(false);
    setJourneyStep('');
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
  const saveRhythm = async (newAlarm, newBed) => {
    if (!supabase || !userId) return;

    const { error } = await supabase
      .from('rhythms')
      .upsert(
        {
          user_id: userId,
          wake_up_time: newAlarm,
          bedtime: newBed,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Error saving rhythm:', error.message);
    }
  };

  // Single explicit entry point for pages to commit a configured wake/bed
  // time change. Always updates local state (which guests already persist
  // to localStorage via the effect above); additionally persists to
  // Supabase for registered users only. Callers do not need to know
  // whether the current user is a guest or registered.
  const updateRhythm = (newAlarm, newBed) => {
    setAlarmTime(newAlarm);
    setBedTime(newBed);

    if (!authLoading && !isGuest && userId) {
      saveRhythm(newAlarm, newBed);
    }
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
      setJourneyStep
    }}>
      {children}
    </AlarmContext.Provider>
  );
};

export const useAlarm = () => useContext(AlarmContext);
