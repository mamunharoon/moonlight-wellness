/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlarm } from '../context/AlarmContext';
import { INTENTION_PRESETS } from '../lib/intentionAffirmations';
import { saveIntentionsToCloud } from '../lib/intentionPersistence';
import {
  toggleIntention,
  addCustomIntention,
  roleForIndex,
  LIMIT_MESSAGE,
  CUSTOM_LIMIT_MESSAGE,
  DUPLICATE_INTENTION_MESSAGE
} from '../lib/intentionSelection';
import { JourneyHeader } from '../components/journey/JourneyHeader';
import { SelectionChip } from '../components/journey/SelectionChip';

/*
 * WakeWise — Build 15 Phase B remediation — dedicated Change Intention
 * screen, replacing Home.jsx's expanded-inline-card editor
 * (ActiveIntentionCard's former `isEditing` mode).
 *
 * Reuses every existing piece of business logic verbatim - nothing here
 * is a second, parallel implementation:
 *   - `toggleIntention`/`roleForIndex`/`LIMIT_MESSAGE` (intentionSelection.js)
 *     - the exact same one-or-two-item selection rules IntentionSetup.jsx
 *       (Morning routine's own Step 1) already uses.
 *   - `saveIntentionsToCloud` (intentionPersistence.js) - the exact same
 *     save mechanism, called the exact same way: `setIntentions(values)`
 *     (AlarmContext, updates the live app-wide value immediately) then
 *     `saveIntentionsToCloud(userId, values)` (best-effort cloud upsert,
 *     never blocks/reverts the local save on failure). No Session Engine
 *     call, no routine start/resume/reset, no journal/history write -
 *     exactly the same guarantee the old inline editor already carried
 *     (see that guarantee's own long-form justification, preserved
 *     below), so changing today's intention here can never create a
 *     second Morning completion or rewrite a completed routine's already
 *     -saved affirmation record (Affirmation.jsx snapshots `intentions`
 *     only at the moment a LIVE routine reaches that step, never re-reads
 *     it retroactively for a routine that already finished).
 *   - IntentionSetup.jsx itself is completely untouched - a distinct,
 *     Session-Engine-coupled screen with its own Continue/Skip/Exit
 *     semantics that this change deliberately does not touch or reuse.
 *
 * Local draft, explicit Save/Cancel: unlike IntentionSetup.jsx (which
 * commits every tap immediately), this screen mirrors the old inline
 * editor's own draft model - nothing reaches AlarmContext's live
 * `intentions` (and so nothing reaches Home, or Supabase) until Save is
 * actually tapped. Back/Close/Cancel all simply navigate away, letting
 * the local draft state be discarded for free.
 *
 * `draftSelection` is DERIVED during render, not effect-synced: `manualDraft`
 * stays null until the user's first edit, and `draftSelection` falls back to
 * whatever the live context value currently is whenever `manualDraft` is
 * still null. A direct-route visit or a hard refresh can land here before
 * AlarmContext's own Supabase fetch of the user's real saved intentions has
 * resolved - deriving during render (rather than syncing via a
 * setState-in-effect, an anti-pattern React's own docs warn against) means
 * the preload jumps to the real value the moment it arrives, automatically,
 * on the next render - and once `manualDraft` is set (the user's first tap),
 * it takes over completely, so a later context change never clobbers an
 * edit already in progress.
 */
