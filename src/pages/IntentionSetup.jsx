import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { ProgressIndicator } from '../components/ProgressIndicator';
import { supabase } from '../lib/supabaseClient';

export const IntentionSetup = () => {
  const navigate = useNavigate();
  const { userId, intentions, setIntentions, setJourneyStep } = useAlarm();
  const [customIntention, setCustomIntention] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (ProgressIndicator) { /* no-op to satisfy blind linter */ }

  const presets = [
    'Stay calm',
    'Be grateful',
    'Be patient',
    'Stay focused',
    'Take one step forward',
    'Be kind to yourself'
  ];

  const handleSelectPreset = (preset) => {
    if (intentions.includes(preset)) {
      setIntentions(intentions.filter(item => item !== preset));
    } else {
      setIntentions([preset]); // Keep it focused on selecting one primary intention
    }
  };

  const handleAddCustom = () => {
    if (!customIntention.trim()) return;
    setIntentions([customIntention.trim()]);
    setCustomIntention('');
  };

  const handleComplete = async () => {
    setIsSaving(true);
    setJourneyStep('complete');

    if (supabase && userId && intentions.length > 0) {
      // Clear old active entries and insert new primary intention
      await supabase
        .from('user_intentions')
        .delete()
        .eq('user_id', userId);

      const inserts = intentions.map(intent => ({
        user_id: userId,
        intention: intent
      }));

      await supabase
        .from('user_intentions')
        .insert(inserts);
    }

    setIsSaving(false);
    navigate('/session-complete');
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-8 select-none">
      <ProgressIndicator activeStep="intention" />

      <div className="text-center space-y-2">
        <span className="font-label-sm text-xs text-primary uppercase tracking-widest font-bold">Your Intentions</span>
        <h2 className="text-2xl font-bold text-on-surface">Set your intentions</h2>
        <p className="text-xs text-on-surface-variant max-w-sm mx-auto leading-relaxed">
          Choose the primary area you would like to focus on today. We'll adjust your daily rhythm to match.
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
              className={`p-4 rounded-2xl border text-xs font-semibold text-center transition-all ${
                isSelected 
                  ? 'bg-primary-container/30 border-primary text-primary font-bold shadow-md shadow-primary/5' 
                  : 'glass-panel border-white/5 text-on-surface-variant hover:bg-white/10'
              }`}
            >
              {preset}
            </button>
          );
        })}
      </div>

      {/* Custom Intention Creator */}
      <div className="glass-panel p-4 rounded-2xl w-full flex items-center gap-2">
        <input 
          type="text"
          value={customIntention}
          onChange={(e) => setCustomIntention(e.target.value)}
          className="flex-1 bg-transparent border-none text-xs text-white placeholder:text-on-surface-variant/40 outline-none"
          placeholder="Add custom intention..."
        />
        <button 
          onClick={handleAddCustom}
          className="px-3 py-1.5 rounded-lg bg-primary-container text-on-primary-container text-[10px] font-bold uppercase tracking-wider active:scale-95"
        >
          Add
        </button>
      </div>

      <button 
        onClick={handleComplete}
        disabled={isSaving || intentions.length === 0}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-40"
      >
        <span>{isSaving ? 'Saving...' : 'Start Your Journey'}</span>
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </button>
    </div>
  );
};
