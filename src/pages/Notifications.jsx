import { useState } from 'react';

export const Notifications = () => {
  const [alerts, setAlerts] = useState([
    { id: 1, title: 'Time for Mindful Breathing', body: 'The evening is settling in. Take 3 minutes for a guided box-breathing session.', time: '2m ago', read: false, icon: 'air', color: 'bg-primary/10 text-primary' },
    { id: 2, title: 'Community Response', body: 'Sarah and 4 others liked your recent vibe entry \"Midnight Reflections\".', time: '1h ago', read: false, icon: 'favorite', color: 'bg-secondary/10 text-secondary' },
    { id: 3, title: 'Streak Milestone Unlocked', body: '7-Day Serenity Streak achieved! Your consistency has been noted.', time: 'Yesterday', read: true, icon: 'workspace_premium', color: 'bg-tertiary/10 text-tertiary' }
  ]);

  const markAllRead = () => {
    setAlerts(alerts.map(item => ({ ...item, read: true })));
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-2xl md:text-3xl text-on-surface font-bold tracking-tight">Notifications</h2>
          <p className="text-on-surface-variant font-body-md mt-1">
            Stay updated with your wellness milestones and Serenity Circle community.
          </p>
        </div>
        <button 
          onClick={markAllRead}
          className="px-4 py-2 rounded-xl font-label-md text-xs text-on-surface-variant glass-panel hover:bg-white/10 transition-all font-semibold flex items-center gap-2 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-sm">done_all</span> Mark all as read
        </button>
      </div>

      <div className="space-y-3">
        {alerts.map((item) => (
          <div 
            key={item.id}
            className={`glass-panel p-5 rounded-2xl flex gap-4 transition-all ${
              item.read ? 'opacity-60 hover:opacity-100 border-transparent' : 'opacity-100 border-primary/20 shadow-md'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
              <span className="material-symbols-outlined text-2xl">{item.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2 mb-1">
                <h4 className="font-label-md text-sm text-on-surface font-bold truncate">{item.title}</h4>
                <span className="text-xs text-on-surface-variant whitespace-nowrap">{item.time}</span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
