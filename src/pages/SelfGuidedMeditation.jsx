/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getReducedMotionPreference } from '../lib/reducedMotionPreference';
import { JourneyHeader } from '../components/journey/JourneyHeader';
import { MeditationSetupPanel } from '../components/journey/MeditationSetupPanel';
import { MeditationActiveSession } from '../components/journey/MeditationActiveSession';
import { getRecommendedDurationId } from '../lib/meditationDurations';
import { resolveSelfGuidedMeditationContext } from '../lib/selfGuidedMeditationNav';
import { useMeditationSession } from '../hooks/useMeditationSession';

/*
 * WakeWise — Self-Guided Meditation (IM01/IM02 Sound Choices)
 *
 * Shared setup + active-session experience, reached from Home's "Meditate"
 * quick-action tile (?from=home) and Library's "Self-Guided Meditation"
 * entry (?from=library) - one implementation, no duplicate. `from` is an
 * allowlisted entry-context marker only (selfGuidedMeditationNav.js),
 * never a free-form return URL.
 *
 * Journey Embedding (Phase 2) — this page's own timer/controller/audio
 * logic was extracted into useMeditationSession.js, and its setup/active
 * JSX into MeditationSetupPanel.jsx/MeditationActiveSession.jsx, so
 * MorningMeditate.jsx/EveningMeditate.jsx can drive the exact same real
 * behaviour without a duplicate implementation. This page now only
 * supplies its OWN existing defaults/copy/navigation - `compact` is never
 * passed (defaults false), so every option still renders immediately with
 * no disclosure/Skip button, exactly as before. `onComplete` reproduces
 * the original inline `navigate('/self-guided-meditation-complete', ...)`
 * call verbatim; `onRequestLeave` (from the active screen) and
 * `performLeave` (from the pre-start screen, End Session) both still
 * resolve to `navigate(context.fallback)` after the hook's own
 * endSession() stops the timer/audio - byte-identical net effect to the
 * previous single-file implementation.
 */
export const SelfGuidedMeditation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [context] = useState(() => resolveSelfGuidedMeditationContext(searchParams.get('from')));

  // Meditate Again / Choose Another Meditation restore the prior session's
  // own choices via router state - preserved, but Begin still requires a
  // fresh, deliberate tap (no auto-start from this preset).
  const preset = location.state || null;

  const [reducedMotion] = useState(() => {
    try {
      return Boolean(getReducedMotionPreference() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  });

  const handleComplete = (finished) => {
    navigate('/self-guided-meditation-complete', { state: { ...finished, from: searchParams.get('from') || null } });
  };

  const session = useMeditationSession({
    initialStyleId: preset?.styleId,
    initialDurationId: preset?.durationId,
    initialSoundId: preset?.soundId,
    onComplete: handleComplete
  });

  // Standalone Back/Close split fix, found live: Back and Close previously
  // resolved to the exact same performLeave (end + navigate away), so
  // Back never actually returned to this screen's own setup the way
  // MorningMeditate.jsx/EveningMeditate.jsx's identical Back already does.
  // onRequestLeave (Back, via MeditationActiveSession's own local confirm
  // dialog) now only ends the session - phase falls back to 'setup' and
  // this component's own render (below) naturally shows the pre-start
  // screen again, no navigation. onRequestClose (the header's Close/X,
  // bypassing that local dialog - see MeditationActiveSession's own doc
  // comment) is the one real "leave" action, mirroring MorningMeditate.jsx's
  // identical onRequestLeave/onRequestClose split exactly.
  const performLeave = () => {
    session.endSession();
  };

  const performClose = () => {
    session.endSession();
    navigate(context.fallback);
  };

  const handleExploreGuided = () => {
    navigate('/library?category=meditation&from=meditation-setup');
  };

  if (session.phase === 'active' && session.snapshot) {
    return (
      <MeditationActiveSession
        style={session.style}
        snapshot={session.snapshot}
        soundId={session.soundId}
        soundUnavailable={session.soundUnavailable}
        reducedMotion={reducedMotion}
        onSelectSound={session.selectSound}
        onPause={session.pause}
        onResume={session.resume}
        onRequestLeave={performLeave}
        onRequestClose={performClose}
      />
    );
  }

  return (
    <div
      className="max-w-md w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-6"
      style={{
        paddingLeft: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-left))',
        paddingRight: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-right))',
        paddingTop: 'calc(1rem + env(safe-area-inset-top))'
      }}
    >
      <JourneyHeader showBackButton backFallback={context.fallback} onClose={() => navigate(context.fallback)} />

      <MeditationSetupPanel
        compact={false}
        recommendedDurationId={getRecommendedDurationId()}
        style={session.style}
        duration={session.duration}
        soundId={session.soundId}
        onSelectStyle={session.selectStyle}
        onSelectDuration={session.setDurationId}
        onSelectSound={session.selectSound}
        onBegin={session.begin}
        onExploreGuided={handleExploreGuided}
      />
    </div>
  );
};
