import { getSessionById } from '../session/sessionRegistry';
import { getStepLabel } from '../lib/stepLabels';
import {
  MORNING_DISPLAY_STEP_NUMBERS,
  MORNING_DISPLAY_STEP_COUNT,
  EVENING_DISPLAY_STEP_NUMBERS,
  EVENING_DISPLAY_STEP_COUNT
} from '../session/sessionConstants';

/*
 * Stage 3C — ProgressIndicator, Session Registry migration (Ticket Group 3B1)
 * Stage 4 Batch F4 Completion Pass — generalised for the evening-wind-down
 * session
 *
 * Data-source migration only — the visible UI is unchanged for morning.
 * Originally this component owned its own hardcoded, independently-
 * maintained step order (one of the three hand-synced copies named in the
 * Stage 3C execution plan §7/§24, alongside AlarmContext.jsx's
 * `journeyStep` vocabulary and Layout.jsx's `stepPaths` map). The Session
 * Registry (src/session/sessionDefinitions.js, read via
 * src/session/sessionRegistry.js) is the single source of truth for step
 * ORDER for both sessions this component now supports; this file's only
 * remaining local knowledge is presentation (labels) and which registry
 * steps each session's indicator has chosen to show.
 *
 * PROPS
 *   activeStep  the step id currently active, exactly as before.
 *   sessionId   Stage 4 Batch F2: optional, defaults to MORNING_SESSION_ID
 *               ('morning-routine') — every pre-existing caller (Breathe,
 *               MorningFlow, Affirmation) omits this prop, so their
 *               behaviour is byte-for-byte unchanged. Stage 4 Batch F4
 *               Completion Pass adds real support for
 *               EVENING_SESSION_ID ('evening-wind-down'), used by
 *               Reflection.jsx and Gratitude.jsx.
 *
 * Morning Visual Uplift (Build 16) — the ACTIVE step's colour now reads
 * `isMorning` the same way the existing `isEvening` branch already reads
 * its own session, and recolours ONLY the active step from the generic
 * `text-primary` peach to the same already-contrast-verified
 * morning-accent gold Home's Today's Rhythm Morning tab and
 * BreathingPatternRow's 'morning' accent both already use - a restrained,
 * additive change (completed/upcoming-step colours, the separator dots,
 * and Evening's entire isEvening branch are all untouched). Evening
 * (isEvening true) is unaffected: isMorning is false whenever isEvening
 * is true, so the two branches can never both apply.
 *
 * Evening Visual Uplift (Build 17) — the ACTIVE step now also branches on
 * `isEvening`, recolouring ONLY the active step from `text-primary` peach
 * to the same already-contrast-verified evening-accent periwinkle every
 * other selected/unselected Evening control (AnswerOptionButton's
 * unselected ring, BreathingPatternRow's 'evening' accent, PrepareToggleRow)
 * already uses. Completed/upcoming-step colours and the separator dots
 * (already isEvening-aware from the earlier contrast fix) are untouched -
 * only this one ternary branch gains a third arm. isMorning and isEvening
 * remain mutually exclusive by construction, so Morning's own gold branch
 * above is provably unaffected.
 *
 * PER-SESSION VISIBLE-STEP FILTERS
 *   VISIBLE_STEP_IDS_BY_SESSION is a filter/allowlist per session, not an
 *   order (order always comes from the registry's own step array, read
 *   below) — same role morning's original VISIBLE_STEP_IDS played, now
 *   keyed by session so each session can choose its own subset
 *   independently. Morning's entry is untouched: the same 6-of-7 subset
 *   that has always excluded 'start' (MorningStart.jsx has never rendered
 *   this component). Evening's entry is the full 6-of-6 steps the
 *   Session Registry defines for 'evening-wind-down' — windDown,
 *   reflection, gratitude, breathing, sleepPreparation, completion — per
 *   this batch's own explicit instruction to represent WIND DOWN /
 *   REFLECT / GRATITUDE / BREATHE / REST / DONE, even though the last two
 *   (breathing/sleepPreparation) have no page yet (F6). Do not add or
 *   remove an id from either set without an explicit, separately approved
 *   UI change — doing so changes what markers are visible.
 *
 * LABELS
 *   The registry deliberately carries no `label` field (labels are
 *   presentation, not session data — see sessionDefinitions.js's own doc
 *   comment). STEP_LABELS is a single flat, presentation-only map keyed
 *   by step id — safe as one flat object because every morning and
 *   evening step id is a distinct string (no collisions between the two
 *   sessions' vocabularies). Morning's six values are copied verbatim
 *   from the original hardcoded array; evening's six are this batch's own
 *   presentation choice (Wind Down / Reflect / Gratitude / Breathe / Rest
 *   / Done). No route strings appear anywhere in this file — routes stay
 *   the registry's and React Router's concern, never this component's.
 *
 * MISSING-REGISTRY FALLBACK
 *   Both sessions are static registry definitions that should never
 *   actually be missing. getVisibleStepIds() defends against it anyway:
 *   if getSessionById() returns null, or filtering ever produces zero
 *   visible ids, that session's FALLBACK_STEP_IDS (its own visible set,
 *   restated as a plain array) is used instead — never a crash, never a
 *   silently empty/broken indicator. An unrecognised sessionId falls back
 *   to morning's own config, matching the prop's documented default.
 *   These are dormant last-resort constants, not a second active source
 *   of ordering truth: under any normal condition the registry read above
 *   always succeeds and this path is never taken.
 */

