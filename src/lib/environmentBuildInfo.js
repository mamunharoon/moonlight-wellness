// WakeWise — Settings → Application, "Environment" row.
//
// Settings.jsx's existing Version/Build number rows are plain marketing
// constants (package.json's committed version, never read at runtime) -
// explicitly documented there as not reflecting which backend a given
// installed build actually talks to, or which native build/commit
// produced it. This module derives a SEPARATE, real-data row instead of
// touching those: environment (DEV/PRODUCTION, from buildInfo.js's own
// already-established IS_DEV_BACKEND), the native build number (read at
// runtime from the installed binary's own Info.plist via
// @capacitor/app's getInfo(), never hardcoded), and the source commit
// (buildInfo.js's own BUILD_COMMIT, injected at build time by vite.config.js's
// `define`, same mechanism DevBuildIndicator.jsx already uses).
//
// No key, token, URL, or other credential is ever part of this - every
// value here (DEV/PRODUCTION, a plain build integer, a 7-char commit
// prefix) is the same class of non-secret already shown elsewhere in
// this app (DevBuildIndicator.jsx shows the identical commit/time pair
// for a DEV build today) or inspectable from the bundle itself.
export const formatEnvironmentBuildLabel = ({ isDevBackend, nativeBuild, commit }) => {
  const envLabel = isDevBackend ? 'DEV' : 'PRODUCTION';
  const parts = [envLabel];
  if (nativeBuild) parts.push(`Build ${nativeBuild}`);
  if (commit && commit !== 'unknown') parts.push(commit);
  return parts.join(' · ');
};
