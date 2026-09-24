/* eslint-disable no-unused-vars */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getReducedMotionPreference } from '../lib/reducedMotionPreference';
import { JourneyHeader } from '../components/journey/JourneyHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MusicPreferenceToggle } from '../components/MusicPreferenceToggle';
import { MeditationProgressRing } from '../components/MeditationProgressRing';
import { MEDITATION_STYLES, DEFAULT_MEDITATION_STYLE_ID, getMeditationStyleById } from '../lib/meditationStyles';
import { MEDITATION_DURATIONS, DEFAULT_MEDITATION_DURATION_ID, getMeditationDurationById } from '../lib/meditationDurations';
import { createMeditationSessionController } from '../lib/meditationSessionController';
import { resolveSelfGuidedMeditationContext } from '../lib/selfGuidedMeditationNav';

// Approved media (see docs handoff): a single neutral instrumental
// background track shared by all five styles - never a per-style asset.
const MEDITATION_MUSIC_ID = 'IM01';

// Compact accessible radio row for the 5 meditation styles - same native
// <input type="radio"> + <label> construction BreathingPatternRow.jsx
// established (a strong ring when unselected, a filled ring plus a small
// contrasting dot when selected - never a checkmark), simplified to one
// description line since styles here have no cadence/duration line of
// their own to show. Kept local to this file rather than added to
// BreathingPatternRow.jsx (which is breathing-specific) or generalised
// into a new shared component - only this page needs it.
const MeditationOptionRow = ({ groupName, label, description, selected, onSelect }) => (
  <label
    className={`flex items-center justify-between gap-3 w-full min-h-[44px] px-4 py-2.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-[0.98] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
      selected ? 'bg-primary/10 border-primary' : 'bg-surface-container border-primary/50 hover:bg-white/10'
    }`}
  >
    <input type="radio" name={groupName} checked={selected} onChange={onSelect} className="sr-only" />
    <span className="flex-1 min-w-0">
      <span className={`block text-sm leading-snug ${selected ? 'text-primary font-bold' : 'text-on-surface font-medium'}`}>{label}</span>
      {description && <span className="block text-[11px] text-on-surface-variant mt-0.5 leading-snug">{description}</span>}
    </span>
    <span
      aria-hidden="true"
      className={`relative w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${
        selected ? 'border-primary bg-primary' : 'border-primary bg-surface-container-lowest'
      }`}
    >
      {selected && <span className="absolute inset-0 m-auto w-2 h-2 rounded-full bg-on-primary" />}
    </span>
  </label>
);

