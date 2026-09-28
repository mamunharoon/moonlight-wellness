/* eslint-disable no-unused-vars */
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
import { JourneyConnector } from './journey/JourneyConnector';

const STAGES = [
  { id: 'need', label: 'Need', icon: JOURNEY_STAGE_ICONS.need },
  { id: 'time', label: 'Time', icon: JOURNEY_STAGE_ICONS.time },
  { id: 'reset', label: 'Reset', icon: JOURNEY_STAGE_ICONS.reset }
];

/**
 * @param {{ currentStageId?: 'need'|'time'|'reset'|null, needSelected?: boolean, timeSelected?: boolean }} props
 */
export const AnytimePathway = ({ currentStageId = null, needSelected = false, timeSelected = false }) => {
  const isSelected = { need: needSelected, time: timeSelected, reset: false };
  return (
    <div className="overflow-x-auto scroll-hide -mx-1 px-1">
      <div className="flex items-start justify-center gap-1 min-w-max mx-auto" role="list" aria-label="Anytime Reset steps: Need, Time, Reset">
        {STAGES.map((stage, idx) => {
          const isCurrent = stage.id === currentStageId;
          const selected = isSelected[stage.id];
          const badgeClass = isCurrent
            ? 'bg-tertiary-tint/25 border-tertiary text-tertiary'
            : 'bg-tertiary-tint/15 border-tertiary-tint/30 text-tertiary';
          const labelClass = isCurrent ? 'text-tertiary font-bold' : 'text-on-surface-variant font-semibold';
          return (
            <div key={stage.id} className="flex items-start gap-1" role="listitem">
              <div className="flex flex-col items-center gap-1 w-14">
                <span className={`relative w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${badgeClass}`}>
                  <span className="material-symbols-outlined text-base" aria-hidden="true">{stage.icon}</span>
                  {selected && (
                    <span aria-hidden="true" className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-tertiary border border-surface flex items-center justify-center">
                      <span className="material-symbols-outlined text-[8px] text-on-tertiary leading-none">check</span>
                    </span>
                  )}
                </span>
                <span className={`text-[10px] leading-none whitespace-nowrap ${labelClass}`}>
                  {stage.label}
                  {selected && <span className="sr-only">, selected</span>}
                  {isCurrent && <span className="sr-only">, current</span>}
                </span>
              </div>
              {idx < STAGES.length - 1 && (
                /* w-8 h-8 (32px) icon circle - centre at 16px; connector is
                   11px tall (half = 5.5px) - 16 - 5.5 = 10.5px top margin
                   centres it exactly on the icon circle, not the label. */
                <JourneyConnector journeyTone="anytime" className="mt-[10.5px]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
