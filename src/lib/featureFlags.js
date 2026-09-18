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
  releaseNotes: true,
  // Background Music, Phase B — defaults OFF, independent of the user's
  // own saved musicPreference.js choice (see docs/background-music-
  // specification.md and backgroundMusicSelection.js). No licensed
  // pre-mixed music asset exists yet for any exercise, so the in-player
  // "Music" toggle must never render for a real user regardless of this
  // flag — this flag exists purely so QA can verify the toggle's own UI
  // once a manifest entry gains a real musicVariantId, without a code
  // deploy, via setFeatureFlagOverride('backgroundMusic', true) in the
  // console.
  backgroundMusic: false
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

// iOS DEV remediation phase — build-time (not per-device) flag: whether
// the Beta Program section (Settings -> Beta Program: Beta Program hub,
// Send Feedback, Release Notes) is shown at all. Deliberately separate
// from the per-device override system above (that system is for QA
// toggling a shipped flag's default per-device; this one decides what
// ships in the first place, per build). Every WakeWise build today -
// local dev, the DEV Vercel preview, and every TestFlight build via
// codemagic.yaml - is meant to keep this visible, since testers need it.
// There is deliberately no separate "production" Codemagic workflow yet
// (see docs/codemagic-setup-guide.md - this repo has exactly one
// workflow, wakewise-ios-testflight), so this flag defaults to visible
// (true) whenever it's unset, rather than requiring every existing build
// config to be touched just to keep today's behaviour unchanged.
//
// TO HIDE THE BETA PROGRAM FOR THE EVENTUAL PUBLIC PRODUCTION BUILD:
// set VITE_SHOW_BETA_PROGRAM=false wherever that future build's
// environment variables are configured (a new Codemagic workflow's own
// environment.vars, or a production .env file) - no code change needed.
// Vite only ever exposes env vars prefixed VITE_ to client code (see
// subscriptionOverride.js's own comment on this exact footgun), and only
// as strings, so the comparison below is against the literal string
// 'false', not the boolean.
export const isBetaProgramVisible = () => import.meta.env.VITE_SHOW_BETA_PROGRAM !== 'false';
