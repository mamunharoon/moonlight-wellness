/* eslint-disable no-unused-vars */
import { Link } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { useAuth } from '../context/AuthContext';

export const Profile = () => {
  const { alarmTime, bedTime, intentions } = useAlarm();
  const { user, isGuest, signOut } = useAuth();

  const fullName = [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
    .filter(Boolean)
    .join(' ');
  const displayName = fullName || user?.email;

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <div className="glass-panel p-6 rounded-2xl text-center space-y-3 relative overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-4xl">
            {isGuest ? 'person' : 'account_circle'}
          </span>
        </div>

        {isGuest ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-xl font-extrabold text-on-surface">Guest Profile</h3>
              <p className="text-[10px] text-secondary uppercase font-bold tracking-widest mt-1">Local Mode</p>
            </div>
            <div className="flex gap-2 justify-center">
              <Link
                to="/auth"
                className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
              >
                Sign In
              </Link>
              <Link
                to="/auth"
                className="px-4 py-2 rounded-full glass-panel border border-white/10 text-on-surface text-xs font-bold uppercase tracking-wider hover:bg-white/5 active:scale-95 transition-all"
              >
                Create Account
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <h3 className="text-xl font-extrabold text-on-surface">{displayName}</h3>
              {fullName && (
                <p className="text-[10px] text-on-surface-variant font-semibold mt-1">{user.email}</p>
              )}
            </div>
            <button
              onClick={signOut}
              className="px-4 py-2 rounded-full glass-panel border border-white/10 text-on-surface text-xs font-bold uppercase tracking-wider hover:bg-white/5 active:scale-95 transition-all"
            >
              Sign Out
            </button>
          </div>
        )}

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


