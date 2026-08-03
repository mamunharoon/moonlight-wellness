import React from 'react';

export const Journey = () => {
  return (
    <div className="space-y-8">
      <section className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-center gap-6">
        <div className="w-20 h-20 rounded-full border-4 border-primary-container overflow-hidden shadow-lg shrink-0">
          <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDoA6YmDT6ekyBDifNMl4VA6HwcKCXFEgJuwIDlX3ymAgBSsriUwdSUY4wtYOwNj_wjgF4zGMYzISqxJS0D2JTtbUXaEaTVLxUfgg1q_FgPl8Cub7ZTo9CwgvQrDX2XuVXqcrwMCRZvFxgaEBpiTk9mHb4Gpm4CHoTt-EwnN5rrR0t0AjiuchV0upvtHTdFyKOXzo85-XK0nvavS71v8lWfbtOtRXBKGaXN6zWrLzwMnJYce7rNr0AE" alt="Maya Sterling" />
        </div>
        <div className="text-center md:text-left space-y-1">
          <h2 className="text-2xl font-bold">Maya Sterling</h2>
          <div className="flex flex-wrap gap-2 items-center justify-center md:justify-start">
            <span className="bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full text-xs font-semibold">
              Zen Master Level 12
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-4 glass-panel p-6 rounded-2xl flex flex-col justify-between h-48">
          <div className="flex justify-between items-start">
            <span className="material-symbols-outlined text-primary text-3xl">timer</span>
            <span className="text-xs text-tertiary font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">trending_up</span> +12%
            </span>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-semibold">Mindful Minutes</p>
            <h3 className="text-3xl font-extrabold text-primary mt-1">320</h3>
          </div>
        </div>

        <div className="md:col-span-8 glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-on-surface-variant font-semibold">Average Calmness</p>
              <h3 className="text-2xl font-bold text-secondary mt-0.5">84 %</h3>
            </div>
            <span className="text-xs text-on-surface-variant">Weekly Overview</span>
          </div>
          <div className="flex items-end gap-3 h-24 pt-2">
            {[60, 45, 84, 70, 90, 55, 65].map((val, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                <div 
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    idx === 2 ? 'bg-secondary' : 'bg-surface-container-highest hover:bg-secondary/40'
                  }`}
                  style={{ height: `${val}%` }}
                ></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="glass-panel p-6 rounded-2xl space-y-6">
        <h4 className="font-headline-md text-lg text-on-surface font-bold">Activity Breakdown</h4>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span>Breathing</span>
              <span className="text-primary">65%</span>
            </div>
            <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: '65%' }}></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold mb-1.5">
              <span>Journaling</span>
              <span className="text-tertiary">35%</span>
            </div>
            <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-tertiary" style={{ width: '35%' }}></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
