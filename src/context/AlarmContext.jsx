/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { useAudio } from './AudioContext';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabaseClient';

const AlarmContext = createContext();

export const AlarmProvider = ({ children }) => {
  const { playTrack } = useAudio();
  const { user } = useAuth();
  const userId = user && !user.is_anonymous ? user.id : null;
  const [alarmTime, setAlarmTime] = useState('07:30'); // HH:MM
  const [bedTime, setBedTime] = useState('22:00'); // HH:MM
  const [isAlarmSet, setIsAlarmSet] = useState(true);
  const [isRinging, setIsRinging] = useState(false);
  const [intentions, setIntentions] = useState(['Stay calm', 'Be kind to yourself']);
  
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

  // Fetch stored rhythm once a real (non-guest) user session is available
  useEffect(() => {
    const loadRhythm = async () => {
      if (!userId) return;
      await fetchRhythm(userId);
    };

    loadRhythm();
  }, [userId]);

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
      }
    };

    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [alarmTime, isAlarmSet, isRinging, journeyStep, playTrack]);

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
    saveRhythm(newAlarmString, bedTime);
  };

  const dismissAlarm = () => {
    setIsRinging(false);
  };

  // Save/Update rhythms in Supabase database
  const saveRhythm = async (newAlarm, newBed) => {
    if (!supabase || !userId) return;

    const { data, error: fetchError } = await supabase
      .from('rhythms')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) return;

    if (data) {
      await supabase
        .from('rhythms')
        .update({ wake_up_time: newAlarm, bedtime: newBed })
        .eq('user_id', userId);
    } else {
      await supabase
        .from('rhythms')
        .insert({ user_id: userId, wake_up_time: newAlarm, bedtime: newBed });
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
