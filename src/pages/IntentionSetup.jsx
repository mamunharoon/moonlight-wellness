/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { BackButton } from '../components/BackButton';
import { INTENTION_PRESETS } from '../lib/intentionAffirmations';
import { saveIntentionToCloud } from '../lib/intentionPersistence';

/*
 * Morning-flow redesign — Intention step, now Step 1 of 4 (was Step 5 of
 * 5, immediately before Complete). Home's "Begin Rise & Reset",
 * RoutineDetail's "Start Routine", and AlarmActive's slide-to-unlock all
 * now start the Session Engine directly at this step (see each file's
 * own updated startSession(..., { startIndex: getStepIndex(...,
 * MORNING_STEP_IDS.INTENTION) }) call) - the former /morning-start
 * video-selection screen is removed from the routine entirely.
 *
 * F01-F03 "Focus Sessions" video rows are removed from this in-routine
 * step per the approved redesign (guided-video catalogues must not
 * interrupt the core routine) - not deleted from the catalogue or
 * Storage, still fully browsable via Library (see mediaCatalog.js's own
 * MORNING-FLOW REDESIGN REACHABILITY UPDATE comment).
 *
 * "Start Your Journey" renamed to "Continue" (this is no longer the last
 * screen before Complete - Stretch/Breathe/Affirm still follow).
 *
 * Quick-routine branch relocated here from Affirmation.jsx: this step
 * used to be immediately before Complete, so Affirmation.jsx (immediately
 * before Stretch/Breathe in the old order) owned the "skip Stretching
 * entirely for a quick routine" decision. Now Intention is immediately
 * before Stretch, so this screen owns that decision instead - the
 * destination step is the only thing that changed; the branch logic
 * itself (advanceToStep('breathe') vs advanceStep()) is copied verbatim
 * from Affirmation.jsx's own previous handleNext/handleSkip.
 */
export const IntentionSetup = () => {
  const navigate = useNavigate();
  const { userId, intentions, setIntentions, setJourneyStep, routineDuration } = useAlarm();
  const { state, currentStep, advanceStep, advanceToStep, abandonSession } = useSession();
  const [customIntention, setCustomIntention] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const presets = INTENTION_PRESETS;

  const handleSelectPreset = (preset) => {
    setIntentions([preset]); // Allow exactly ONE primary intention as requested
  };

  const handleAddCustom = () => {
    const trimmed = customIntention.trim();
    if (!trimmed) return;
    setIntentions([trimmed]);
    setCustomIntention('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  // Mirror only when the engine is genuinely playing at the 'intention'
  // step — a direct-route visit with no active session, or a mismatched
  // mirror, silently does nothing here.
  const mirrorTransition = () => {
    if (state.status !== 'playing' || currentStep?.id !== 'intention') return;
    if (routineDuration === 'quick') {
      advanceToStep('breathe');
    } else {
      advanceStep();
    }
  };

  const handleComplete = async () => {
    setIsSaving(true);

    const primaryIntention = intentions[0] || 'Stay calm';

    if (intentions.length > 0) {
      await saveIntentionToCloud(userId, primaryIntention);
    }

    setIsSaving(false);

    if (routineDuration === 'quick') {
      setJourneyStep('breathe');
      navigate('/breathe'); // Quick routine skips stretching entirely
    } else {
      setJourneyStep('stretch');
      navigate('/morning-flow');
    }
    mirrorTransition();
  };

  const handleExitRoutine = () => {
    setJourneyStep('');
    navigate('/');
    if (state.status === 'playing' && currentStep?.id === 'intention') abandonSession();
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-md mx-auto space-y-8 select-none">
      <div className="flex items-center gap-3">
        <BackButton fallback="/routines/rise-reset" />
      </div>

      <div className="text-center space-y-2">
        <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Your Intentions</span>
        <h2 className="text-2xl font-bold text-on-surface">Set your intention</h2>
        <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
          Choose one primary intention to anchor your focus today.
        </p>
      </div>

      {/* Preset List */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {presets.map((preset, idx) => {
          const isSelected = intentions.includes(preset);
          return (
            <button
              key={idx}
              onClick={() => handleSelectPreset(preset)}
              className={`p-4 rounded-2xl border text-xs font-semibold text-center transition-all duration-200 ${
                isSelected
                  ? 'bg-primary-container/20 border-primary text-primary font-bold shadow-md shadow-primary/5'
                  : 'glass-panel border-white/5 text-on-surface-variant hover:bg-white/10'
              }`}
            >
              {preset}
            </button>
          );
        })}
      </div>

      {/* Unified custom input/button control */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl glass-panel border border-white/10 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
        <input
          type="text"
          value={customIntention}
          onChange={(e) => setCustomIntention(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 bg-transparent border-none text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none px-3"
          placeholder="Write your own..."
        />
        <button
          onClick={handleAddCustom}
          disabled={!customIntention.trim()}
          className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container text-xs font-bold uppercase tracking-wider active:scale-95 disabled:opacity-40 transition-all shrink-0"
        >
          Add
        </button>
      </div>

      <div className="space-y-3 w-full">
        <button
          onClick={handleComplete}
          disabled={isSaving}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          <span>{isSaving ? 'Saving...' : 'Continue'}</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button
          onClick={handleComplete}
          disabled={isSaving}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
        >
          Skip this step
        </button>
        <button
          onClick={handleExitRoutine}
          className="w-full text-center text-xs text-on-surface-variant/70 font-semibold hover:text-on-surface-variant transition-colors py-2"
        >
          Exit routine
        </button>
      </div>
    </div>
  );
};
