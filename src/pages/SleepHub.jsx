import { useState } from 'react';
import { useAudio } from '../context/AudioContext';

export const SleepHub = () => {
  const { playTrack } = useAudio();
  const [activeTab, setActiveTab] = useState('library'); // 'library' or 'analytics'

  const soundscapes = [
    {
      title: 'Midnight Rain in Kyoto',
      desc: 'Nature Sounds • 45 min',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      image: 'https://images.unsplash.com/photo-1488034977226-6b29d6be8e46?w=150'
    },
    {
      title: 'Celestial Dreamscape',
      desc: 'Ambient Audio • 30 min',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      image: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=150'
    },
    {
      title: 'The Willow Tree',
      desc: 'Bedtime Story • 25 min',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      image: 'https://images.unsplash.com/photo-1507499739999-097706ad8914?w=150'
    }
  ];

  return (
    <div className="space-y-8">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-headline-lg text-2xl md:text-3xl text-on-surface font-bold tracking-tight">Rest & Recovery</h2>
          <p className="text-on-surface-variant font-body-md max-w-lg mt-1">
            Curated narratives and biometric statistics designed to restore your mental energy.
          </p>
        </div>
        <div className="flex gap-2 bg-surface-container-low p-1.5 rounded-xl border border-white/5 w-fit">
          <button 
            onClick={() => setActiveTab('library')}
            className={`px-4 py-2 rounded-lg font-label-md text-sm transition-all ${
              activeTab === 'library' ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Sleep Library
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg font-label-md text-sm transition-all ${
              activeTab === 'analytics' ? 'bg-primary-container text-on-primary-container font-semibold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Analytics
          </button>
        </div>
      </section>

      {activeTab === 'library' && (
        <div className="space-y-8">
          <div className="relative group overflow-hidden rounded-3xl glass-panel h-80 flex flex-col justify-end p-6 cursor-pointer border-none shadow-xl">
            <div className="absolute inset-0 z-0">
              <img className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60" src="https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=800" alt="Kyoto night" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
            </div>
            <div className="relative z-10 flex justify-between items-end">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider mb-3">LAST PLAYED</span>
                <h4 className="font-headline-md text-2xl text-white font-bold leading-tight">Midnight Rain in Kyoto</h4>
                <p className="text-on-surface-variant text-sm mt-1">Nature Sounds • 45 min</p>
              </div>
              <button 
                onClick={() => playTrack(soundscapes[0])}
                className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined !text-3xl">play_arrow</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-headline-md text-lg text-on-surface mb-4 font-bold">Browse Audio</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {soundscapes.map((track, idx) => (
                <div key={idx} className="glass-panel p-4 rounded-[32px] group cursor-pointer hover:border-primary/40 transition-all duration-300">
                  <div className="relative aspect-[4/3] rounded-[24px] overflow-hidden mb-4 bg-black/10">
                    <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" src={track.image} alt={track.title} />
                    <button 
                      onClick={() => playTrack(track)}
                      className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-primary/80 hover:text-white transition-all shadow-lg"
                    >
                      <span className="material-symbols-outlined">play_arrow</span>
                    </button>
                  </div>
                  <div className="px-2">
                    <h4 className="font-label-md text-sm text-on-surface font-semibold truncate group-hover:text-primary transition-colors">{track.title}</h4>
                    <p className="text-xs text-on-surface-variant mt-1">{track.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 glass-panel rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-headline-md text-lg text-on-surface font-bold">Weekly Quality</h3>
                <p className="text-sm text-on-surface-variant mt-0.5">Average Score: 84%</p>
              </div>
              <span className="material-symbols-outlined text-primary">analytics</span>
            </div>
            <div className="h-48 w-full flex items-end justify-between px-2 gap-3">
              {[75, 60, 95, 80, 45, 85, 90].map((height, idx) => (
                <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end group">
                  <div 
                    className={`w-full rounded-t-lg transition-all duration-500 ${
                      idx === 2 ? 'bg-primary' : 'bg-secondary/40 hover:bg-secondary/60'
                    }`}
                    style={{ height: `${height}%` }}
                  ></div>
                  <span className="mt-4 text-xs text-on-surface-variant font-semibold">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][idx]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 glass-panel rounded-3xl p-6 flex flex-col justify-between items-center text-center">
            <div className="w-full flex justify-between items-center mb-2">
              <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">Efficiency</span>
              <span className="text-xs text-tertiary font-bold">Excellent</span>
            </div>
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" fill="transparent" r="40" stroke="rgba(255,255,255,0.05)" strokeWidth="8"></circle>
                <circle cx="50" cy="50" fill="transparent" r="40" stroke="var(--color-primary)" strokeDasharray="251.2" strokeDashoffset="40" strokeLinecap="round" strokeWidth="8"></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-on-surface">84</span>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold mt-0.5">Points</span>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Your sleep consistency improved by <span className="text-primary font-bold">12%</span> this week.
            </p>
          </div>

          <div className="lg:col-span-12 glass-panel rounded-3xl p-6 space-y-6">
            <h3 className="font-headline-md text-lg text-on-surface font-bold">Sleep Stages</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span>Deep Sleep</span>
                  <span className="text-on-surface-variant">2h 15m (28%)</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: '28%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span>REM</span>
                  <span className="text-on-surface-variant">1h 45m (22%)</span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-secondary" style={{ width: '22%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
