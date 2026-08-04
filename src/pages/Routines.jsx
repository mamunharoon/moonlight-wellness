export const Routines = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="font-headline-lg text-2xl md:text-3xl text-on-surface font-bold tracking-tight">Routines Hub</h2>
        <p className="text-on-surface-variant font-body-md mt-1">
          Simple three-section circadian templates to anchor your daily rituals.
        </p>
      </div>

      <div className="space-y-6">
        {/* Morning Section */}
        <div className="glass-panel p-6 rounded-3xl space-y-4 border-l-4 border-l-primary shadow-[0_8px_30px_rgba(0,0,0,0.03)] bg-gradient-to-br from-[#ffffff]/5 to-transparent">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-primary uppercase font-bold tracking-wider">Morning Awakening</span>
              <h3 className="text-lg font-bold text-on-surface mt-0.5">Rise & Reset</h3>
            </div>
            <span className="text-xs text-on-surface-variant bg-white/5 border border-white/10 px-2 py-1 rounded">5 min</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Curated sequence featuring a gentle morning affirmation, light muscle stretching, and grounding breath.
          </p>
        </div>

        {/* Midday Section */}
        <div className="glass-panel p-6 rounded-3xl space-y-4 border-l-4 border-l-secondary shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-secondary uppercase font-bold tracking-wider">Midday Anchors</span>
              <h3 className="text-lg font-bold text-on-surface mt-0.5">Gentle Reset</h3>
            </div>
            <span className="text-xs text-on-surface-variant bg-white/5 border border-white/10 px-2 py-1 rounded">1 min</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Quick, on-the-spot breathing visualizer to lower heart rate and restore mental clarity during active work.
          </p>
        </div>

        {/* Evening Section */}
        <div className="glass-panel p-6 rounded-3xl space-y-4 border-l-4 border-l-tertiary shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-tertiary uppercase font-bold tracking-wider">Nightrest</span>
              <h3 className="text-lg font-bold text-on-surface mt-0.5">Begin Wind-Down</h3>
            </div>
            <span className="text-xs text-on-surface-variant bg-white/5 border border-white/10 px-2 py-1 rounded">10 min</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Wind down with brief, personal gratitude journal logging, calming breathing loops, and sleep soundscapes.
          </p>
        </div>
      </div>
    </div>
  );
};

