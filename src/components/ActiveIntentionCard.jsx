import { useState } from 'react';
import { INTENTION_PRESETS } from '../lib/intentionAffirmations';
import { toggleIntention, roleForIndex, LIMIT_MESSAGE } from '../lib/intentionSelection';

/*
 * WakeWise — Home.jsx's "Change intention" — shared by both places Home
 * shows the user's own Morning intentions (the Morning-complete "Today's
 * Intention" card and the plain-daytime "Active Intention" card), so the
 * edit affordance/behaviour can never drift between the two.
 *
 * One or two intentions, ordered - first is Primary, second (if present)
 * is Supporting. Selection rules (toggle to deselect, promote Supporting
 * to Primary, the two-item limit, custom counts toward it) are owned
 * entirely by the shared intentionSelection.js helper - the exact same
 * module IntentionSetup.jsx uses, so both places a user can pick
 * intentions behave identically.
 *
 * An explicit edit mode (isEditing), never something that could be
 * confused with actually starting/resuming the Morning routine or the
 * Session Engine - this component knows nothing about either. `onSave`
 * is the caller's own handleSaveIntentions (Home.jsx), which calls the
 * exact same setIntentions + saveIntentionsToCloud mechanism
 * IntentionSetup.jsx itself uses - never a second, parallel save path.
 *
 * Guests: `onRequireSignIn` is Home's own existing promptRoutineSignIn
 * (the same SignInPromptDialog every other restricted action on this page
 * already uses) - tapping "Change intention" as a guest opens that prompt
 * instead of ever entering edit mode, so nothing is ever saved locally
 * for a guest here.
 */
export const ActiveIntentionCard = ({ label, intentions, isGuest, onRequireSignIn, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftSelection, setDraftSelection] = useState([]);
  const [customIntention, setCustomIntention] = useState('');
  const [limitMessage, setLimitMessage] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const handleChangeTap = () => {
    if (isGuest) {
      onRequireSignIn();
      return;
    }
    setDraftSelection(intentions);
    setCustomIntention('');
    setLimitMessage('');
    setIsEditing(true);
  };

  const applySelection = (value) => {
    const { intentions: next, limitReached } = toggleIntention(draftSelection, value);
    if (limitReached) {
      setLimitMessage(LIMIT_MESSAGE);
      setTimeout(() => setLimitMessage(''), 2500);
      return;
    }
    setLimitMessage('');
    setDraftSelection(next);
  };

  const handleAddCustom = () => {
    const trimmed = customIntention.trim();
    if (!trimmed) return;
    applySelection(trimmed);
    setCustomIntention('');
  };

  const handleSave = async () => {
    if (draftSelection.length === 0) return;
    setIsEditing(false);
    await onSave(draftSelection);
    // Brief, self-clearing confirmation - never a persistent banner.
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  if (isEditing) {
    return (
      <div className="glass-panel p-5 rounded-3xl space-y-4 shadow-sm border-primary/20">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Change intention</p>
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            This updates today's active intentions going forward. It does not rewrite a completed routine's saved affirmation record.
          </p>
          <p className="text-[11px] text-on-surface-variant leading-relaxed font-semibold">
            Choose one or two intentions for today.
          </p>
          {limitMessage && (
            <p className="text-[11px] text-secondary font-semibold" role="status">{limitMessage}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {INTENTION_PRESETS.map((preset) => {
            const selectedIndex = draftSelection.findIndex((item) => item.toLowerCase() === preset.toLowerCase());
            const isSelected = selectedIndex !== -1;
            const role = roleForIndex(selectedIndex);
            return (
              <button
                key={preset}
                type="button"
                onClick={() => applySelection(preset)}
                aria-pressed={isSelected}
                className={`relative p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                  isSelected
                    ? 'bg-primary-container/20 border-primary text-primary font-bold'
                    : 'glass-panel border-white/10 text-on-surface hover:bg-white/10'
                }`}
              >
                {role && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-on-primary text-[8px] font-bold uppercase tracking-wider shadow-sm">
                    {role}
                  </span>
                )}
                {preset}
              </button>
            );
          })}
        </div>
        {draftSelection.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {draftSelection.map((item, idx) => (
              <button
                key={item.toLowerCase()}
                type="button"
                onClick={() => applySelection(item)}
                className="flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full bg-primary-container/20 border border-primary text-primary text-[11px] font-semibold"
              >
                <span className="text-[8px] font-bold uppercase tracking-wider">{roleForIndex(idx)}</span>
                <span>{item}</span>
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-panel border border-white/10 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
          <input
            type="text"
            value={customIntention}
            onChange={(e) => setCustomIntention(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your own..."
            className="flex-1 min-w-0 bg-transparent border-none text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none px-3"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            disabled={!customIntention.trim()}
            className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container text-xs font-bold uppercase tracking-wider active:scale-95 disabled:opacity-40 transition-all shrink-0"
          >
            Add
          </button>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={draftSelection.length === 0}
          className="w-full py-3 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-wider active:scale-95 disabled:opacity-40 transition-all"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors py-1"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-secondary">{label}</p>
        <button
          type="button"
          onClick={handleChangeTap}
          className="text-[11px] font-bold text-primary hover:opacity-80 active:scale-95 transition-all shrink-0"
        >
          Change intention
        </button>
      </div>
      <div className="space-y-1">
        {intentions.map((item, idx) => (
          <p key={item.toLowerCase()} className="text-lg italic font-medium text-on-surface flex items-baseline gap-2">
            {intentions.length > 1 && (
              <span className="text-[9px] not-italic font-bold uppercase tracking-wider text-secondary shrink-0">{roleForIndex(idx)}</span>
            )}
            <span>"{item}"</span>
          </p>
        ))}
      </div>
      {justSaved && (
        <p className="text-[11px] text-tertiary font-semibold flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          Intention updated
        </p>
      )}
    </div>
  );
};
