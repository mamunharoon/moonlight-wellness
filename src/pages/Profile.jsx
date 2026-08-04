import { useAlarm } from '../context/AlarmContext';

export const Profile = () => {
  const { alarmTime, bedTime, intentions } = useAlarm();

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="glass-panel p-6 rounded-2xl text-center space-y-3 relative overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
        <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-primary/20">
          <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAJJIk9TTzx_k9IDSHIWRP-c-nHSpvsuFC349yqoVNF6TBIZDar6-ja8R1OJUx1NyMYRB7G6WaIKRYbkf4-QwfRainB1NbaRfBrPrdJoGOJ91GWwlKVTAqoj1zvOCvRpF2_ZSo3gJWr_AOG7_MxK_iuglzuR4JR_Sv9EcHz6VkCbCyMY2G8rqhewFf4hUlllaiQkc2hAC1GXeT6vowAaz9-ySaepkEAQG-bq6mWz9PPfGdWQJjCMk_V" alt="Alex Rivera" />
        </div>
        <div>
          <h3 className="text-xl font-extrabold text-white">Alex Rivera</h3>
          <p className="text-[10px] text-secondary uppercase font-bold tracking-widest mt-1">Premium Member</p>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2 text-center border-t border-white/5">
          <div>
            <p className="text-lg font-bold text-primary">12</p>
            <p className="text-[9px] text-on-surface-variant uppercase font-semibold">Streak Days</p>
          </div>
          <div>
            <p className="text-lg font-bold text-secondary">42</p>
            <p className="text-[9px] text-on-surface-variant uppercase font-semibold">Vibe Points</p>
          </div>
          <div>
            <p className="text-lg font-bold text-tertiary">8.5h</p>
            <p className="text-[9px] text-on-surface-variant uppercase font-semibold">Avg Sleep</p>
          </div>
        </div>
      </div>

      {/* Daily Rhythm Settings Group */}
      <div className="glass-panel p-5 rounded-2xl space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <h4 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Daily Rhythm</h4>
        
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="flex gap-3 items-center">
            <span className="material-symbols-outlined text-primary text-xl">wb_sunny</span>
            <span className="text-sm font-semibold">Wake-up Time ({alarmTime})</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="flex gap-3 items-center">
            <span className="material-symbols-outlined text-secondary text-xl">bedtime</span>
            <span className="text-sm font-semibold">Bedtime ({bedTime})</span>
          </div>
        </div>
      </div>

      {/* Personalization Section */}
      <div className="glass-panel p-5 rounded-2xl space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <h4 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">Personalization</h4>
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="flex gap-3 items-center">
            <span className="material-symbols-outlined text-tertiary text-xl">spa</span>
            <span className="text-sm font-semibold">Intentions ({intentions.join(', ')})</span>
          </div>
        </div>
      </div>
    </div>
  );
};


