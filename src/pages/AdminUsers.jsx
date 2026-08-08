import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAdminUsers, setBetaAccess } from '../lib/adminApi';

/*
 * Subscription Model, Sprint 2 Stage 2 — Users view (/admin/users)
 *
 * Fields per the stage brief: display name, email, account type, beta
 * access status. "Account type" is Administrator/Standard, derived from
 * is_admin — profiles only ever holds registered accounts (see
 * admin_list_users()'s own comment), so there is no separate guest row
 * to label here. Beta access is the one editable field on this screen
 * (capabilities 5/6 — enable/disable beta access); admin_set_beta_access
 * is the only write path, enforced server-side regardless of this UI.
 */
const displayName = (row) => {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return name || 'Unnamed user';
};

export const AdminUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (e) {
      console.error('Error loading admin users:', e.message);
      setError("We couldn't load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      await loadUsers();
    };
    load();
  }, []);

  const handleToggleBeta = async (row) => {
    setPendingId(row.id);
    const nextValue = !row.beta_access;
    try {
      await setBetaAccess(row.id, nextValue);
      setUsers((prev) => prev.map((u) => (u.id === row.id ? { ...u, beta_access: nextValue } : u)));
    } catch (e) {
      console.error('Error updating beta access:', e.message);
      setError("We couldn't update beta access. Please try again.");
    } finally {
      setPendingId(null);
    }
  };

  const rowClass = 'flex items-center justify-between gap-3 p-4 min-h-[56px]';

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin')}
          aria-label="Back to Administration"
          className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Users</h2>
      </div>

      {error && (
        <p role="alert" className="text-[10px] text-red-400 font-medium px-1">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-on-surface-variant px-1">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-on-surface-variant px-1">No users found.</p>
      ) : (
        <section className="space-y-2">
          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            {users.map((row) => (
              <div key={row.id} className={rowClass}>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-on-surface truncate">{displayName(row)}</span>
                  <span className="block text-xs text-on-surface-variant truncate">{row.email}</span>
                  <span className="block text-[10px] uppercase tracking-wider font-bold text-on-surface-variant/70 mt-0.5">
                    {row.is_admin ? 'Administrator' : 'Standard'}
                  </span>
                </span>
                <button
                  role="switch"
                  aria-checked={row.beta_access}
                  aria-label={`Beta access for ${row.email}`}
                  disabled={pendingId === row.id}
                  onClick={() => handleToggleBeta(row)}
                  className={`w-12 h-7 rounded-full transition-colors relative shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-50 ${
                    row.beta_access ? 'bg-primary' : 'bg-white/10'
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                      row.beta_access ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
