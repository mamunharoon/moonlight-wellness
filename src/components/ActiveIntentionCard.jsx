import { useState } from 'react';
import { INTENTION_PRESETS } from '../lib/intentionAffirmations';

/*
 * WakeWise — Home.jsx's "Change intention" — shared by both places Home
 * shows the user's own primary intention (the Morning-complete "Today's
 * Intention" card and the plain-daytime "Active Intention" card), so the
 * edit affordance/behaviour can never drift between the two.
 *
 * An explicit edit mode (isEditing), never something that could be
 * confused with actually starting/resuming the Morning routine or the
 * Session Engine - this component knows nothing about either. `onSave`
 * is the caller's own handleSaveIntention (Home.jsx), which calls the
 * exact same setIntentions + saveIntentionToCloud mechanism
 * IntentionSetup.jsx itself uses - never a second, parallel save path.
 *
 * Guests: `onRequireSignIn` is Home's own existing promptRoutineSignIn
 * (the same SignInPromptDialog every other restricted action on this page
 * already uses) - tapping "Change intention" as a guest opens that prompt
 * instead of ever entering edit mode, so nothing is ever saved locally
 * for a guest here.
 */
export const ActiveIntentionCard = ({ label, intention, isGuest, onRequireSignIn, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const handleChangeTap = () => {
    if (isGuest) {
      onRequireSignIn();
      return;
    }
    setIsEditing(true);
  };

  const handleSave = async (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setIsEditing(false);
    setDraft('');
    await onSave(trimmed);
    // Brief, self-clearing confirmation - never a persistent banner.
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave(draft);
    }
  };

  if (isEditing) {
    return (
      <div className="glass-panel p-5 rounded-3xl space-y-4 shadow-sm border-primary/20">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Change intention</p>
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            This updates today's active intention going forward. It does not rewrite a completed routine's saved affirmation record.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {INTENTION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleSave(preset)}
              className="p-3 rounded-xl glass-panel border border-white/10 text-xs font-semibold text-on-surface hover:bg-white/10 active:scale-95 transition-all"
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-panel border border-white/10 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your own..."
            className="flex-1 min-w-0 bg-transparent border-none text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none px-3"
          />
          <button
            type="button"
            onClick={() => handleSave(draft)}
            disabled={!draft.trim()}
            className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container text-xs font-bold uppercase tracking-wider active:scale-95 disabled:opacity-40 transition-all shrink-0"
          >
            Save
          </button>
        </div>
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
      <p className="text-lg italic font-medium text-on-surface">"{intention}"</p>
      {justSaved && (
        <p className="text-[11px] text-tertiary font-semibold flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          Intention updated
        </p>
      )}
    </div>
  );
};
