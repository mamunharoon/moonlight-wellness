/* eslint-disable no-unused-vars */
import { useState, useEffect } from 'react';
import { MEDITATION_STYLES } from '../../lib/meditationStyles';
import { MEDITATION_DURATIONS, formatMeditationBeginLabel } from '../../lib/meditationDurations';
import { MEDITATION_SOUNDS, getMeditationSoundById } from '../../lib/meditationSounds';
import { MeditationOptionRow, MeditationDurationChip, MeditationStyleCard } from './MeditationControls';
import { getJourneyPrimaryActionClasses } from '../../lib/journeyAction';
import { getJourneyToneTokens } from '../../lib/journeyTone';

/*
 * WakeWise — Journey Embedding (Self-Guided Meditation) — shared setup
 * screen, extracted from SelfGuidedMeditation.jsx's own setup-phase JSX.
 *
 * `compact` (false = standalone's existing behaviour, byte-identical):
 * every option (5 styles, 3 durations, 3 sounds) renders immediately,
 * exactly as SelfGuidedMeditation.jsx already shows them today - no
 * disclosure, no Skip button, an optional "Explore Guided Meditations"
 * secondary action instead.
 *
 * `compact` (true = Morning/Evening embedded pre-start): shows only
 * purpose + the CURRENT recommended style/duration/sound (whatever the
 * caller's useMeditationSession() was seeded with - see that hook's own
 * initialStyleId/initialDurationId/initialSoundId), a primary Begin
 * action, a "Choose style, time & sound" disclosure that reveals the exact
 * same three radiogroups on demand, and a "Skip meditation" action
 * (`skipLabel`, default 'Skip meditation' - every existing caller keeps
 * this exact text; Morning journey UX correction: MorningMeditate.jsx
 * overrides it to "Continue to Affirmation" once the user has already
 * started Meditation this visit and backed out to setup, since "skip" is
 * misleading at that point). Users never face all 5+3+3 choices on first
 * paint in this mode.
 *
 * `recommendedDurationId` drives ONLY the "Recommended" badge shown on the
 * expanded duration chips (meditationDurations.js's own `recommended`
 * flag is never read here) - see getRecommendedDurationId in
 * meditationDurations.js for why this varies by context without mutating
 * the shared registry.
 *
 * `beginLabel` (defect fix - optional override, default null): every
 * current caller (Morning/Evening/standalone) now omits it and gets the
 * live-computed "Begin N-Minute Meditation" (formatMeditationBeginLabel,
 * meditationDurations.js), which always reflects the current `duration`
 * prop and updates immediately when the user picks a different one -
 * found live that a caller-supplied static string went stale the moment
 * the user changed duration after the initial paint. Kept as an optional
 * override (rather than removed) only for a genuinely different wording
 * pattern a future context might need - still expected to incorporate
 * the live duration itself if it ever supplies one.
 */
