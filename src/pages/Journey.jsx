import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAlarm } from '../context/AlarmContext';

export const Journey = () => {
  const { userId, intentions } = useAlarm();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJournal = async () => {
      if (!supabase || !userId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!error && data) {
        setEntries(data);
      }
      setLoading(false);
    };

    fetchJournal();
  }, [userId]);

  const formatDate = (dateString) => {
    const options = { month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

    return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="font-headline-lg text-2xl md:text-3xl text-on-surface font-bold tracking-tight">Your Journey</h2>
        <p className="text-on-surface-variant font-body-md mt-1">
          Honest tracking of your sleep, intentions, and reflections.
        </p>
      </div>

            {/* Recent Intentions */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Active Intentions</h3>
        <div className="flex flex-wrap gap-2">
          {intentions.map((intent, idx) => (
            <span key={idx} className="bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full text-xs font-semibold">
              {intent}
            </span>
          ))}
        </div>
      </div>

      {/* Recent Gratitude List */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Your Reflections</h3>
        <div className="space-y-3">
          {loading ? (
            <p className="text-xs text-on-surface-variant/40 italic">Loading entries...</p>
          ) : entries.length > 0 ? (
            entries.map((entry) => (
              <div key={entry.id} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
                <div className="flex justify-between text-[10px] text-on-surface-variant/60 font-semibold">
                  <span>{formatDate(entry.created_at)}</span>
                  <span>Gratitude</span>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {entry.body}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-on-surface-variant/40 italic">Not started yet. Complete your first evening reflection to build your logs.</p>
          )}
        </div>
      </div>
    </div>
  );
};

