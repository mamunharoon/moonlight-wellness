import React from 'react';

export const Journal = () => {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <span className="font-label-md text-xs text-primary uppercase tracking-widest font-bold">Today's Affirmation</span>
        <h2 className="text-2xl md:text-3xl italic font-serif text-primary-fixed-dim leading-snug max-w-3xl">
          "I am a source of calm energy, moving through my day with grace and intentionality."
        </h2>
      </section>

      <section className="glass-panel p-6 md:p-8 rounded-3xl space-y-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary text-2xl">favorite</span>
          <h3 className="font-headline-md text-xl text-on-surface font-bold">Gratitude</h3>
        </div>
        <div className="space-y-4">
          <label className="text-sm text-on-surface-variant font-medium">One thing I am grateful for today...</label>
          <textarea 
            rows="3" 
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-on-surface-variant/40"
            placeholder="The warm sun on my face..."
          ></textarea>
          <button className="w-full bg-primary text-on-primary py-3 rounded-full font-label-md text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all">
            <span>Save to Journal</span>
            <span className="material-symbols-outlined text-sm">send</span>
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-headline-md text-lg text-on-surface font-bold">Recent Reflections</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-panel p-6 rounded-2xl space-y-3 hover:bg-white/10 transition-colors">
            <div className="flex justify-between text-xs text-on-surface-variant/60 font-semibold">
              <span>Yesterday, 8:45 AM</span>
              <span className="material-symbols-outlined text-sm text-secondary">wb_sunny</span>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Grateful for the quiet morning walk and the way the fog settled over the valley. It felt like the world was holding its breath.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl space-y-3 hover:bg-white/10 transition-colors">
            <div className="flex justify-between text-xs text-on-surface-variant/60 font-semibold">
              <span>Monday, Oct 23</span>
              <span className="material-symbols-outlined text-sm text-primary">coffee</span>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Grateful for a perfectly brewed cup of coffee and a deep conversation with an old friend. Connection is vital.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
