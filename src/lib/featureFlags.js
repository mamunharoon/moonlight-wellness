// WakeWise — Closed Beta Preparation, Phase A — feature flags.
//
// A small, local-only flag system: each flag has a default (what ships
// to every beta tester) and can be overridden per-device via
// localStorage for QA — e.g. testing what the app looks like with a
// flag off, without needing a build step or a real remote flag service.
// No backend involved by design — this phase explicitly prefers local
// storage over new infrastructure.

const OVERRIDES_KEY = 'wakewise_feature_flag_overrides';

// One flag per closed-beta surface this phase adds — lets any of them
// be pulled instantly (set to false) without deploying a code change,
// if something needs to be hidden mid-beta.
export const FEATURE_FLAGS = {
  notifications: true,
  feedback: true,
  betaChecklist: true,
  releaseNotes: true
};

const readOverrides = () => {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const isFeatureEnabled = (key) => {
  const overrides = readOverrides();
  if (Object.prototype.hasOwnProperty.call(overrides, key)) {
    return Boolean(overrides[key]);
  }
  return Boolean(FEATURE_FLAGS[key]);
};

// QA-only: force a flag on/off on this device. Not exposed in any
// production UI this phase — intended for use from the browser console
// during beta testing (e.g. setFeatureFlagOverride('notifications', false)).
export const setFeatureFlagOverride = (key, enabled) => {
  try {
    const overrides = readOverrides();
    overrides[key] = enabled;
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // localStorage unavailable — override simply won't persist.
  }
};

export const clearFeatureFlagOverrides = () => {
  try {
    localStorage.removeItem(OVERRIDES_KEY);
  } catch {
    // no-op
  }
};
