import { useState } from 'react';

export const WindDown = () => {
  const [routines, setRoutines] = useState([
    { id: 'breath', title: '3-min Breathing', desc: 'Guided respiration exercises', duration: '03:00', active: true, icon: 'air', color: 'bg-primary-container/20 text-primary-container' },
    { id: 'journal', title: 'Grateful Journaling', desc: 'Write down three positive things', duration: '05:00', active: true, icon: 'edit_note', color: 'bg-tertiary-container/20 text-tertiary-container' },
    { id: 'sounds', title: 'Rain Sounds', desc: 'Ambient sleep soundscapes', duration: 'Infinity', active: true, icon: 'water_drop', color: 'bg-secondary-container/20 text-secondary-container' },
    { id: 'read', title: 'Light Reading', desc: 'Physical book focus', duration: '15:00', active: false, icon: 'auto_stories', color: 'bg-white/10 text-on-surface-variant' }
  ]);

  const toggleActive = (id) => {
    setRoutines(routines.map(item => {
      if (item.id === id) {
        return { ...item, active: !item.active };
      }
      return item;
    }));
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h2 className="font-headline-lg text-2xl md:text-3xl text-on-surface font-bold tracking-tight">Wind Down</h2>
        <p className="text-on-surface-variant font-body-md mt-1">
          Design your perfect transition to rest. Toggle routines to customize your evening flow.
        </p>
      </div>

      <div className="space-y-4">
        {routines.map((item) => (
          <div 
            key={item.id}
            className={`glass-panel p-4 rounded-2xl flex items-center justify-between transition-all duration-300 ${
              item.active ? 'opacity-100 border-primary/20' : 'opacity-40 border-transparent'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.color}`}>
                <span className="material-symbols-outlined text-2xl">{item.icon}</span>
              </div>
              <div>
                <h3 className="font-label-md text-sm text-on-surface font-bold">{item.title}</h3>
                <p className="text-xs text-on-surface-variant">{item.desc}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-on-surface-variant/60 font-semibold">{item.duration}</span>
              <button 
                onClick={() => toggleActive(item.id)}
                className={`w-12 h-6 rounded-full relative transition-all duration-300 ${
                  item.active ? 'bg-primary-container' : 'bg-white/10'
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${
                  item.active ? 'translate-x-6' : 'translate-x-1'
                }`}></div>
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-6 py-4 border-2 border-dashed border-white/10 rounded-2xl text-xs font-semibold text-on-surface-variant hover:bg-white/5 transition-all flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-sm">add</span> Add Custom Task
      </button>
    </div>
  );
};
