import { getSessionById } from '../session/sessionRegistry';

/*
 * Stage 3C — ProgressIndicator, Session Registry migration (Ticket Group 3B1)
 *
 * Data-source migration only — the visible UI is unchanged. Previously
 * this component owned its own hardcoded, independently-maintained step
 * order (one of the three hand-synced copies named in the Stage 3C
 * execution plan §7/§24, alongside AlarmContext.jsx's `journeyStep`
 * vocabulary and Layout.jsx's `stepPaths` map). Group 1's registry
 * (src/session/sessionDefinitions.js) is now the single source of truth
 * for step ORDER; this file's only remaining local knowledge is
 * presentation (labels) and which registry steps this specific indicator
 * has always chosen to show.
 *
 * PROPS — unchanged
 *   activeStep  the step id currently active, exactly as before.
 *
 * VISIBLE-STEP FILTER
 *   The registry's 'morning-routine' session has seven steps (alarm,
 *   start, affirmation, stretch, breathe, intention, complete). This
 *   indicator has never shown all seven — 'start' has no marker here
 *   because MorningStart.jsx has never rendered <ProgressIndicator>.
 *   VISIBLE_STEP_IDS is that existing, unchanged 6-item subset — a
 *   filter/allowlist, not an order (order still comes entirely from the
 *   registry's own step array, read below). Do not add 'start' (or any
 *   future registry step) to this set without an explicit, separately
 *   approved UI change — doing so would add a new visible marker.
 *
 * LABELS
 *   The registry deliberately carries no `label` field (labels are
 *   presentation, not session data — see sessionDefinitions.js's own doc
 *   comment). STEP_LABELS is the small, presentation-only map that
 *   replaces the label half of the old hardcoded array; its values are
 *   copied verbatim from that array, unchanged.
 *
 * MISSING-REGISTRY FALLBACK
 *   'morning-routine' is a static Group 1 definition that should never
 *   actually be missing. getVisibleStepIds() defends against it anyway:
 *   if getSessionById() returns null, or filtering ever produces zero
 *   visible ids, FALLBACK_STEP_IDS (the exact prior hardcoded order) is
 *   used instead — never a crash, never a silently empty/broken
 *   indicator. This is a dormant last-resort constant, not a second
 *   active source of ordering truth: under any normal condition the
 *   registry read above always succeeds and this path is never taken.
 */

const MORNING_SESSION_ID = 'morning-routine';

const STEP_LABELS = {
  alarm: 'Alarm',
  affirmation: 'Affirm',
  stretch: 'Stretch',
  breathe: 'Breathe',
  intention: 'Intend',
  complete: 'Done',
};

const VISIBLE_STEP_IDS = new Set(['alarm', 'affirmation', 'stretch', 'breathe', 'intention', 'complete']);

const FALLBACK_STEP_IDS = ['alarm', 'affirmation', 'stretch', 'breathe', 'intention', 'complete'];

const getVisibleStepIds = (sessionId) => {
  const session = getSessionById(sessionId);
  if (!session) return FALLBACK_STEP_IDS;
  const ids = session.steps.map((step) => step.id).filter((id) => VISIBLE_STEP_IDS.has(id));
  return ids.length > 0 ? ids : FALLBACK_STEP_IDS;
};

// Stage 4 Batch F2: optional `sessionId` prop, defaulting to the exact
// same MORNING_SESSION_ID this component has always used — every
// existing caller (Breathe.jsx, MorningFlow.jsx, Affirmation.jsx) omits
// this prop today, so their behaviour is byte-for-byte unchanged.
// STEP_LABELS/VISIBLE_STEP_IDS/FALLBACK_STEP_IDS below remain
// morning-specific presentation constants — generalizing the *lookup*
// mechanism is this batch's whole scope ("shared components only, no
// screens"); labels for a non-morning session are a product decision
// for whichever batch first renders one.
export const ProgressIndicator = ({ activeStep, sessionId = MORNING_SESSION_ID }) => {
  const steps = getVisibleStepIds(sessionId).map((id) => ({ key: id, label: STEP_LABELS[id] ?? id }));

  const activeIndex = steps.findIndex(step => step.key === activeStep);

  return (
    <div className="w-full flex justify-between items-center px-2 py-4 border-b border-white/5 select-none shrink-0 z-50 text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/40">
      {steps.map((step, idx) => {
        const isCompleted = idx < activeIndex;
        const isActive = idx === activeIndex;

        return (
          <div key={step.key} className="flex items-center gap-1">
            <span className={`transition-all duration-300 ${
              isActive
                ? 'text-primary font-bold scale-105'
                : isCompleted
                ? 'text-secondary'
                : 'text-on-surface-variant/30'
            }`}>
              {isCompleted ? '✓' : ''} {step.label}
            </span>
            {idx < steps.length - 1 && <span className="text-on-surface-variant/20 mx-0.5">·</span>}
          </div>
        );
      })}
    </div>
  );
};
