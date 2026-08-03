import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';

export const AlarmActive = () => {
  const { snooze, dismissAlarm, alarmTime } = useAlarm();
  const navigate = useNavigate();
  const [sliderPosition, setSliderPosition] = useState(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const sliderWidth = useRef(0);
  const containerRef = useRef(null);

  const formatDisplayTime = (timeString) => {
    const [hours, minutes] = timeString.split(':');
    const hr = parseInt(hours);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const displayHr = hr % 12 || 12;
    return `${displayHr}:${minutes} ${ampm}`;
  };

  const handleStart = (clientX) => {
    isDragging.current = true;
    startX.current = clientX;
    if (containerRef.current) {
      sliderWidth.current = containerRef.current.offsetWidth - 64;
    }
  };

  const handleMove = (clientX) => {
    if (!isDragging.current) return;
    const deltaX = clientX - startX.current;
    const boundedX = Math.max(0, Math.min(deltaX, sliderWidth.current));
    setSliderPosition(boundedX);

    if (boundedX >= sliderWidth.current * 0.95) {
      handleUnlock();
    }
  };

  const handleEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (sliderPosition < sliderWidth.current * 0.95) {
      setSliderPosition(0);
    }
  };

  const handleUnlock = () => {
    isDragging.current = false;
    dismissAlarm();
    navigate('/morning-flow');
  };

  const onMouseDown = (e) => handleStart(e.clientX);
  const onMouseMove = (e) => handleMove(e.clientX);
  const onMouseUp = () => handleEnd();

  const onTouchStart = (e) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e) => handleMove(e.touches[0].clientX);
  const onTouchEnd = () => handleEnd();

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [sliderPosition]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between py-16 px-6 text-center select-none"
         style={{ background: 'linear-gradient(135deg, #fff1eb 0%, #ace0f9 100%)' }}>
      
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-3xl"></div>

      <div className="relative z-10 space-y-2 mt-12">
        <p className="text-xs text-primary font-bold uppercase tracking-widest">Moonlight Wellness</p>
        <h2 className="text-3xl font-extrabold text-[#5c3d2e]">Wake Up Gently</h2>
      </div>

      <div className="relative z-10 space-y-6">
        <div className="w-24 h-24 rounded-full bg-white/40 backdrop-blur-md flex items-center justify-center mx-auto border border-white/40 shadow-inner">
          <span className="material-symbols-outlined text-[#954835] text-4xl animate-pulse">wb_twilight</span>
        </div>
        <h1 className="text-[72px] font-bold text-[#5c3d2e] tracking-tighter leading-none">
          {formatDisplayTime(alarmTime).split(' ')[0]}
        </h1>
        <p className="text-[#5c3d2e]/70 font-label-md font-semibold tracking-wide uppercase">
          Thursday, Oct 24
        </p>
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-8">
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
          
          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-[#5c3d2e]/60 z-10 pointer-events-none">
            Begin Your Morning
          </span>
        </div>

        <button 
          onClick={snooze}
          className="text-xs text-[#5c3d2e]/70 font-semibold uppercase tracking-wider flex items-center gap-2 mx-auto hover:text-[#954835] active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-sm">bedtime</span> Rest for 5 more minutes
        </button>
      </div>

    </div>
  );
};