// Evening Visual Uplift (Phase 7) — the high-level Evening Wind-Down
// pathway (Reflect -> Gratitude -> Breathe -> Meditate -> Rest), shown on
// every Evening Home card state and on the Evening Wind-Down introduction
// screen. Mirrors MorningJourneyPathway.jsx's own structural pattern
// (small icon badges, chevron separators, overflow-x-auto safety net for
// 320px) but with a deliberately different completion contract - see the
// doc comment on `stageStatus` below for why.
//
// Every icon is a real, existing Material Symbol (never an emoji): `air`
// and `spa` are the exact same icons MorningJourneyPathway.jsx already
// uses for Breathe/Meditate (the same activity, same icon, across
// journeys); `chat_bubble` (Reflect) and `favorite` (Gratitude) mirror
// AnswerOptionButton's own icon choices for those two sections'
// eveningOptionPresentation.js entries; `bedtime` (Rest) matches
// EveningComplete.jsx's own existing completion-badge iconography for
// winding down toward sleep.
const STAGES = [
  { id: 'reflect', label: 'Reflect', icon: 'chat_bubble' },
  { id: 'gratitude', label: 'Gratitude', icon: 'favorite' },
  { id: 'breathe', label: 'Breathe', icon: 'air' },
  { id: 'meditate', label: 'Meditate', icon: 'spa' },
  { id: 'rest', label: 'Rest', icon: 'bedtime' }
];

// Physical-iPhone finding correction (Evening pathway) — unlike Morning's
// own MorningJourneyPathway (which replaces a completed step's icon with
// a checkmark, derived purely from stepIndex position), Evening's real
// Session Engine (session/sessionReducer.js) has no per-step record of
// whether a given step was genuinely completed or explicitly skipped -
// ADVANCE_STEP and SKIP_STEP both just increment the same `stepIndex`
// identically (audited directly in the reducer source; confirmed no
// stepHistory/completedSteps/skippedSteps field exists anywhere in
// session state). practiceCompletions.js is also write-only and only
// ever records the WHOLE routine, never an individual stage. So "the
// user is now past this stage" is NOT reliable evidence that stage was
// genuinely completed rather than skipped.
//
// This component therefore NEVER infers completed/skipped from
// `currentStageId`'s own position in STAGES - it only ever reads an
// EXPLICIT, externally-supplied `stageStatus` map ({ [stageId]:
// 'completed' | 'skipped' }), which today's callers (Home.jsx,
// EveningWindDown.jsx) never populate, because no reliable source for it
// currently exists (see this Phase 7 pass's own final report for the
// "100% vs skipped stages" follow-up this limitation feeds into). The
// capability itself is real and tested (see
// EveningJourneyPathway.test.js) for whenever a reliable per-stage
// signal exists in the future - it is simply never exercised by any
// current caller yet.
//
// The genuine stage icon is ALWAYS the primary visual, in every state -
// never replaced by a checkmark. A real completion only ever adds a
// small secondary check badge in the corner; a real skip only ever adds
// a small secondary muted dash badge; neither ever hides the real icon
// underneath. `currentStageId` (which stage the real session is on right
// now) is separately, fully reliable - session/sessionConstants.js's own
// step order is authoritative - and drives the ring/highlight treatment
// on its own, independent of `stageStatus`.
export const EveningJourneyPathway = ({ currentStageId = null, stageStatus = null } = {}) => (
  <div className="overflow-x-auto scroll-hide -mx-1 px-1">
    <div className="flex items-start justify-between gap-0.5 min-w-max mx-auto" role="list" aria-label="Evening Wind-Down stages: Reflect, Gratitude, Breathe, Meditate, Rest">
      {STAGES.map((stage, idx) => {
        const isCurrent = stage.id === currentStageId;
        const status = stageStatus?.[stage.id] ?? null;
        const isCompleted = status === 'completed';
        const isSkipped = status === 'skipped';
        const badgeClass = isCurrent
          ? 'bg-evening-accent-tint/25 border-evening-accent text-evening-accent'
          : 'bg-evening-accent-tint/15 border-evening-accent-tint/30 text-evening-accent';
        const labelClass = isCurrent ? 'text-evening-accent font-bold' : 'text-on-surface-variant font-semibold';
        return (
          <div key={stage.id} className="flex items-center gap-0.5" role="listitem">
            <div className="flex flex-col items-center gap-1 w-11">
              <span className={`relative w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${badgeClass}`}>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">{stage.icon}</span>
                {isCompleted && (
                  <span aria-hidden="true" className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-evening-accent border border-surface flex items-center justify-center">
                    <span className="material-symbols-outlined text-[8px] text-on-evening-accent leading-none">check</span>
                  </span>
                )}
                {isSkipped && (
                  <span aria-hidden="true" className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-surface-container-lowest border border-on-surface-variant/40 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[8px] text-on-surface-variant leading-none">remove</span>
                  </span>
                )}
              </span>
              <span className={`text-[9px] leading-none whitespace-nowrap ${labelClass}`}>
                {stage.label}
                {isCompleted && <span className="sr-only">, completed</span>}
                {isSkipped && <span className="sr-only">, skipped</span>}
                {isCurrent && <span className="sr-only">, current</span>}
              </span>
            </div>
            {idx < STAGES.length - 1 && (
              <span className="material-symbols-outlined text-on-surface-variant/30 text-xs -mt-4 shrink-0" aria-hidden="true">chevron_right</span>
            )}
          </div>
        );
      })}
    </div>
  </div>
);
