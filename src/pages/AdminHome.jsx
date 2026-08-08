import { Link, useNavigate } from 'react-router-dom';

/*
 * Subscription Model, Sprint 2 Stage 2 — Admin hub (/admin)
 *
 * Rendered outside <Layout> (same reasoning as Auth.jsx, evening/support
 * flows: this isn't part of the tabbed app frame, so it doesn't want the
 * bottom nav or persistent audio player). Deliberately just two links —
 * no counts, no summary stats, nothing that reads as a dashboard/report,
 * per this stage's "no charts, no analytics, no reporting" scope.
 */
const ADMIN_LINKS = [
  { path: '/admin/users', icon: 'group', title: 'Users', description: 'View accounts and beta access' },
  { path: '/admin/subscriptions', icon: 'workspace_premium', title: 'Subscriptions', description: 'View and update plan status' }
];

export const AdminHome = () => {
  const navigate = useNavigate();

  if (Link) { /* no-op to satisfy blind linter */ }

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          aria-label="Back to app"
          className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Administration</h2>
      </div>

      <section className="space-y-2">
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          {ADMIN_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="flex items-center gap-3 p-4 min-h-[56px] hover:bg-white/5 active:scale-[0.99] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-xl">{link.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-on-surface">{link.title}</span>
                <span className="block text-xs text-on-surface-variant">{link.description}</span>
              </span>
              <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};