export const ChangeIntention = () => {
  const navigate = useNavigate();
  const { isGuest, loading: authLoading } = useAuth();
  const { userId, intentions, setIntentions, setIntentionsConfirmed } = useAlarm();

  const [manualDraft, setManualDraft] = useState(null);
  const draftSelection = manualDraft ?? (intentions.length > 0 ? intentions : ['Stay calm']);
  const [customIntention, setCustomIntention] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Guests: Home's own "Change intention" tap already intercepts with the
  // sign-in prompt before ever navigating here (ActiveIntentionCard's
  // isGuest check, unchanged) - this is the defensive second gate for a
  // direct URL visit/bookmark/refresh. Gated on `!authLoading` so a
  // genuinely signed-in user refreshing this exact route is never
  // bounced home while their session is still resolving.
  if (!authLoading && isGuest) {
    return <Navigate to="/" replace />;
  }

  const applySelection = (value) => {
    const { intentions: next, limitReached } = toggleIntention(draftSelection, value);
    if (limitReached) {
      setLimitMessage(LIMIT_MESSAGE);
      setTimeout(() => setLimitMessage(''), 2500);
      return;
    }
    setLimitMessage('');
    setManualDraft(next);
  };

  // Custom-intention defect fix (found live: "Add your own" with two
  // intentions already selected silently cleared the typed text and
  // showed no reliably-visible feedback) — uses addCustomIntention
  // (ADD-only) rather than the chip-tap toggleIntention/applySelection
  // above: typing an already-selected value must be rejected as a
  // duplicate, never toggle that selection off. The typed text is only
  // ever cleared on a genuine 'added' outcome - every rejection preserves
  // it so the user can edit/retry or copy it elsewhere rather than
  // watching it vanish.
  const handleAddCustom = () => {
    const { intentions: next, status } = addCustomIntention(draftSelection, customIntention);
    if (status === 'blank') return;
    if (status === 'duplicate') {
      setLimitMessage(DUPLICATE_INTENTION_MESSAGE);
      setTimeout(() => setLimitMessage(''), 2500);
      return;
    }
    if (status === 'limit-reached') {
      setLimitMessage(CUSTOM_LIMIT_MESSAGE);
      setTimeout(() => setLimitMessage(''), 2500);
      return;
    }
    setLimitMessage('');
    setManualDraft(next);
    setCustomIntention('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  const handleClose = () => navigate('/');

  const handleSave = async () => {
    if (draftSelection.length === 0) return;
    setIsSaving(true);
    setIntentions(draftSelection);
    // F1 — this screen (ChangeIntention.jsx) already only exists as a
    // deliberate, explicit change to a real selection - a genuine confirm.
    setIntentionsConfirmed(true);
    await saveIntentionsToCloud(userId, draftSelection);
    setIsSaving(false);
    navigate('/');
  };

  return (
    <div
      className="max-w-md w-full mx-auto space-y-8 animate-in fade-in duration-500 pb-4"
      style={{
        paddingLeft: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-left))',
        paddingRight: 'calc(clamp(1rem, 4vw, 1.25rem) + env(safe-area-inset-right))',
        paddingTop: 'calc(1rem + env(safe-area-inset-top))'
      }}
    >
      <JourneyHeader showBackButton backFallback="/" onClose={handleClose} />

      <div className="space-y-6">
        <div className="space-y-1">
          <span className="material-symbols-outlined text-primary text-3xl" aria-hidden="true">spa</span>
          <h1 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight mt-2">Change your intention</h1>
          <p className="text-sm text-on-surface-variant">Choose one or two qualities to carry into today.</p>
          <p className="text-xs text-on-surface-variant/70 leading-relaxed">
            This updates today's active intentions going forward. It does not rewrite a completed routine's saved affirmation record.
          </p>
          {limitMessage && (
            <p className="text-xs text-secondary font-semibold" role="status">{limitMessage}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Choose one or two qualities to carry into today">
          {INTENTION_PRESETS.map((preset) => {
            const selectedIndex = draftSelection.findIndex((item) => item.toLowerCase() === preset.toLowerCase());
            const isSelected = selectedIndex !== -1;
            return (
              <SelectionChip
                key={preset}
                large
                label={preset}
                selected={isSelected}
                roleLabel={roleForIndex(selectedIndex)}
                onClick={() => applySelection(preset)}
              />
            );
          })}
        </div>

        {draftSelection.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Currently selected intentions">
            {draftSelection.map((item, idx) => (
              <button
                key={item.toLowerCase()}
                type="button"
                onClick={() => applySelection(item)}
                className="flex items-center gap-1.5 min-h-[44px] pl-3 pr-2 py-1.5 rounded-full bg-primary-container/20 border border-primary text-primary text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="text-[9px] font-bold uppercase tracking-wider">{roleForIndex(idx)}</span>
                <span>{item}</span>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
              </button>
            ))}
          </div>
        )}

        {/* Optional collapsed "Add your own" - typing is never required to
            complete this screen; the six preset cards above are always
            enough on their own. */}
        {showCustomInput ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-panel border border-white/10 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
              <input
                type="text"
                value={customIntention}
                onChange={(e) => setCustomIntention(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 min-w-0 min-h-[44px] bg-transparent border-none text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none px-3"
                placeholder="Write your own..."
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddCustom}
                disabled={!customIntention.trim()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-primary-container text-on-primary-container text-xs font-bold uppercase tracking-wider active:scale-95 disabled:opacity-40 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Add
              </button>
            </div>
            {/* Custom-intention defect fix — a second, reliably-visible copy
                of the same limitMessage, rendered right next to the input
                the user is actually looking at (the top-of-page banner
                further up can be scrolled out of view or hidden behind the
                on-screen keyboard once this input has focus - found live). */}
            {limitMessage && (
              <p className="text-xs text-secondary font-semibold px-1" role="status">{limitMessage}</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            className="w-full min-h-[44px] flex items-center justify-center gap-1.5 py-3 rounded-2xl glass-panel border border-white/10 text-on-surface-variant text-xs font-bold uppercase tracking-wider hover:bg-white/5 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">add</span>
            Add your own
          </button>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || draftSelection.length === 0}
            className="w-full min-h-[44px] bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-40"
          >
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">check</span>
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="w-full min-h-[44px] text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
