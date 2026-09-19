import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { getStepIndex } from '../session/sessionRegistry';
import { MORNING_STEP_IDS } from '../session/sessionConstants';
import { now as devNow } from '../lib/devClock';
import { getZonedParts } from '../lib/timezone';

export const AlarmActive = () => {
  const { snooze, dismissAlarm, alarmTime, setJourneyStep, effectiveTimezone } = useAlarm();
  // Close Remaining Daily-Journey Limitations: the alarm/reminder firing
  // (AlarmContext.jsx's checkTime()) never creates or starts a session
  // itself anymore - this screen's three choices are the only places a
  // morning session can be started, reset, or left alone. See
  // handleUnlock, handleSnooze and handleSkipMorning below.
  const { state, startSession, resetSession } = useSession();
  const navigate = useNavigate();
  const [sliderPosition, setSliderPosition] = useState(0);
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState('07:00 AM');
  const isDragging = useRef(false);
  const startX = useRef(0);
  const sliderWidth = useRef(0);
  const containerRef = useRef(null);
  // One-shot guard for the new mirror call only (see handleUnlock) — the
  // rapid mousemove events that can accumulate mid-drag would otherwise be
  // able to call advanceStep() more than once before any re-render occurs,
  // over-advancing the Session Engine past 'intention'. The existing legacy
  // statements (dismissAlarm/setJourneyStep/navigate) are already safe
  // against repeated calls today (idempotent same-value writes, harmless
  // repeated navigation to the same route) and are deliberately left
  // outside this guard.
  const hasMirroredUnlockRef = useRef(false);

  // Tick the clock dynamically every second. Global timezone correctness:
  // shows the alarm's own effectiveTimezone wall-clock, not the device's
  // raw local time - the alarm just fired because THAT zone's clock hit
  // alarmTime, so showing anything else here (e.g. a traveller who kept
  // their saved zone, now sitting in a very different device-local time)
  // would read as "why did my alarm go off at the wrong time?" even
  // though the fire itself was correct.
  useEffect(() => {
    const updateTime = () => {
      const { hour, minute } = getZonedParts(effectiveTimezone, devNow());
      const displayHr = hour % 12 || 12;
      const mins = minute.toString().padStart(2, '0');
      const ampm = hour >= 12 ? 'PM' : 'AM';
      setCurrentTimeDisplay(`${displayHr}:${mins} ${ampm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [effectiveTimezone]);

  const handleUnlock = useCallback(() => {
    isDragging.current = false;
    dismissAlarm();
    // Morning-flow redesign: Step 1 is now Set Your Intention — the former
    // /morning-start video-selection screen is removed from the routine
    // entirely (see MORNING_STEP_IDS' own comment in sessionConstants.js).
    setJourneyStep('intention');
    navigate('/intention-setup');

    // Begin Rise & Reset: the one and only place a morning session is
    // created. Guarded by a one-shot ref so rapid mousemove events within
    // a single unlock gesture cannot call startSession() more than once
    // (see hasMirroredUnlockRef above). Clears any stale/incompatible
    // session first — same reset-before-start guard already used by
    // RoutineDetail.jsx's beginRiseAndReset and EveningWindDown.jsx's
    // handleBegin — then starts fresh at Step 1, so the START_SESSION
    // guard in sessionReducer.js never silently rejects this.
    if (!hasMirroredUnlockRef.current) {
      hasMirroredUnlockRef.current = true;

      if (state.status === 'playing' || state.status === 'interrupted') {
        resetSession();
      }
      startSession('morning-routine', { startIndex: getStepIndex('morning-routine', MORNING_STEP_IDS.INTENTION) });
    }
  }, [dismissAlarm, navigate, setJourneyStep, state.status, resetSession, startSession]);

  const handleMove = useCallback((clientX) => {
    if (!isDragging.current) return;
    const deltaX = clientX - startX.current;
    const boundedX = Math.max(0, Math.min(deltaX, sliderWidth.current));
    setSliderPosition(boundedX);

    if (boundedX >= sliderWidth.current * 0.95) {
      handleUnlock();
    }
  }, [handleUnlock]);

  // Remind me shortly: never creates or starts a session — reschedules
  // the foreground reminder (snooze() in AlarmContext.jsx) and explicitly
  // returns to Today, since this screen doesn't otherwise navigate away
  // once isRinging turns false.
  const handleSnooze = () => {
    snooze();
    navigate('/');
  };

  // Skip this morning: the third of the three required choices. Never
  // starts a routine. Clears the alarm/reminder state and defensively
  // ensures no morning session remains active (harmless no-op in the
  // normal case, since nothing starts a session before this point
  // anymore) before returning to Today — no navigation is forced later.
  const handleSkipMorning = () => {
    dismissAlarm();
    setJourneyStep('');
    if (state.status === 'playing' || state.status === 'interrupted') {
      resetSession();
    }
    navigate('/');
  };

  const handleEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (sliderPosition < sliderWidth.current * 0.95) {
      setSliderPosition(0);
    }
  }, [sliderPosition]);

  const handleStart = (clientX) => {
    isDragging.current = true;
    startX.current = clientX;
    if (containerRef.current) {
      sliderWidth.current = containerRef.current.offsetWidth - 64;
    }
  };

  const onMouseDown = (e) => handleStart(e.clientX);
  const onTouchStart = (e) => handleStart(e.touches[0].clientX);

  useEffect(() => {
    const handleMoveEvent = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      handleMove(clientX);
    };

    const handleEndEvent = () => handleEnd();

    window.addEventListener('mousemove', handleMoveEvent);
    window.addEventListener('mouseup', handleEndEvent);
    window.addEventListener('touchmove', handleMoveEvent);
    window.addEventListener('touchend', handleEndEvent);

    return () => {
      window.removeEventListener('mousemove', handleMoveEvent);
      window.removeEventListener('mouseup', handleEndEvent);
      window.removeEventListener('touchmove', handleMoveEvent);
      window.removeEventListener('touchend', handleEndEvent);
    };
  }, [sliderPosition, handleMove, handleEnd]);

  const getWordingFromTargetTime = () => {
  if (!alarmTime) {
    return 'Good morning.';
  }

  const [hours] = alarmTime.split(':').map(Number);

  if (hours < 12) {
    return 'Good morning.';
  }

  return 'A new day has begun.';
};

  // Render actual, current local date dynamically - in effectiveTimezone,
  // same reasoning as the clock tick above.
  const getDisplayDate = () => {
    const options = { weekday: 'long', month: 'short', day: 'numeric', timeZone: effectiveTimezone };
    return devNow().toLocaleDateString('en-US', options);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between py-16 px-6 text-center select-none"
         style={{ background: 'linear-gradient(135deg, #fff1eb 0%, #ace0f9 100%)' }}>
      
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl"></div>

      <div className="relative z-10 space-y-2 mt-12">
        <p className="text-xs text-primary font-bold uppercase tracking-widest">WakeWise</p>
        <h2 className="text-3xl font-extrabold text-[#5c3d2e]">{getWordingFromTargetTime()}</h2>
      </div>

      <div className="relative z-10 space-y-6">
        <div className="w-24 h-24 rounded-full bg-white/40 backdrop-blur-md flex items-center justify-center mx-auto border border-white/40 shadow-inner">
          <span className="material-symbols-outlined text-[#954835] text-4xl animate-pulse">wb_twilight</span>
        </div>
        <h1 className="text-[72px] font-bold text-[#5c3d2e] tracking-tighter leading-none">
          {currentTimeDisplay}
        </h1>
        <p className="text-[#5c3d2e]/70 font-label-md font-semibold tracking-wide uppercase">
          {getDisplayDate()}
        </p>
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div 
          ref={containerRef}
          className="w-full h-16 rounded-full glass-panel border border-[#954835]/15 bg-white/40 flex items-center p-1 relative overflow-hidden shadow-inner"
        >
          <div 
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            style={{ transform: `translateX(${sliderPosition}px)` }}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-[#954835] to-[#ff9d85] flex items-center justify-center text-white cursor-grab active:cursor-grabbing shadow-lg select-none z-20 touch-none"
          >
            <span className="material-symbols-outlined">arrow_forward</span>
          </div>
          
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#5c3d2e]/60 z-10 pointer-events-none">
            Begin Your Morning
          </span>
        </div>

        <button
          onClick={handleSnooze}
          className="text-[10px] text-[#5c3d2e]/70 font-semibold uppercase tracking-wider flex items-center gap-2 mx-auto hover:text-[#954835] active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-sm">bedtime</span> Remind me shortly
        </button>
        <button
          onClick={handleSkipMorning}
          className="text-[10px] text-[#5c3d2e]/50 font-semibold uppercase tracking-wider flex items-center gap-2 mx-auto hover:text-[#954835] active:scale-95 transition-all"
        >
          Skip this morning
        </button>
      </div>

    </div>
  );
};