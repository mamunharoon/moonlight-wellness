import { useState } from 'react';

export const Vibes = () => {
  const [posts, setAlerts] = useState([
    { id: 1, author: 'Anonymous Sage', text: '"You are doing enough. Even when you\'re just breathing, you are enough. Let the weight slide off your shoulders today."', time: 'Just now', peace: 128, vibeBack: 42, activePeace: false, activeVibe: false },
    { id: 2, author: 'Quiet Wanderer', text: '"May your tea be warm and your mind be quiet. Sending focus to anyone who needs it today."', time: '2 mins ago', peace: 84, vibeBack: 19, activePeace: false, activeVibe: false },
    { id: 3, author: 'Dawn Seeker', text: '"Woke up feeling anxious, but then I saw the light on the leaves. Remember that everything is temporary."', time: '5 mins ago', peace: 110, vibeBack: 34, activePeace: false, activeVibe: false }
  ]);

  const handleAction = (id, type) => {
    setAlerts(posts.map(post => {
      if (post.id === id) {
        if (type === 'peace') {
          return {
            ...post,
            peace: post.activePeace ? post.peace - 1 : post.peace + 1,
            activePeace: !post.activePeace
          };
        } else {
          return {
            ...post,
            vibeBack: post.activeVibe ? post.vibeBack - 1 : post.vibeBack + 1,
            activeVibe: !post.activeVibe
          };
        }
      }
      return post;
    }));
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <h2 className="font-headline-lg text-2xl md:text-3xl text-on-surface font-bold tracking-tight">Community Vibes</h2>
        <p className="text-on-surface-variant font-body-md">
          A gentle stream of collective warmth. Breathe in the support, breathe out the peace.
        </p>
      </div>

      <div className="space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="glass-panel p-6 rounded-3xl space-y-6">
            <div className="flex justify-between items-center text-xs text-on-surface-variant/60 font-semibold">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span> {post.author}
              </span>
              <span>{post.time}</span>
            </div>

            <p className="text-lg md:text-xl text-white font-medium italic leading-relaxed">
              {post.text}
            </p>

            <div className="flex items-center gap-4 pt-4 border-t border-white/5">
              <button 
                onClick={() => handleAction(post.id, 'peace')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  post.activePeace 
                    ? 'bg-primary-container text-on-primary-container border-primary-container/20' 
                    : 'glass-panel text-on-surface-variant hover:bg-white/10'
                }`}
              >
                <span className="material-symbols-outlined text-sm">favorite</span>
                <span>Send Peace ({post.peace})</span>
              </button>

              <button 
                onClick={() => handleAction(post.id, 'vibe')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  post.activeVibe 
                    ? 'bg-secondary-container text-on-secondary-container border-secondary-container/20' 
                    : 'glass-panel text-on-surface-variant hover:bg-white/10'
                }`}
              >
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                <span>Vibe Back ({post.vibeBack})</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full py-4 bg-primary text-on-primary font-semibold rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg">
        <span className="material-symbols-outlined text-sm">add</span> Send a Vibe
      </button>
    </div>
  );
};
