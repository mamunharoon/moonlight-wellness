import React from 'react';

export const Gallery = () => {
  const badges = [
    { title: 'Morning Dew', desc: '30 consecutive morning meditations completed.', icon: 'spa', unlocked: true, color: 'bg-primary/10 text-primary border-primary/20' },
    { title: 'Mental Clarity', desc: 'Resolved 10 high-stress tags in personal journal.', icon: 'cloud', unlocked: true, color: 'bg-secondary/10 text-secondary border-secondary/20' },
    { title: 'Deep Rooted', desc: 'Total of 100 hours spent in mindful focus.', icon: 'energy_savings_leaf', unlocked: true, color: 'bg-tertiary/10 text-tertiary border-tertiary/20' },
    { title: 'Starlight Guide', desc: 'Completed the full 7-day Advanced Sleep Course.', icon: 'auto_awesome', unlocked: false, color: 'bg-white/5 text-on-surface-variant' }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline-lg text-2xl md:text-3xl text-primary font-bold tracking-tight">Zen Master Gallery</h2>
        <p className="text-on-surface-variant font-body-md max-w-lg mt-1">
          Your journey through stillness, recorded in milestones. Complete activities to unlock achievements.
        </p>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {badges.map((badge, idx) => (
          <div 
            key={idx} 
            className={`glass-panel p-6 rounded-3xl flex flex-col items-center text-center transition-all duration-300 ${
              badge.unlocked ? 'hover:bg-white/10' : 'opacity-50'
            }`}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center border mb-4 ${badge.color}`}>
              <span className="material-symbols-outlined text-3xl">
                {badge.unlocked ? badge.icon : 'lock'}
              </span>
            </div>
            <h4 className="font-label-md text-sm text-on-surface font-bold mb-1">{badge.title}</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">{badge.desc}</p>
          </div>
        ))}
      </div>

      {/* Insights */}
      <section className="glass-panel p-6 rounded-3xl space-y-4 border-primary/20">
        <h3 className="font-headline-md text-lg text-on-surface font-bold">Recent Insights</h3>
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex gap-4">
            <span className="material-symbols-outlined text-primary">lightbulb</span>
            <div>
              <p className="text-xs text-primary font-bold uppercase tracking-wider">Circadian Pattern</p>
              <p className="text-sm text-on-surface mt-1">Circadian alignment indicates peak relaxation peaks between 7am and 9am.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