// Compact 3-across radio grid for the 3 durations - a segmented-control
// shape rather than 3 stacked full-width rows, so the setup screen stays
// short enough that Begin Meditation and Explore Guided Meditations are
// still discoverable without excessive scrolling on a small phone.
const MeditationDurationChip = ({ groupName, label, sublabel, selected, onSelect }) => (
  <label
    className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-2 py-2.5 rounded-2xl border text-center transition-all duration-150 cursor-pointer active:scale-[0.97] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface ${
      selected ? 'bg-primary/10 border-primary' : 'bg-surface-container border-primary/50 hover:bg-white/10'
    }`}
  >
    <input type="radio" name={groupName} checked={selected} onChange={onSelect} className="sr-only" />
    <span className={`block text-sm ${selected ? 'text-primary font-bold' : 'text-on-surface font-semibold'}`}>{label}</span>
    {sublabel && <span className="block text-[9px] uppercase tracking-wide font-bold text-primary">{sublabel}</span>}
  </label>
);

/*
 * WakeWise — Self-Guided Meditation (IM01)
 *
 * Shared setup + active-session experience, reached from Home's "Meditate"
 * quick-action tile (?from=home) and Library's "Self-Guided Meditation"
 * entry (?from=library) - one implementation, no duplicate. `from` is an
 * allowlisted entry-context marker only (selfGuidedMeditationNav.js),
 * never a free-form return URL - an invalid/missing value safely falls
 * back to Home, exactly like Library.jsx's own established FROM_CONTEXTS
 * pattern.
 *
 * Internal phase state ('setup' | 'active') rather than two routes: pause/
 * resume/music-toggle state must survive without a route transition, and
 * "leaving an active session" needs its own confirmation rather than a
 * route-level guard. On natural completion, navigates to
 * /self-guided-meditation-complete with the finished session's own
 * style/duration/from in router state (one-shot, not deep-linkable - same
 * pattern MeditationComplete.jsx already uses).
 *
 * Audio never determines completion: the timer (meditationSession.js, via
 * meditationSessionController.js) is authoritative, ticked once a second by
 * a single real setInterval created exactly once per Begin press (guarded
 * by beganRef) and torn down on pause is NOT interval-clearing (interval
 * keeps running so paused ticks are simply no-ops in the pure engine) -
 * only unmount/route-change/End Session/completion ever clears it.
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

  const [styleId, setStyleId] = useState(() => (getMeditationStyleById(preset?.styleId) ? preset.styleId : DEFAULT_MEDITATION_STYLE_ID));
  const [durationId, setDurationId] = useState(() => (getMeditationDurationById(preset?.durationId) ? preset.durationId : DEFAULT_MEDITATION_DURATION_ID));
  // IM01 is one of the narrow, explicitly server-allowlisted interactive
  // ambient beds (see GUEST_ALLOWED_IDS in get-beta-video-url/index.ts) -
  // a guest genuinely gets a signed URL for it, same as a signed-in user,
  // so there is no guest-specific default here any more. Meditate Again's
  // preset carries over exactly as it does for style/duration - in-memory
  // router state for this one bounce, never written to localStorage/an
  // account, so this is not "persisting a guest preference."
  const [musicOn, setMusicOn] = useState(() => preset?.musicOn ?? true);
  const [phase, setPhase] = useState('setup');
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [reducedMotion] = useState(() => {
    try {
      return Boolean(getReducedMotionPreference() || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  });

  const controllerRef = useRef(null);
  const intervalRef = useRef(null);
  // Guards a repeated/double Begin tap - see this file's own doc comment
  // above and meditationSessionController.js's own idempotent begin().
  const beganRef = useRef(false);

  const style = getMeditationStyleById(styleId) || MEDITATION_STYLES[0];
  const duration = getMeditationDurationById(durationId) || MEDITATION_DURATIONS[1];

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const cleanupSession = () => {
    stopInterval();
    controllerRef.current?.destroy();
    controllerRef.current = null;
    beganRef.current = false;
  };

  // Covers unmount, route change away from this screen (Back/Close/Leave,
  // or any other navigation), and a fresh mount replacing a stale instance -
  // the one place that guarantees audio/interval are never left running
  // behind a screen the user is no longer on.
  useEffect(() => () => cleanupSession(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBegin = () => {
    if (beganRef.current) return;
    beganRef.current = true;

    const controller = createMeditationSessionController({
      mediaId: MEDITATION_MUSIC_ID,
      styleId: style.id,
      durationSeconds: duration.seconds,
      musicEnabled: musicOn
    });
    controllerRef.current = controller;
    controller.begin();
    setSnapshot(controller.getSnapshot());
    setPhase('active');

    intervalRef.current = setInterval(() => {
      const current = controllerRef.current;
      if (!current) return;
      const { completed } = current.tick();
      const latestSnapshot = current.getSnapshot();
      setSnapshot(latestSnapshot);
      // Truthful-state guarantee: if the most recent start()/resume()
      // attempt genuinely failed (a real network/playback error - equally
      // possible for a guest or a signed-in user now that both take the
      // same signed-URL path), the switch must never keep showing "On" as
      // if audio were actually playing. Reconciled here, at the same
      // per-second heartbeat that already reconciles every other piece of
      // session state, rather than a separate reactive effect - the
      // failure is only known asynchronously (after setMusicEnabled's
      // fire-and-forget start() rejects), so it can never be caught
      // synchronously inside handleToggleMusic itself. Only ever turns
      // musicOn OFF; never turns it on by itself.
      if (latestSnapshot.audioError) setMusicOn(false);
      if (completed) {
        stopInterval();
        const finished = { styleId: style.id, durationId: duration.id, musicOn, from: searchParams.get('from') || null };
        cleanupSession();
        navigate('/self-guided-meditation-complete', { state: finished });
      }
    }, 1000);
  };

  const handlePause = () => {
    controllerRef.current?.pause();
    setSnapshot(controllerRef.current?.getSnapshot());
  };

  const handleResume = () => {
    controllerRef.current?.resume();
    setSnapshot(controllerRef.current?.getSnapshot());
  };

  // Music On/Off is a session-level control: flipping it must never
  // navigate away (that would silently abandon the running timer via this
  // file's own unmount cleanup effect) for anyone, guest or signed-in -
  // IM01 is one of the narrow, explicitly server-allowlisted interactive
  // ambient beds (GUEST_ALLOWED_IDS in get-beta-video-url/index.ts), so a
  // guest's request genuinely succeeds the same way a signed-in user's
  // does. `musicOn` here is plain component state either way - never
  // persisted, gone the moment this screen unmounts.
  const handleToggleMusic = () => {
    setMusicOn((prev) => {
      const next = !prev;
      controllerRef.current?.setMusicEnabled(next);
      setSnapshot(controllerRef.current?.getSnapshot());
      return next;
    });
  };

  // Deliberate exit - the big "End Session" button IS the confirmation
  // (unlike the header Back/Close, which asks first via the dialog below).
  const performLeave = () => {
    cleanupSession();
    setPhase('setup');
    navigate(context.fallback);
  };

  const handleRequestLeave = () => {
    if (phase !== 'active') {
      navigate(context.fallback);
      return;
    }
    setLeaveConfirmOpen(true);
  };

  const handleConfirmLeave = () => {
    setLeaveConfirmOpen(false);
    performLeave();
  };

  const handleExploreGuided = () => {
    navigate('/library?category=meditation&from=meditation-setup');
  };

  const musicDescription = 'Play gentle background music during your session.';

  if (phase === 'active' && snapshot) {
    return (
      <div
        className="min-h-[85vh] max-w-md w-full mx-auto flex flex-col justify-between py-6 space-y-8 animate-in fade-in duration-500"
        style={{
          paddingLeft: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-left))',
          paddingRight: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-right))',
          paddingTop: 'calc(1rem + env(safe-area-inset-top))'
        }}
      >
        <JourneyHeader showBackButton={false} onStepBack={handleRequestLeave} onClose={handleRequestLeave} />

        <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center">
          <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">{style.label}</span>

          <MeditationProgressRing
            elapsedSeconds={snapshot.elapsedSeconds}
            durationSeconds={snapshot.durationSeconds}
            reducedMotion={reducedMotion}
          />

          <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed min-h-[2.5rem]">{snapshot.promptText}</p>

          {snapshot.audioError && musicOn && (
            <p className="text-[10px] text-on-surface-variant/60 text-center">Music unavailable right now — continuing without it.</p>
          )}
        </div>

        <div className="space-y-3 w-full">
          {snapshot.status === 'paused' ? (
            <button
              type="button"
              onClick={handleResume}
              className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <span>Resume</span>
              <span className="material-symbols-outlined text-sm" aria-hidden="true">play_arrow</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePause}
              className="w-full glass-panel text-on-surface py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span>Pause</span>
              <span className="material-symbols-outlined text-sm" aria-hidden="true">pause</span>
            </button>
          )}

          {/* No isGuest/onSignIn here, same as the setup screen's own
              toggle - this one must never route a tap to sign-in (see
              handleToggleMusic's own doc comment). Omitting isGuest lets it
              default to MusicPreferenceToggle's own `false`, so the switch's
              onClick always resolves to onToggle, for every user. */}
          <MusicPreferenceToggle
            isOn={musicOn}
            onToggle={handleToggleMusic}
            description={musicDescription}
          />

          <button
            type="button"
            onClick={performLeave}
            aria-label="End meditation session"
            className="w-full py-4 rounded-full font-semibold text-center min-h-[44px] bg-[#b3555f]/15 text-[#b3555f] border border-[#b3555f]/40 hover:bg-[#b3555f]/25 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-[#b3555f] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            End Session
          </button>
        </div>

        <ConfirmDialog
          open={leaveConfirmOpen}
          title="Leave meditation?"
          message="Your current meditation will end."
          confirmLabel="End and Leave"
          cancelLabel="Continue Meditation"
          mildDestructive
          onConfirm={handleConfirmLeave}
          onDismiss={() => setLeaveConfirmOpen(false)}
        />
      </div>
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

      <div className="space-y-1">
        <span className="material-symbols-outlined text-primary text-3xl" aria-hidden="true">self_improvement</span>
        <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight mt-2">Take a Mindful Pause</h1>
        <p className="text-xs text-on-surface-variant">Choose how you would like to meditate and how much time you have.</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Meditation style</h2>
        <div className="space-y-2" role="radiogroup" aria-label="Meditation style">
          {MEDITATION_STYLES.map((s) => (
            <MeditationOptionRow
              key={s.id}
              groupName="meditation-style"
              label={s.label}
              description={s.description}
              selected={styleId === s.id}
              onSelect={() => setStyleId(s.id)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Duration</h2>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Duration">
          {MEDITATION_DURATIONS.map((d) => (
            <MeditationDurationChip
              key={d.id}
              groupName="meditation-duration"
              label={d.label}
              sublabel={d.recommended ? 'Recommended' : null}
              selected={durationId === d.id}
              onSelect={() => setDurationId(d.id)}
            />
          ))}
        </div>
      </div>

      {/* IM01 is server-allowlisted for guests (GUEST_ALLOWED_IDS in
          get-beta-video-url/index.ts) - no isGuest/onSignIn here, same as
          the active screen's own toggle below. A guest can choose Music On
          before Begin exactly like a signed-in user. */}
      <MusicPreferenceToggle
        isOn={musicOn}
        onToggle={() => setMusicOn((prev) => !prev)}
        description={musicDescription}
      />

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleBegin}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <span>Begin Meditation</span>
          <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
        </button>
        <button
          type="button"
          onClick={handleExploreGuided}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
        >
          Explore Guided Meditations
        </button>
      </div>
    </div>
  );
};