const MORNING_SESSION_ID = 'morning-routine';
const EVENING_SESSION_ID = 'evening-wind-down';

// Morning-flow redesign: 'start' removed (the former /morning-start
// video-selection screen is no longer part of the routine at all — see
// sessionConstants.js's MORNING_STEP_IDS). Order is derived from the
// registry (session.steps, read above); this is a visibility filter only.
// Journey Embedding — 'meditate'/'meditation' added to each session's
// visible set, immediately after breathe/breathing (matching the
// registry's own real step order - see sessionDefinitions.js). Meditation
// is shown here as a real progress-bar stage, and (corrected) is also
// counted in MORNING_DISPLAY_STEP_NUMBERS/EVENING_DISPLAY_STEP_NUMBERS in
// sessionConstants.js - the two are consistent with each other.
const VISIBLE_STEP_IDS_BY_SESSION = {
  [MORNING_SESSION_ID]: new Set(['intention', 'stretch', 'breathe', 'meditate', 'affirmation', 'complete']),
  [EVENING_SESSION_ID]: new Set(['windDown', 'reflection', 'gratitude', 'breathing', 'meditation', 'sleepPreparation', 'completion']),
};

const FALLBACK_STEP_IDS_BY_SESSION = {
  [MORNING_SESSION_ID]: ['intention', 'stretch', 'breathe', 'meditate', 'affirmation', 'complete'],
  [EVENING_SESSION_ID]: ['windDown', 'reflection', 'gratitude', 'breathing', 'meditation', 'sleepPreparation', 'completion'],
};

// Review Mode — Journey Embedding: meditation is shown as a completed
// stage in progress (the ✓ + label still render) but is deliberately never
// clickable from Review Mode - it has no dedicated review/detail screen to
// jump back into (unlike affirmation/reflection/etc, which show real
// entered content on review), and starting a NEW meditation from a
// completed-step tap would be a surprising, unintended side effect. A
// narrow id allowlist here, checked as one extra condition on the existing
// isCompleted && onReviewStep branch below, rather than a new prop or a
// second code path - every other step's reviewability is completely
// unaffected (the Set check is additive-only: removing it changes nothing
// for any id not in it).
const NON_REVIEWABLE_STEP_IDS = new Set(['meditate', 'meditation']);

const getVisibleStepIds = (sessionId) => {
  const visibleIds = VISIBLE_STEP_IDS_BY_SESSION[sessionId] ?? VISIBLE_STEP_IDS_BY_SESSION[MORNING_SESSION_ID];
  const fallbackIds = FALLBACK_STEP_IDS_BY_SESSION[sessionId] ?? FALLBACK_STEP_IDS_BY_SESSION[MORNING_SESSION_ID];
  const session = getSessionById(sessionId);
  if (!session) return fallbackIds;
  const ids = session.steps.map((step) => step.id).filter((id) => visibleIds.has(id));
  return ids.length > 0 ? ids : fallbackIds;
};

