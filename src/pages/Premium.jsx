export const Premium = () => {
  return (
    <div className="space-y-6 py-4">
      {/* Header Panel */}
      <div className="text-center space-y-3 py-6">
        <span className="inline-flex items-center px-4 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
          Solas Plus
        </span>
        <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">Unlock Your Full Potential</h2>
        <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
          Step into a world of deeper rest and elevated focus with our most exclusive wellness tools.
        </p>
      </div>

      {/* Feature List */}
      <div className="space-y-3">
        {[
          { title: 'Advanced Sleep Analytics', desc: 'Deep-dive into your REM cycles and sleep hygiene.', icon: 'analytics', color: 'bg-primary/15 text-primary' },
          { title: 'Full Sensory Toolkit', desc: 'Immersive guided meditations with haptic feedback.', icon: 'handyman', color: 'bg-secondary/15 text-secondary' },
          { title: 'Exclusive Nature Soundscapes', desc: "4K spatial audio recorded in the world's quietest places.", icon: 'waves', color: 'bg-tertiary/15 text-tertiary' }
        ].map((feat, idx) => (
          <div key={idx} className="glass-panel p-4 rounded-2xl flex gap-4 border-transparent hover:border-white/5 transition-all">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${feat.color}`}>
              <span className="material-symbols-outlined text-2xl">{feat.icon}</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">{feat.title}</h4>
              <p className="text-xs text-on-surface-variant mt-0.5">{feat.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Checkout Area */}
      <div className="glass-panel p-6 rounded-3xl text-center space-y-4">
        <div className="flex items-baseline justify-center gap-1.5">
          <span className="text-4xl font-extrabold text-white tracking-tighter">$9.99</span>
          <span className="text-sm text-on-surface-variant">/ month</span>
        </div>
        <button className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20">
          Upgrade Now
        </button>
        <p className="text-[10px] text-on-surface-variant/40 leading-relaxed">
          Subscription automatically renews unless cancelled in app settings. By upgrading, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