export const MeditationSetupPanel = ({
  compact = false,
  purpose,
  recommendedDurationId,
  beginLabel = null,
  style,
  duration,
  soundId,
  onSelectStyle,
  onSelectDuration,
  onSelectSound,
  onBegin,
  onSkip,
  skipLabel = 'Skip meditation',
  onExploreGuided,
  defaultExpanded = false,
  onExpandedConsumed,
  // Context-aware Meditation theming — `journeyTone` (renamed from the
  // earlier `accent`, additive, default 'primary'): every caller -
  // MorningMeditate.jsx, EveningMeditate.jsx pass their own fixed
  // 'morning'/'evening' directly (unambiguous, embedded journeys);
  // SelfGuidedMeditation.jsx now passes its own dynamically-resolved
  // journeyTone (see usePracticeJourneyTone.js) instead of a hardcoded
  // 'anytime' literal, so a Home-quick-action-launched standalone
  // Meditation inherits whichever journey was active on Home, not always
  // mint. Drives the Begin button (via getJourneyPrimaryActionClasses),
  // the icon, the "Recommended for you" eyebrow, and is threaded down
  // into MeditationStyleCard/MeditationDurationChip/MeditationOptionRow
  // for their own selected-state colours.
  journeyTone = 'primary'
}) => {
  // Morning/Evening journey meditation-selection fix — `defaultExpanded`
  // (additive, default false: every existing caller either omits it or
  // this is unchanged for them) lets a caller open this panel already
  // expanded to the full style/duration/sound picker, for "Choose another
  // meditation" specifically (see MeditationActiveSession.jsx's own doc
  // comment) - the user just asked to change their meditation, so forcing
  // them to tap "Choose style, time & sound" again would defeat the point.
  // Only read once, via the lazy useState initializer: MorningMeditate.jsx/
  // EveningMeditate.jsx never keep this component mounted across the
  // active<->setup phase transition (a different top-level return branch
  // entirely), so every return to setup is a genuinely fresh mount -
  // reading defaultExpanded here can never "stick" past that one mount.
  // `onExpandedConsumed` (optional) fires once, immediately after mount,
  // so the CALLER can reset its own "next setup should open expanded" flag
  // back to false - without this, an ordinary Back (not Choose another)
  // reached after a prior Choose-another-triggered mount would incorrectly
  // inherit the expanded default too.
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => {
    if (defaultExpanded) onExpandedConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on mount only, matching the lazy useState initializer above
  }, []);
  const sound = getMeditationSoundById(soundId);
  const showOptions = !compact || expanded;
  // Defect fix — always derived from the live `duration` prop (same
  // source the recommendation card and the selected duration chip
  // already read correctly), never a stale caller-supplied string.
  const resolvedBeginLabel = beginLabel || formatMeditationBeginLabel(duration);

  return (
    // Decision 3 acceptance correction — space-y-6 -> space-y-5 -> space-y-4:
    // a second modest gap trim (reducing padding/gaps before font size, per
    // spec) - the first trim alone left Begin's bottom edge 0.4px below an
    // 844px viewport, an unacceptably fragile margin per spec ("do not
    // allow a three-pixel width difference to push the primary action
    // below the fold"). Safe for the compact (Morning/Evening) variant
    // too - it only ever makes an already-comfortable fit more
    // comfortable there, never worse.
    <div className="space-y-4">
      {compact ? (
        <div className="space-y-1">
          <span className={`material-symbols-outlined ${getJourneyToneTokens(journeyTone).text} text-3xl`} aria-hidden="true">self_improvement</span>
          <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight mt-2">Take a Mindful Pause</h1>
          {purpose && <p className="text-xs text-on-surface-variant">{purpose}</p>}
          <div className="glass-panel rounded-2xl p-4 mt-3 space-y-1.5 text-left">
            <p className={`text-[10px] uppercase tracking-wider font-bold ${getJourneyToneTokens(journeyTone).text}`}>Recommended for you</p>
            <p className="text-sm text-on-surface font-semibold">{style.label} &middot; {duration.label}</p>
            <p className="text-xs text-on-surface-variant">{sound ? sound.label : 'No Music'}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <span className={`material-symbols-outlined ${getJourneyToneTokens(journeyTone).text} text-3xl`} aria-hidden="true">self_improvement</span>
          <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight mt-2">Take a Mindful Pause</h1>
          <p className="text-xs text-on-surface-variant">Choose how you would like to meditate and how much time you have.</p>
        </div>
      )}

      {showOptions && (
        <>
          <div className="space-y-2">
            <h2 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Meditation style</h2>
            {/* F6 (pre-Build-15 usability pass) — approved compact two-
                column layout (see MeditationStyleCard's own doc comment
                for the accessible-name reasoning). Odd-numbered last
                style (Loving-Kindness) spans both columns rather than
                leaving a half-empty row - generic on array length, not
                hardcoded to "5". */}
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Meditation style">
              {MEDITATION_STYLES.map((s, idx) => (
                <MeditationStyleCard
                  key={s.id}
                  groupName="meditation-style"
                  label={s.label}
                  description={s.description}
                  selected={style.id === s.id}
                  onSelect={() => onSelectStyle(s.id)}
                  fullWidth={MEDITATION_STYLES.length % 2 === 1 && idx === MEDITATION_STYLES.length - 1}
                  journeyTone={journeyTone}
                />
              ))}
            </div>
            {/* Selected style's description, shown once below the grid -
                updates immediately with `style` (the caller's own live
                selection), never a stale/cached copy. */}
            <p className="text-xs text-on-surface-variant px-1" aria-live="polite">{style.description}</p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Duration</h2>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Duration">
              {MEDITATION_DURATIONS.map((d) => (
                <MeditationDurationChip
                  key={d.id}
                  groupName="meditation-duration"
                  label={d.label}
                  sublabel={d.id === recommendedDurationId ? 'Recommended' : null}
                  selected={duration.id === d.id}
                  onSelect={() => onSelectDuration(d.id)}
                  journeyTone={journeyTone}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Choose your sound</h2>
            <div className="space-y-2" role="radiogroup" aria-label="Choose your sound">
              {MEDITATION_SOUNDS.map((s) => (
                <MeditationOptionRow
                  key={s.id}
                  groupName="meditation-sound"
                  label={s.label}
                  description={s.description}
                  selected={soundId === s.id}
                  onSelect={() => onSelectSound(s.id)}
                  journeyTone={journeyTone}
                />
              ))}
            </div>
          </div>
        </>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={onBegin}
          className={`w-full ${getJourneyPrimaryActionClasses(journeyTone)} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
        >
          <span>{resolvedBeginLabel}</span>
          <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
        </button>

        {compact && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full glass-panel text-on-surface py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
          >
            Choose style, time &amp; sound
          </button>
        )}

        {onExploreGuided && (
          <button
            type="button"
            onClick={onExploreGuided}
            className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
          >
            Explore Guided Meditations
          </button>
        )}

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="w-full text-on-surface-variant py-3 text-center font-semibold text-sm hover:text-on-surface active:scale-95 transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary rounded-full"
          >
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
};
