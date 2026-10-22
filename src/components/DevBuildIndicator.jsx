import { BUILD_COMMIT, BUILD_TIME_LABEL, IS_DEV_BACKEND } from '../lib/buildInfo';

// DEV build-freshness indicator (2026-10-22) — added so "which commit is
// actually running" can be confirmed from inside the app itself, rather
// than inferred from Vercel/GitHub APIs that can't see past this
// project's own Deployment Protection gate (see buildInfo.js's own
// comment). Renders only when this exact build was compiled against the
// DEV Supabase backend (IS_DEV_BACKEND) — never in a Production web
// build or a production-backed native build; a real tester/user is never
// shown this. Mounted on the login screen (Auth.jsx) and inside the app
// shell (Layout.jsx) — see each file's own usage for why those two spots.
export const DevBuildIndicator = () => {
  if (!IS_DEV_BACKEND) return null;
  return (
    <div
      className="fixed top-0 left-0 z-[999] pointer-events-none px-2 py-0.5 text-[9px] font-mono tracking-wide text-on-surface-variant/80 bg-background/80 rounded-br-md border-b border-r border-white/10"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      DEV {BUILD_COMMIT} · {BUILD_TIME_LABEL}
    </div>
  );
};
