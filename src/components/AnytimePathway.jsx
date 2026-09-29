// Anytime Visual Flow and Closing Handoff uplift — the Anytime decision
// pathway: Need -> Time -> Reset. Deliberately NOT a copy of Morning/
// Evening's own five-stage practice pathway (MorningJourneyPathway.jsx/
// EveningJourneyPathway.jsx) - Anytime is not a fixed routine, and this
// pathway represents a 3-step DECISION wizard (what do you need, how much
// time, which reset), never a sequence of practices to complete in order.
//
// Honesty contract, mirroring EveningJourneyPathway.jsx's own audited
// design: the genuine stage icon is ALWAYS the primary visual, never
// replaced by a checkmark. `currentStageId` (which step the wizard is
// genuinely on right now - always reliable, it's just AnytimeReset.jsx's
// own `step` state) drives the mint highlight/ring independently. A small
// secondary check badge appears on Need/Time ONLY when that step's own
// REAL, already-known value is genuinely set (`needSelected`/
// `timeSelected` - not inferred from step position, just the plain fact
// that `needId`/`durationId` is non-null) - selecting Need or Time is a
// plain UI navigation action, never itself recorded as a wellbeing-
// practice completion (see this pass's own Part 2 requirement). Reset
// never receives a check badge at all: reaching/viewing the
// recommendation is not a completion of anything, and Anytime never shows
// a 100% indicator (Part 2's own explicit "Do not show 100% for Anytime").
import { JOURNEY_STAGE_ICONS } from '../session/journeyIcons';

const STAGES = [
  { id: 'need', label: 'Need', icon: JOURNEY_STAGE_ICONS.need },
  { id: 'time', label: 'Time', icon: JOURNEY_STAGE_ICONS.time },
  { id: 'reset', label: 'Reset', icon: JOURNEY_STAGE_ICONS.reset }
];

// Anytime visual-choice uplift (Part 3) — realigned onto the same strong
// tile visual language MorningJourneyPathway.jsx/EveningJourneyPathway.jsx
// already established for Morning/Evening's own approved pathway: a real
// CSS grid (`minmax(0, 1fr)` columns, never clipping at 320px, no
// horizontal scroll container needed for only 3 stages), larger clamp-
// scaled icons, and a small standalone ">" direction marker between
// adjacent stages instead of the line+arrowhead JourneyConnector this
// component previously rendered - Need -> Time -> Reset IS a genuine
// sequence (unlike Home's own Anytime preview row, whose four choices are
// independent and now show no connector at all - see Home.jsx). The
// honesty contract above is completely unchanged by this visual pass: the
// genuine stage icon stays the always-primary visual, isCurrent is a plain
// equality check, and the selected check badge is still driven only by the
// caller's own real needSelected/timeSelected values (Reset hardcoded
// false, never derived).
const ICON_CONTAINER_STYLE = { width: 'clamp(40px, 12vw, 52px)', height: 'clamp(40px, 12vw, 52px)' };
const ICON_GLYPH_STYLE = { fontSize: 'clamp(20px, 6vw, 26px)' };
const DIRECTION_MARKER_STYLE = { right: '-8px', fontSize: 'clamp(14px, 4vw, 18px)' };

/**
 * @param {{ currentStageId?: 'need'|'time'|'reset'|null, needSelected?: boolean, timeSelected?: boolean }} props
 */
export const AnytimePathway = ({ currentStageId = null, needSelected = false, timeSelected = false }) => {
  const isSelected = { need: needSelected, time: timeSelected, reset: false };
  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-1" role="list" aria-label="Anytime Reset steps: Need, Time, Reset">
        {STAGES.map((stage, idx) => {
          const isCurrent = stage.id === currentStageId;
          const selected = isSelected[stage.id];
          const badgeClass = isCurrent
            ? 'bg-tertiary-tint/25 border-tertiary text-tertiary'
            : 'bg-tertiary-tint/15 border-tertiary-tint/30 text-tertiary';
          const labelClass = isCurrent ? 'text-tertiary font-bold' : 'text-on-surface-variant font-semibold';
          const tileClass = isCurrent ? 'border-tertiary bg-tertiary-tint/10' : 'border-tertiary-tint/25 bg-tertiary-tint/5';
          return (
            <div key={stage.id} className="min-w-0" role="listitem">
              <div className={`flex flex-col items-center gap-1 w-full rounded-2xl border p-1 ${tileClass}`}>
                <div className="relative w-full flex items-center justify-center">
                  <span className={`relative rounded-full border-2 flex items-center justify-center shrink-0 ${badgeClass}`} style={ICON_CONTAINER_STYLE}>
                    <span className="material-symbols-outlined" style={ICON_GLYPH_STYLE} aria-hidden="true">{stage.icon}</span>
                    {selected && (
                      <span aria-hidden="true" className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-tertiary border border-surface flex items-center justify-center">
                        <span className="material-symbols-outlined text-[8px] text-on-tertiary leading-none">check</span>
                      </span>
                    )}
                  </span>
                  {idx < STAGES.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 pointer-events-none"
                      style={DIRECTION_MARKER_STYLE}
                    >
                      chevron_right
                    </span>
                  )}
                </div>
                <span className={`text-xs leading-tight text-center break-words ${labelClass}`}>
                  {stage.label}
                  {selected && <span className="sr-only">, selected</span>}
                  {isCurrent && <span className="sr-only">, current</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
