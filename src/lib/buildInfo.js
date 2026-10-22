// DEV build-freshness indicator (2026-10-22) — see DevBuildIndicator.jsx
// for where this renders and why it exists: Vercel's own Deployment
// Protection blocks every HTTP check this project's tooling has tried
// (browser and raw curl alike, including direct requests for a specific
// JS asset) from confirming which commit a DEV deployment is actually
// serving. This module makes the running app answer that question
// itself, with no network call.
//
// __WAKEWISE_BUILD_COMMIT__/__WAKEWISE_BUILD_TIME__ are literal string
// replacements injected by vite.config.js's own `define` at build time —
// not runtime values, and not present in source; every chunk that ends up
// importing this module gets whatever this exact build was produced from,
// baked in. The `typeof` checks are a defensive fallback only (never
// expected to trigger) for the case where `define` somehow didn't apply —
// `typeof` is the one safe way to probe a possibly-undeclared global
// without ESLint's no-undef also needing to allow a bare reference to it.
const rawCommit = typeof __WAKEWISE_BUILD_COMMIT__ === 'string' ? __WAKEWISE_BUILD_COMMIT__ : 'unknown';

export const BUILD_COMMIT_FULL = rawCommit;
export const BUILD_COMMIT = rawCommit === 'unknown' ? rawCommit : rawCommit.slice(0, 7);
export const BUILD_TIME_ISO = typeof __WAKEWISE_BUILD_TIME__ === 'string' ? __WAKEWISE_BUILD_TIME__ : 'unknown';

// Explicit UTC, never the viewer's own local timezone — a build's time
// must read the same no matter who's looking at it. e.g. "2026-10-22 04:05 UTC".
export const BUILD_TIME_LABEL = (() => {
  const parsed = new Date(BUILD_TIME_ISO);
  if (Number.isNaN(parsed.getTime())) return BUILD_TIME_ISO;
  return `${parsed.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
})();

// The one ground-truth signal already present in every build of this app
// (Vercel Preview, Vercel Production, a plain local `vite build`, and the
// Codemagic iOS workflow) — which Supabase project it was compiled
// against. "DEV" here means exactly what this project's own tooling/docs
// already mean by it: pointed at the kvdxuhyndevrfvsalgnx DEV project,
// never the production one. Deliberately not based on Vite's own
// import.meta.env.DEV (true only under a local `vite dev` server, false
// for every built-and-deployed artifact, including this DEV Preview
// deployment itself) or on Vercel's VERCEL_ENV (unset/meaningless for the
// Codemagic iOS workflow, which isn't built on Vercel at all).
const DEV_SUPABASE_HOST = 'kvdxuhyndevrfvsalgnx.supabase.co';

// Pure, exported separately from IS_DEV_BACKEND below so a test can call
// it directly against arbitrary URLs (including the real DEV/production
// values) without needing to control import.meta.env itself.
export const isDevBackendUrl = (supabaseUrl) => (supabaseUrl || '').includes(DEV_SUPABASE_HOST);

export const IS_DEV_BACKEND = isDevBackendUrl(import.meta.env.VITE_SUPABASE_URL);
