import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAlarm } from '../context/AlarmContext';

export const Journal = () => {
  const { userId } = useAlarm();
  const [gratitudeText, setGratitudeText] = useState('');
  const [entries, setEntries] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch entries from Supabase
  const fetchEntries = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching journal:', error.message);
      return;
    }
    setEntries(data || []);
  };

  useEffect(() => {
    fetchEntries();
  }, [userId]);

  // Handle saving entries to Supabase
  const handleSave = async () => {
    if (!userId || !gratitudeText.trim()) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: userId,
        body: gratitudeText.trim()
      });

    setIsSaving(false);
    if (error) {
      console.error('Error saving entry:', error.message);
      return;
    }

    setGratitudeText('');
    fetchEntries(); // Refresh history list
  };

  const formatDate = (dateString) => {
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <span className="font-label-md text-xs text-primary uppercase tracking-widest font-bold">Today's Affirmation</span>
        <h2 className="text-2xl md:text-3xl italic font-serif text-primary-fixed-dim leading-snug max-w-3xl">
          "I am a source of calm energy, moving through my day with grace and intentionality."
        </h2>
      </section>

      {/* Gratitude Input Card */}
      <section className="glass-panel p-6 md:p-8 rounded-3xl space-y-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary text-2xl">favorite</span>
          <h3 className="font-headline-md text-xl text-on-surface font-bold">Gratitude</h3>
        </div>
        <div className="space-y-4">
          <label className="text-sm text-on-surface-variant font-medium">One thing I am grateful for today...</label>
          <textarea 
            rows="3" 
            value={gratitudeText}
            onChange={(e) => setGratitudeText(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-on-surface-variant/40 outline-none"
            placeholder="The warm sun on my face..."
            disabled={isSaving}
          ></textarea>
          <button 
            onClick={handleSave}
            disabled={isSaving || !gratitudeText.trim()}
            className="w-full bg-primary text-on-primary py-3 rounded-full font-label-md text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-40"
          >
            <span>{isSaving ? 'Saving...' : 'Save to Journal'}</span>
            <span className="material-symbols-outlined text-sm">send</span>
          </button>
        </div>
      </section>

      {/* Past Entries */}
      <section className="space-y-4">
        <h3 className="font-headline-md text-lg text-on-surface font-bold">Recent Reflections</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entries.length > 0 ? (
            entries.map((entry) => (
              <div key={entry.id} className="glass-panel p-6 rounded-2xl space-y-3 hover:bg-white/10 transition-colors">
                <div className="flex justify-between text-xs text-on-surface-variant/60 font-semibold">
                  <span>{formatDate(entry.created_at)}</span>
                  <span className="material-symbols-outlined text-sm text-secondary">favorite</span>
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {entry.body}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-on-surface-variant/40 italic p-4">No recent entries found. Save your first reflection above.</p>
          )}
        </div>
      </section>
    </div>
  );
};