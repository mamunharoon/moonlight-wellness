// WakeWise — Settings → Application, "Environment" row.
//
// Settings.jsx's existing Version/Build number rows are plain marketing
// constants (package.json's committed version, never read at runtime) -
// explicitly documented there as not reflecting which backend a given
// installed build actually talks to, or which native build/commit
// produced it. This module derives a SEPARATE, real-data row instead of
// touching those: the environment label (DEV/PRODUCTION/UNKNOWN, resolved
// directly from the app's own configured Supabase project URL - never
// from a branch name or build number, neither of which says anything
// about which backend a given build actually talks to), the native build
// number (read at runtime from the installed binary's own Info.plist via
// @capacitor/app's getInfo(), never hardcoded), and the source commit
// (buildInfo.js's own BUILD_COMMIT, injected at build time by vite.config.js's
// `define`, same mechanism DevBuildIndicator.jsx already uses).
//
// No key, token, URL, or other credential is ever part of this - every
// value here (DEV/PRODUCTION/UNKNOWN, a plain build integer, a 7-char
// commit prefix) is the same class of non-secret already shown elsewhere
// in this app (DevBuildIndicator.jsx shows the identical commit/time pair
// for a DEV build today) or inspectable from the bundle itself.
//
// DEV_SUPABASE_HOST mirrors buildInfo.js's own private constant of the
// same name - duplicated rather than imported because buildInfo.js
// doesn't export it (and its own IS_DEV_BACKEND is a plain boolean, which
// cannot distinguish "configured for production" from "not configured
// for anything recognised" - the distinction this row exists to show).
const DEV_SUPABASE_HOST = 'kvdxuhyndevrfvsalgnx.supabase.co';
const PRODUCTION_SUPABASE_HOST = 'wqpszprbuqdjcfmdqdlv.supabase.co';

// Pure, exported separately from ENVIRONMENT_LABEL below so a test can
// call it directly against arbitrary URLs without needing to control
// import.meta.env itself.
export const resolveEnvironmentLabel = (supabaseUrl) => {
  const url = supabaseUrl || '';
  if (url.includes(DEV_SUPABASE_HOST)) return 'DEV';
  if (url.includes(PRODUCTION_SUPABASE_HOST)) return 'PRODUCTION';
  return 'UNKNOWN';
};

export const ENVIRONMENT_LABEL = resolveEnvironmentLabel(import.meta.env.VITE_SUPABASE_URL);

export const formatBuildCommitLabel = ({ nativeBuild, commit }) => {
  const parts = [];
  if (nativeBuild) parts.push(`Build ${nativeBuild}`);
  if (commit && commit !== 'unknown') parts.push(commit);
  return parts.join(' · ');
};
