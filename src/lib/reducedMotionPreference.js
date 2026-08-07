// Settings & Profile Polish, Sprint 1: manual "Reduced motion" override.
//
// Independent of (and additive to) the OS-level `prefers-reduced-motion`
// media query AtmosphereManager already honors — this lets a user force
// reduced motion app-wide even when their OS setting doesn't request it.
// When unset, behavior is unchanged: pure OS detection, exactly as before
// this file existed.

const REDUCED_MOTION_KEY = 'moonlight_reduced_motion';

export const getReducedMotionPreference = () => {
  try {
    return localStorage.getItem(REDUCED_MOTION_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setReducedMotionPreference = (enabled) => {
  try {
    localStorage.setItem(REDUCED_MOTION_KEY, enabled ? 'true' : 'false');
  } catch {
    // localStorage unavailable - the toggle simply won't persist this session.
  }
};
