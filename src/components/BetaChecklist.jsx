import { useState } from 'react';
import { CHECKLIST_ITEMS, getCompletedChecklistItems, toggleChecklistItem } from '../lib/betaChecklist';

/*
 * WakeWise — Closed Beta Preparation, Phase A — BetaChecklist
 *
 * Same row/touch-target language as every other list in this app
 * (min-h-[56px], glass-panel, divide-y) — no new visual pattern.
 */
export const BetaChecklist = () => {
  const [completed, setCompleted] = useState(getCompletedChecklistItems);

  const handleToggle = (id) => {
    setCompleted(toggleChecklistItem(id));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Getting started</h3>
        <span className="text-xs font-bold text-primary">{completed.length}/{CHECKLIST_ITEMS.length}</span>
      </div>
      <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        {CHECKLIST_ITEMS.map((item) => {
          const isChecked = completed.includes(item.id);
          return (
            <button
              key={item.id}
              onClick={() => handleToggle(item.id)}
              className="w-full flex items-center gap-3 p-4 min-h-[56px] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset text-left"
            >
              <span
                role="checkbox"
                aria-checked={isChecked}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  isChecked ? 'bg-primary border-primary' : 'border-white/20'
                }`}
              >
                {isChecked && <span className="material-symbols-outlined text-on-primary text-sm">check</span>}
              </span>
              <span className={`text-sm font-semibold ${isChecked ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
