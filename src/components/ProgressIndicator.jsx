import { getSessionById } from '../session/sessionRegistry';

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

const STEP_LABELS = {
  // morning-routine
  alarm: 'Alarm',
  affirmation: 'Affirm',
  stretch: 'Stretch',
  breathe: 'Breathe',
  intention: 'Intend',
  complete: 'Done',
  // evening-wind-down
  windDown: 'Wind Down',
  reflection: 'Reflect',
  gratitude: 'Gratitude',
  breathing: 'Breathe',
  sleepPreparation: 'Rest',
  completion: 'Done',
};

const VISIBLE_STEP_IDS_BY_SESSION = {
  [MORNING_SESSION_ID]: new Set(['alarm', 'affirmation', 'stretch', 'breathe', 'intention', 'complete']),
  [EVENING_SESSION_ID]: new Set(['windDown', 'reflection', 'gratitude', 'breathing', 'sleepPreparation', 'completion']),
};

const FALLBACK_STEP_IDS_BY_SESSION = {
  [MORNING_SESSION_ID]: ['alarm', 'affirmation', 'stretch', 'breathe', 'intention', 'complete'],
  [EVENING_SESSION_ID]: ['windDown', 'reflection', 'gratitude', 'breathing', 'sleepPreparation', 'completion'],
};

const getVisibleStepIds = (sessionId) => {
  const visibleIds = VISIBLE_STEP_IDS_BY_SESSION[sessionId] ?? VISIBLE_STEP_IDS_BY_SESSION[MORNING_SESSION_ID];
  const fallbackIds = FALLBACK_STEP_IDS_BY_SESSION[sessionId] ?? FALLBACK_STEP_IDS_BY_SESSION[MORNING_SESSION_ID];
  const session = getSessionById(sessionId);
  if (!session) return fallbackIds;
  const ids = session.steps.map((step) => step.id).filter((id) => visibleIds.has(id));
  return ids.length > 0 ? ids : fallbackIds;
};

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
