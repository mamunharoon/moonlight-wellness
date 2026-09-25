/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getReducedMotionPreference } from '../lib/reducedMotionPreference';
import { JourneyHeader } from '../components/journey/JourneyHeader';
import { MeditationSetupPanel } from '../components/journey/MeditationSetupPanel';
import { MeditationActiveSession } from '../components/journey/MeditationActiveSession';
import { ConfirmDialog } from '../components/ConfirmDialog';
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
 * call verbatim.
 *
 * Standalone Home quick-action correction — Back vs Close, found live:
 * `performLeave` (Back) already correctly ended the session and returned
 * to THIS screen's own setup (phase falls back to 'setup', no navigate) -
 * that half was already right. Two real defects remained: (1) Back's own
 * local dialog still showed MeditationActiveSession's DEFAULT_END_COPY
 * ("Leave meditation?" / "End and Leave" / "Continue Meditation"), wording
 * written for actually leaving - misleading once Back stopped meaning
 * that. Fixed with an explicit `endCopy` override using the same "End this
 * meditation?" / "Keep Meditating" / "End Meditation" wording
 * MorningMeditate.jsx/EveningMeditate.jsx's own Back dialog already
 * establishes. (2) Close/X (`onRequestClose`) called `performClose`
 * directly with NO confirmation at all - reproduced live: a single tap
 * ended the session and navigated Home immediately, unlike Morning's own
 * onRequestClose (MorningMeditate.jsx's handleRequestExitRoutine), which
 * always opens its own confirmation first. Fixed the same way: Close now
 * opens a local `exitConfirmOpen` dialog (reusing the original "Leave
 * meditation?" / "End and Leave" / "Continue Meditation" wording, which
 * was always correct framing for a genuine whole-feature exit - only
 * misapplied to Back before this fix); only confirming it calls
 * `performClose` (endSession + navigate(context.fallback)). Cancelling
 * leaves the active session completely untouched. Never reached from an
 * early End Session or Back - those still return directly to this
 * screen's own setup, never to /self-guided-meditation-complete (see that
 * file's own doc comment: "ending early is not a completion" - unchanged,
 * not redesigned by this fix).
 *
 * Early-end result correction — found live: the bottom "End Session"
 * button and Back were wired to the exact same state and handler
 * (MeditationActiveSession's own `leaveConfirmOpen`/`onRequestLeave`),
 * so "test End Session independently from Back" surfaced that they were
 * never actually independent - both silently returned to this screen's
 * setup with no distinct outcome, unlike natural completion's own
 * /self-guided-meditation-complete screen. Back keeps its original,
 * unchanged behaviour (still `performLeave` -> straight to setup, no
 * screen). End Session now uses the new, separate `onEndSession` prop:
 * `performEndSession` ends the session and sets `earlyEnded`, which this
 * component renders as its own small inline "Session ended early" panel
 * (Done -> context.fallback; Meditate Again -> clears `earlyEnded`,
 * revealing the setup panel again with the same style/duration/sound
 * still selected, since `endSession()` never resets those). Deliberately
 * not routed through /self-guided-meditation-complete or given a
 * completion flag - that screen's own doc comment is explicit that ending
 * early is not a completion, and this fix does not change that; it only
 * gives "ended early" its own truthful, distinct wording instead of no
 * screen at all.
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

  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [earlyEnded, setEarlyEnded] = useState(false);

  // Back: ends only this meditation, returns to this screen's own setup -
  // phase falls back to 'setup' and this component's own render (below)
  // naturally shows the pre-start screen again, no navigation.
  const performLeave = () => {
    session.endSession();
  };

  // End Session (bottom button, independent of Back - see this file's own
  // top doc comment): ends the session the same way, but surfaces the new
  // truthful "Session ended early" panel below instead of silently
  // reopening setup.
  const performEndSession = () => {
    session.endSession();
    setEarlyEnded(true);
  };
  const handleMeditateAgainFromEarlyEnd = () => setEarlyEnded(false);

  // Close/X: the one real "leave the whole standalone experience" action -
  // opens its own confirmation first (see this file's own top doc comment
  // for why this was missing before), and only navigates on confirm.
  const handleRequestClose = () => setExitConfirmOpen(true);
  const performClose = () => {
    setExitConfirmOpen(false);
    session.endSession();
    navigate(context.fallback);
  };

  const handleExploreGuided = () => {
    navigate('/library?category=meditation&from=meditation-setup');
  };

  if (session.phase === 'active' && session.snapshot) {
    return (
      <>
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
          onRequestClose={handleRequestClose}
          onEndSession={performEndSession}
          endCopy={{
            buttonLabel: 'End Session',
            buttonAriaLabel: 'End meditation',
            dialogTitle: 'End this meditation?',
            dialogMessage: 'Your current meditation will end.',
            confirmLabel: 'End Meditation',
            cancelLabel: 'Keep Meditating'
          }}
        />
        {/* Severity matches MorningMeditate.jsx's own whole-routine exit
            dialog (destructive, strong) - this is the equivalent
            whole-feature exit for standalone, not a mere pause. */}
        <ConfirmDialog
          open={exitConfirmOpen}
          title="Leave meditation?"
          message="Your current meditation will end."
          confirmLabel="End and Leave"
          cancelLabel="Continue Meditation"
          destructive
          onConfirm={performClose}
          onDismiss={() => setExitConfirmOpen(false)}
        />
      </>
    );
  }

  if (earlyEnded) {
    return (
      <div className="h-dvh overflow-hidden">
        <div className="h-full w-full overflow-y-auto overflow-x-hidden scroll-hide" style={{ overscrollBehaviorY: 'contain' }}>
          <div
            className="min-h-full max-w-md w-full mx-auto flex flex-col justify-between py-6 space-y-10 animate-in fade-in duration-500"
            style={{
              paddingLeft: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-left))',
              paddingRight: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-right))',
              paddingTop: 'calc(1rem + env(safe-area-inset-top))'
            }}
          >
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <span className="material-symbols-outlined text-on-surface-variant text-4xl" aria-hidden="true">timer_off</span>
              <h1 className="font-serif italic text-3xl text-on-surface">Session ended early</h1>
              <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
                Your {session.duration.label} {session.style.label} session ended before the timer finished.
              </p>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate(context.fallback)}
                className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <span>Done</span>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={handleMeditateAgainFromEarlyEnd}
                className="w-full glass-panel text-on-surface py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
              >
                Meditate Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    // Mobile scroll repair (Build 15 viewport audit): this setup screen is
    // rendered outside <Layout> (full-bleed, see App.jsx routing) and had
    // no scroll container of its own, so it relied on document scroll -
    // which index.html deliberately disables on both axes (see
    // Introduction.jsx's own identical fix and doc comment for why). With
    // 5 style options + duration + sound choices + Begin Meditation
    // routinely taller than one screen, "Begin Meditation" was unreachable
    // at every tested size, Pro Max included. Same proven shape as
    // Introduction.jsx/Layout.jsx: this screen now owns its own single
    // scroll container instead of depending on document scroll.
    <div className="h-dvh overflow-hidden">
      <div className="h-full w-full overflow-y-auto overflow-x-hidden scroll-hide" style={{ overscrollBehaviorY: 'contain' }}>
        <div
          className="min-h-full max-w-md w-full mx-auto space-y-6 animate-in fade-in duration-500 pb-6"
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
      </div>
    </div>
  );
};