// Safe backward navigation ("Review Mode") - completed steps become real,
// focusable buttons; the current step stays highlighted-but-inert (you're
// already there); future/incomplete steps stay inert too (never
// reachable ahead of the engine's own furthest progress). `onReviewStep`
// is optional and completely additive: every existing caller that omits
// it keeps rendering plain, non-interactive spans exactly as before -
// only Morning/Evening pages that opt in by passing it get clickable
// completed steps.
//
// Touch-target fix, found in live DEV testing: the review button's
// original hit area was only ~44x27 CSS px (min-w/min-h were already
// overridden by the actual text+padding size, which never reached the
// declared minimums) - well under a usable ~44x44 mobile tap target,
// same class of defect Layout.jsx's own bottom nav was fixed for
// earlier ("the audit found the previous inactive-tab className had *no*
// padding at all, so its hit area was just the bare icon glyph").
// Reproduced live: a real click landed a few px off this tiny target and
// silently did nothing, while the identical action via an accessibility-
// tree-resolved click (which finds the element's true center) worked
// every time - i.e. the button was always correctly wired, just too
// small/tightly packed to reliably hit. Fixed with invisible py-3.5/px-1
// padding offset by matching negative margins, so the clickable area
// grows to ~44x44 without changing the progress bar's own visual height
// or the tight horizontal spacing between steps.
export const ProgressIndicator = ({ activeStep, sessionId = MORNING_SESSION_ID, onReviewStep }) => {
  const steps = getVisibleStepIds(sessionId).map((id) => ({ key: id, label: getStepLabel(id) }));

  const activeIndex = steps.findIndex(step => step.key === activeStep);
  // Evening colour-contrast fix: the original /40, /30, /20 low-opacity
  // treatments blend toward whatever's behind them - fine against this
  // app's normal near-black background (huge contrast margin regardless
  // of opacity), but a real WCAG AA failure against the evening/dusk
  // gradient's light peach/ember/lavender bands even after Gradient.jsx's
  // own strengthened scrim (manually verified: on-surface-variant at 40%
  // opacity there measures ~2:1, well under the 4.5:1 normal-text floor).
  // Fixed with full-opacity, non-fragile tokens for the evening session
  // specifically - morning's own indicator (the far more common case) is
  // deliberately left byte-for-byte unchanged, since it never had this
  // problem (its background is always the app's plain dark surface).
  const isEvening = sessionId === EVENING_SESSION_ID;
  const isMorning = sessionId === MORNING_SESSION_ID;

  // Compact "Step X of Y" fix (found in live DEV deployed verification) —
  // must read Morning/Evening's own DISPLAY_STEP_NUMBERS/DISPLAY_STEP_COUNT
  // (sessionConstants.js), never derive the count from `steps.length`
  // (the raw visible-dot array). The two disagree for Morning specifically:
  // Morning's dot array includes the terminal 'complete' step (6 entries)
  // but MORNING_DISPLAY_STEP_COUNT deliberately excludes it (5, matching
  // every other Morning "Step X of Y" surface) — using steps.length there
  // produced a live "Step 5 of 6" for Affirmation instead of the required
  // "Step 5 of 5". Evening's dot array happens to equal
  // EVENING_DISPLAY_STEP_COUNT already (both count the terminal step), so
  // this was never visibly wrong there, but reads from the same shared
  // source now for the same reason instead of by coincidence. Falls back to
  // the old activeIndex/steps.length math only for an activeStep with no
  // entry in the map (today, only the terminal step itself - no caller
  // passes it here) so this can never crash or blank the label.
  const displayStepNumbers = isEvening ? EVENING_DISPLAY_STEP_NUMBERS : MORNING_DISPLAY_STEP_NUMBERS;
  const displayStepCount = isEvening ? EVENING_DISPLAY_STEP_COUNT : MORNING_DISPLAY_STEP_COUNT;

  // Build 15 Phase A — restyle only: base label bumped 10px→11px and the
  // active-step emphasis strengthened (scale-105→scale-110) per the
  // approved "stronger typography hierarchy" direction. The evening
  // colour-contrast fix above (isEvening branch, WCAG-verified live) is
  // completely untouched - only size/scale changed, never the
  // color/opacity logic that keeps this readable against the evening
  // gradient.
  // Journey Embedding — narrow-screen crowding fix, real-execution-measured
  // (see the Phase 1 audit): Evening's 7 labels overflow at 320/375/390px
  // (up to 92px at 320px) and Morning's 6 labels overflow at 320px, once
  // meditation is added — neither text-shrinking nor horizontal scrolling
  // (both explicitly rejected). Below Tailwind's own `sm` (640px) breakpoint,
  // render a compact "current stage + Step X of Y" summary instead of the
  // full dot row; at `sm` and above, the existing full row (unchanged
  // markup/classes) renders exactly as before. Both blocks are always in
  // the DOM — CSS (`sm:hidden` / `hidden sm:flex`) decides which is visible,
  // so there is no JS viewport check, no layout thrash on resize, and no
  // risk of a hydration/measurement mismatch. The compact block's own
  // sr-only step list keeps every label available as real accessible
  // context at any width — "accessible segments," not merely two labels.
  const activeStepLabel = steps[activeIndex]?.label ?? '';

  const renderStep = (step, idx) => {
    const isCompleted = idx < activeIndex;
    const isActive = idx === activeIndex;
    const isReviewable = isCompleted && onReviewStep && !NON_REVIEWABLE_STEP_IDS.has(step.key);

    const labelClassName = `transition-all duration-300 ${
      isActive
        ? (isMorning ? 'text-morning-accent font-bold scale-110' : isEvening ? 'text-evening-accent font-bold scale-110' : 'text-primary font-bold scale-110')
        : isCompleted
        ? (isEvening ? 'text-on-surface' : 'text-secondary')
        : (isEvening ? 'text-on-surface-variant' : 'text-on-surface-variant/30')
    }`;

    return (
      <div key={step.key} className="flex items-center gap-1">
        {isReviewable ? (
          <button
            type="button"
            onClick={() => onReviewStep(step.key)}
            aria-label={`Review completed ${step.label} step`}
            className={`${labelClassName} min-w-[44px] min-h-[44px] flex items-center justify-center -my-3.5 py-3.5 -mx-1 px-1 hover:opacity-80 active:scale-95 transition-transform`}
          >
            ✓ {step.label}
          </button>
        ) : (
          <span className={labelClassName}>
            {isCompleted ? '✓' : ''} {step.label}
          </span>
        )}
        {idx < steps.length - 1 && (
          <span className={isEvening ? 'text-on-surface-variant/70 mx-0.5' : 'text-on-surface-variant/20 mx-0.5'}>·</span>
        )}
      </div>
    );
  };

  return (
    <div
      className={`w-full px-2 py-4 border-b border-white/5 select-none shrink-0 z-50 text-[11px] uppercase tracking-wider font-semibold ${
        isEvening ? 'text-on-surface-variant' : 'text-on-surface-variant/40'
      }`}
    >
      {/* Compact presentation — below sm (640px) only. */}
      <div className="flex sm:hidden items-center justify-center gap-2">
        <span className={isMorning ? 'text-morning-accent font-bold' : isEvening ? 'text-evening-accent font-bold' : 'text-primary font-bold'}>
          {activeStepLabel}
        </span>
        <span aria-hidden="true" className="text-on-surface-variant/40">·</span>
        <span className="text-on-surface-variant/70 normal-case tracking-normal font-medium">
          Step {displayStepNumbers[activeStep] ?? activeIndex + 1} of {displayStepCount ?? steps.length}
        </span>
        <span className="sr-only">
          {steps.map((step, idx) => `${step.label}${idx < activeIndex ? ' (completed)' : idx === activeIndex ? ' (current)' : ''}`).join(', ')}
        </span>
      </div>

      {/* Full dot-separated row — sm (640px) and above, unchanged from
          before this fix (same classes, same per-step render). */}
      <div className="hidden sm:flex justify-between items-center">
        {steps.map((step, idx) => renderStep(step, idx))}
      </div>
    </div>
  );
};
