


export const Landing = () => {
  return (
    <div className="space-y-16 max-w-4xl mx-auto py-8">
      
      {/* Hero Banner */}
      <section className="text-center space-y-6 py-12 relative overflow-hidden">
        <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wider uppercase">
          Discover Your Natural Rhythm
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold text-on-surface leading-tight tracking-tight">
          Align your daily rituals with the <br />
          <span className="text-primary italic">rhythm of nature.</span>
        </h1>
        <p className="text-on-surface-variant max-w-xl mx-auto text-sm leading-relaxed">
          Solas guides you through a seamless cycle of rejuvenationâ€”from the softest dawn to the deepest midnight.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <Link to="/" className="bg-primary text-on-primary font-label-md px-8 py-3.5 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20 font-bold">
            Start Your Journey
          </Link>
          <button className="glass-panel text-on-surface-variant font-label-md px-8 py-3.5 rounded-xl hover:bg-white/10 active:scale-95 transition-all font-semibold">
            Watch the Film
          </button>
        </div>
      </section>

      {/* Landscape Parallax Frame */}
      <div className="relative h-64 md:h-96 rounded-3xl overflow-hidden glass-panel border-none shadow-xl">
        <img className="w-full h-full object-cover opacity-80" src="https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=1200" alt="Mountain Dawn" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
      </div>

      {/* Cycle of Care */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold">A Cycle of Care</h2>
          <p className="text-sm text-on-surface-variant">Three pillars for a balanced existence.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-2xl space-y-4 hover:border-primary/20 transition-all">
            <span className="material-symbols-outlined text-primary text-3xl">wb_twilight</span>
            <h3 className="font-headline-md text-lg text-white font-bold">Wake Up Gently</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Replace jarring alarms with light-synced haptics and ambient soundscapes that mirror the dawn.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl space-y-4 hover:border-secondary/20 transition-all">
            <span className="material-symbols-outlined text-secondary text-3xl">schedule</span>
            <h3 className="font-headline-md text-lg text-white font-bold">Daily Focus</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Stay present with mindful breaks that align with your body's natural energy peaks.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl space-y-4 hover:border-tertiary/20 transition-all">
            <span className="material-symbols-outlined text-tertiary text-3xl">bedtime</span>
            <h3 className="font-headline-md text-lg text-white font-bold">Deep Rest</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Wind down with lunar-synced sleep cycles and guided restorative meditations.
            </p>
          </div>
        </div>
      </section>

      {/* Conversion Banner */}
      <section className="glass-panel rounded-3xl p-8 md:p-12 text-center space-y-6 relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="relative z-10 max-w-xl mx-auto space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold">Ready to breathe deeper?</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Join 500,000+ souls who have rediscovered their connection to the earth's natural cycles. It's time to stop surviving and start thriving.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
            <button className="bg-primary text-on-primary font-semibold px-6 py-3 rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-sm">download</span> Download for iOS
            </button>
            <button className="glass-panel text-on-surface-variant font-semibold px-6 py-3 rounded-xl hover:bg-white/10 active:scale-95 transition-all">
              View Roadmap
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

