/* eslint-disable no-unused-vars */
import React, { useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAudio } from '../context/AudioContext';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';

export const Layout = () => {
  const { currentTrack, isPlaying, togglePlay, progress } = useAudio();
  const { isRinging, journeyStep } = useAlarm();
  // Stage 3C Group 3D Batch D: Session Engine navigation cutover. Only the
  // two narrow values the forced-navigation effect below actually reads —
  // not the whole context — per the approved dependency-review guidance.
  const { state, currentStep } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  // Programmatic Interruption & Resume Observer
  useEffect(() => {
    if (isRinging) {
      navigate('/alarm-trigger');
      return;
    }

    // List of active morning sub-routes. Temporarily retained as the
    // fallback authority only (see sessionRoute below) — legacy retirement
    // is a separate, not-yet-approved decision (docs/stage-3-workbook.md).
    const stepPaths = {
      alarm: '/alarm-trigger',
      start: '/morning-start',
      affirmation: '/affirmation',
      stretch: '/morning-flow',
      breathe: '/breathe',
      intention: '/intention-setup',
      complete: '/session-complete'
    };

    // Stage 3C Group 3D Batch D: dual-source route authority, temporary.
    // The Session Engine wins whenever it is genuinely 'playing' — never
    // for 'completed'/'skipped'/'idle', so a persisted-but-inactive runtime
    // never forces a route. journeyStep/stepPaths remains a fallback for
    // rollback safety, and is what still governs when no session is
    // playing (e.g. mid-migration, or if the Session Engine mirror for a
    // given page were ever disabled).
    const sessionRoute = state.status === 'playing' ? currentStep?.route ?? null : null;
    const legacyRoute = journeyStep ? stepPaths[journeyStep] ?? null : null;
    const activePath = sessionRoute ?? legacyRoute;

    if (activePath && location.pathname !== activePath) {
      navigate(activePath);
    }
  }, [isRinging, journeyStep, state.status, currentStep, location.pathname, navigate]);

  const navItems = [
    { label: 'Today', path: '/', icon: 'home_health' },
    { label: 'Routines', path: '/routines', icon: 'schedule' },
    { label: 'Journey', path: '/journey', icon: 'analytics' },
    { label: 'Profile', path: '/profile', icon: 'person' }
  ];

  const hideNavigation = ['/onboarding', '/alarm-trigger', '/session-complete', '/landing', '/morning-start', '/affirmation', '/intention-setup', '/morning-flow', '/breathe', '/evening-wind-down', '/reflection', '/gratitude', '/evening-breathing', '/prepare-for-rest', '/evening-complete'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col transition-colors duration-300">
      
      {/* Immersive background layer */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[10%] left-1/4 w-[350px] h-[350px] bg-primary/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[20%] right-1/4 w-[400px] h-[400px] bg-secondary/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Main Responsive Container */}
      <div className="relative flex-1 flex flex-col max-w-md w-full mx-auto z-10">
        
        {/* Global Page Header */}
        {!hideNavigation && (
          <header className="flex justify-between items-center px-4 py-4 w-full border-b border-white/5 shrink-0 z-40">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>spa</span>
              <h1 className="font-headline-md text-lg text-primary font-bold tracking-tight">
                Solas
              </h1>
            </div>
          </header>
        )}

        {/* Dynamic Route Content */}
        <div className="flex-1 overflow-y-auto scroll-hide pb-28 pt-4 px-4">
          <Outlet />
        </div>

        {/* Global Persistent Audio Player */}
        {currentTrack && !hideNavigation && (
          <div className="absolute bottom-20 left-4 right-4 z-40 glass-panel rounded-2xl p-3 flex items-center justify-between shadow-2xl border-white/10 animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                <img className="w-full h-full object-cover" src={currentTrack.image} alt={currentTrack.title} />
              </div>
              <div className="overflow-hidden w-full">
                <h6 className="font-label-md text-on-surface truncate text-xs font-bold leading-none">{currentTrack.title}</h6>
                <div className="w-full h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            </div>
            <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 ml-2 active:scale-90 transition-transform">
              <span className="material-symbols-outlined text-lg">{isPlaying ? 'pause' : 'play_arrow'}</span>
            </button>
          </div>
        )}

        {/* Flat Bottom Navigation bar */}
        {!hideNavigation && (
          <nav className="absolute bottom-4 left-4 right-4 z-40 glass-panel rounded-full h-16 shadow-[0_10px_20px_rgba(149,72,53,0.15)] border border-white/10 flex justify-around items-center px-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/today');
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center rounded-full transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary-container/80 text-on-primary-container px-6 py-2 active:scale-90 scale-105 shadow-md shadow-primary/10' 
                      : 'text-on-surface-variant/70 hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                    {item.icon}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}

      </div>
    </div>
  );
};