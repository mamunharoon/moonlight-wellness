import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { getBetaVideoById } from '../lib/betaVideoManifest';
import { BetaVideoModal } from '../components/BetaVideoModal';
import { BetaVideoRow } from '../components/BetaVideoRow';
import { supabase } from '../lib/supabaseClient';

// F01-F03: a "Focus Sessions" collection - this page is the app's own
// dedicated focus/intention-setting step ("Set your intention... anchor
// your focus today"), the natural home for Deep Work/Study/Concentration
// content, distinct from A03 "Focus Affirmations" (Affirmation.jsx) and
// E13 "Morning Focus" (MorningStart.jsx).
const FOCUS_SESSION_VIDEOS = [
  { id: 'F01', blurb: 'A guided video to help you settle into deep, focused work.' },
  { id: 'F02', blurb: 'A guided video to help you focus while studying.' },
  { id: 'F03', blurb: 'A guided video to help you sharpen your concentration.' }
];

export const IntentionSetup = () => {
  const navigate = useNavigate();
  const { userId, intentions, setIntentions, setJourneyStep } = useAlarm();
  // Stage 3C Group 3D Batch C: mirrors the intention -> complete transition
  // into the Session Engine. See handleComplete below.
  const { state, currentStep, advanceStep } = useSession();
  const [customIntention, setCustomIntention] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { isGuest } = useAuth();
  const [openVideoId, setOpenVideoId] = useState(null);
  const openVideo = openVideoId ? getBetaVideoById(openVideoId) : null;

  if (BetaVideoModal && BetaVideoRow) { /* no-op to satisfy blind linter */ }

  const presets = [
    'Stay calm',
    'Be grateful',
    'Be patient',
    'Stay focused',
    'Take one step forward',
    'Be kind to yourself'
  ];

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

  const handleComplete = async () => {
    setIsSaving(true);
    setJourneyStep('complete');

    // Stage 3C Group 3D Batch C: mirror only when the engine is genuinely
    // playing at the 'intention' step — a direct-route visit with no
    // active session, or a mismatched mirror, silently does nothing here.
    if (state.status === 'playing' && currentStep?.id === 'intention') {
      advanceStep();
    }

    const primaryIntention = intentions[0] || 'Stay calm';

    if (supabase && userId && intentions.length > 0) {
      try {
        const { error } = await supabase
          .from('user_intentions')
          .upsert(
            {
              user_id: userId,
              intention: primaryIntention
            },
            { onConflict: 'user_id' }
          );

        if (error) {
          // Cloud sync failed - the app continues locally regardless (existing
          // UX never blocks navigation on a Supabase error), so log distinctly
          // to avoid this ever being confused with a successful cloud save.
          console.warn('Intention saved locally only - cloud sync failed:', error.message);
        }
      } catch (e) {
        console.warn('Intention saved locally only - cloud sync skipped:', e.message);
      }
    }

    setIsSaving(false);
    navigate('/session-complete');
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-md mx-auto space-y-8 select-none">
      
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
          className="flex-1 bg-transparent border-none text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none px-3"
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

      {!isGuest && (
        <div className="space-y-3">
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Focus Sessions</h3>
          {FOCUS_SESSION_VIDEOS.map(({ id, blurb }) => {
            const entry = getBetaVideoById(id);
            if (!entry) return null;
            return (
              <BetaVideoRow
                key={id}
                title={entry.title}
                description={blurb}
                onClick={() => setOpenVideoId(id)}
              />
            );
          })}
        </div>
      )}

      <button
        onClick={handleComplete}
        disabled={isSaving}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
      >
        <span>{isSaving ? 'Saving...' : 'Start Your Journey'}</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </button>

      {/* Closing this leaves the user right here on Set Your Intention -
          no navigation needed for a return path. Start Your Journey above
          is entirely unaffected by whether this is open. */}
      {openVideo && (
        <BetaVideoModal entry={openVideo} onClose={() => setOpenVideoId(null)} />
      )}
    </div>
  );
};