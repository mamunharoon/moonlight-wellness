/* eslint-disable no-unused-vars */
import { MEDITATION_STYLES } from '../../lib/meditationStyles';
import { MEDITATION_DURATIONS, formatMeditationBeginLabel } from '../../lib/meditationDurations';
import { MeditationOptionRow, MeditationDurationChip } from './MeditationControls';
import { MeditationSoundControl } from './MeditationSoundControl';
import { getJourneyPrimaryActionClasses } from '../../lib/journeyAction';
import { getJourneyToneTokens } from '../../lib/journeyTone';

/*
 * WakeWise — Journey Embedding (Self-Guided Meditation) — shared setup
 * screen, extracted from SelfGuidedMeditation.jsx's own setup-phase JSX.
 *
 * Meditation ↔ Breathing alignment correction — this panel now always
 * renders the full choice set immediately (style, duration), matching
 * Breathing's own setup screens (Breathe.jsx/EveningBreathing.jsx never
 * hide their pattern list behind a disclosure either). The former `compact`
 * two-state model (a "Recommended for you" summary card + a "Choose style,
 * time & sound" disclosure hiding everything else) is removed entirely -
 * every journey (Morning/Evening/Anytime) now shows the same structure:
 *
 *   1. compact Sound control, top-right (MeditationSoundControl)
 *   2. heading + one short supporting sentence
 *   3. meditation-style selection - vertically stacked full-width rows
 *      (MeditationOptionRow with a genuine per-style icon), replacing the
 *      former dense two-column MeditationStyleCard grid
 *   4. duration selection (MeditationDurationChip, unchanged)
 *   5. "Explore Guided Meditations" (optional, via onExploreGuided)
 *   6. primary "Begin Meditation" action
 *   7. "Skip meditation" (optional, via onSkip)
 *
 * The large duplicated "RECOMMENDED FOR YOU" card is gone - recommendation
 * state is instead conveyed by the ALREADY-selected style row, duration
 * chip (still carrying its own "Recommended" sublabel via
 * `recommendedDurationId` - meditationDurations.js's own `recommended` flag
 * is still never read here), and the sound control's own resolved value -
 * no separate summary of information the three real controls already show.
 * The recommendation ENGINE itself (useMeditationSession's own
 * initialStyleId/initialDurationId/initialSoundId seeding, and
 * getRecommendedDurationId) is completely untouched by this pass - only its
 * former duplicated presentation is removed.
 *
 * `beginLabel` (defect fix - optional override, default null): every
 * current caller (Morning/Evening/standalone) now omits it and gets the
 * live-computed "Begin N-Minute Meditation" (formatMeditationBeginLabel,
 * meditationDurations.js), which always reflects the current `duration`
 * prop and updates immediately when the user picks a different one.
 */
export const MeditationSetupPanel = ({
  // Morning Visual Uplift (Phase 6) — `heading` (default 'Take a Mindful
  // Pause', matching Evening's own approved copy). Morning passes its own
  // shorter 'Mindful Pause'; Anytime passes its own 'Choose Your
  // Meditation' (Meditation ↔ Breathing alignment correction, journey-
  // specific wording).
  heading = 'Take a Mindful Pause',
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
  // Context-aware Meditation theming — `journeyTone` (renamed from the
  // earlier `accent`, additive, default 'primary'): every caller -
  // MorningMeditate.jsx, EveningMeditate.jsx pass their own fixed
  // 'morning'/'evening' directly (unambiguous, embedded journeys);
  // SelfGuidedMeditation.jsx now passes its own dynamically-resolved
  // journeyTone (see usePracticeJourneyTone.js) instead of a hardcoded
  // 'anytime' literal, so a Home-quick-action-launched standalone
  // Meditation inherits whichever journey was active on Home, not always
  // mint. Drives the Begin button, the header icon, the Sound control, and
  // is threaded down into MeditationOptionRow/MeditationDurationChip for
  // their own selected-state colours.
  journeyTone = 'primary'
}) => {
  // Defect fix — always derived from the live `duration` prop (same
  // source the selected duration chip already reads correctly), never a
  // stale caller-supplied string.
  const resolvedBeginLabel = beginLabel || formatMeditationBeginLabel(duration);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <MeditationSoundControl soundId={soundId} onSelectSound={onSelectSound} journeyTone={journeyTone} />
      </div>

      <div className="space-y-1">
        <span className={`material-symbols-outlined ${getJourneyToneTokens(journeyTone).text} text-3xl`} aria-hidden="true">self_improvement</span>
        <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight mt-2">{heading}</h1>
        {purpose && <p className="text-xs text-on-surface-variant">{purpose}</p>}
      </div>

      <div className="space-y-2">
        <h2 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Meditation style</h2>
        {/* Meditation ↔ Breathing alignment correction — vertically
            stacked, full-width rows (BreathingPatternRow's own treatment,
            via MeditationOptionRow's new `icon` prop), replacing the
            former dense two-column grid. The exact same five real styles,
            in their existing order - nothing renamed, reordered, or given
            different content. */}
        <div className="space-y-2" role="radiogroup" aria-label="Meditation style">
          {MEDITATION_STYLES.map((s) => (
            <MeditationOptionRow
              key={s.id}
              groupName="meditation-style"
              label={s.label}
              description={s.description}
              selected={style.id === s.id}
              onSelect={() => onSelectStyle(s.id)}
              journeyTone={journeyTone}
              icon={s.icon}
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
              sublabel={d.id === recommendedDurationId ? 'Recommended' : null}
              selected={duration.id === d.id}
              onSelect={() => onSelectDuration(d.id)}
              journeyTone={journeyTone}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {onExploreGuided && (
          <button
            type="button"
            onClick={onExploreGuided}
            className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary"
          >
            Explore Guided Meditations
          </button>
        )}

        <button
          type="button"
          onClick={onBegin}
          className={`w-full ${getJourneyPrimaryActionClasses(journeyTone)} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
        >
          <span>{resolvedBeginLabel}</span>
          <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
        </button>

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
