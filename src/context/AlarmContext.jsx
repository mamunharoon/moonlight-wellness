import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAudio } from './AudioContext';

const AlarmContext = createContext();

export const AlarmProvider = ({ children }) => {
  const { playTrack } = useAudio();
  const [alarmTime, setAlarmTime] = useState('07:00'); // HH:MM (24-hour format)
  const [bedTime, setBedTime] = useState('22:00'); // HH:MM
  const [isAlarmSet, setIsAlarmSet] = useState(true);
  const [isRinging, setIsRinging] = useState(false);
  const [intentions, setIntentions] = useState(['Anxiety', 'Sleep']);

  useEffect(() => {
    const checkTime = () => {
      if (!isAlarmSet || isRinging) return;

      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMinutes = now.getMinutes().toString().padStart(2, '0');
      const currentTimeString = `${currentHours}:${currentMinutes}`;

      if (currentTimeString === alarmTime) {
        setIsRinging(true);
        // Automatically stream soothing wake-up audio
        playTrack({
          title: 'Morning Rise Alarm',
          url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          image: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=150'
        });
      }
    };

    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [alarmTime, isAlarmSet, isRinging, playTrack]);

  const snooze = () => {
    setIsRinging(false);
    // Parse current alarm and add 5 minutes
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

  return (
    <AlarmContext.Provider value={{
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
      dismissAlarm
    }}>
      {children}
    </AlarmContext.Provider>
  );
};

export const useAlarm = () => useContext(AlarmContext);
