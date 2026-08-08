// WakeWise — Closed Beta Preparation, Phase A — analytics event catalogue.
//
// This is a CATALOGUE first: the definitive list of events this app
// should eventually track, with a description and expected properties
// for each — useful on its own for planning, even before any events
// fire for real.
//
// trackEvent() itself is intentionally a local no-op-plus-log: no
// third-party analytics provider (PostHog, Amplitude, GA, etc.) is
// wired into this project, and choosing/adding one is a real,
// consequential integration decision this phase doesn't make
// unilaterally. Events are logged to the console and kept in a capped
// local debug buffer so they're visible during beta QA; nothing leaves
// the device. Swapping in a real provider later means replacing the
// body of trackEvent() only — every call site already exists.
//
// EVENT_CATALOGUE marks which events are actually wired (fired from
// real code this phase touches) vs. planned (documented here as the
// target shape, but not fired — firing them would mean instrumenting
// session/flow logic, which this phase's own rules keep off-limits).

export const EVENT_CATALOGUE = {
  // --- Wired this phase ---
  feedback_submitted: {
    description: 'A feedback entry was sent via the in-app feedback form.',
    properties: ['category'],
    status: 'wired'
  },
  beta_checklist_item_toggled: {
    description: 'A closed-beta onboarding checklist item was checked or unchecked.',
    properties: ['itemId', 'completed'],
    status: 'wired'
  },
  notification_preferences_updated: {
    description: 'Any notification preference (enabled state, time, frequency, weekdays, quiet hours, snooze) changed.',
    properties: ['field'],
    status: 'wired'
  },
  notification_permission_requested: {
    description: 'The user was prompted for (or responded to) the browser notification permission.',
    properties: ['result'],
    status: 'wired'
  },
  audio_playback_toggled: {
    description: 'The placeholder play/pause control on an audio session was pressed (see AudioPlayerPlaceholder.jsx — no real audio plays yet).',
    properties: ['entryId', 'category', 'action'],
    status: 'wired'
  },

  // --- Planned (catalogued, not yet instrumented — would require
  //     touching session/flow logic this phase does not modify) ---
  onboarding_completed: {
    description: 'A user finishes the onboarding rhythm-setup flow.',
    properties: [],
    status: 'planned'
  },
  morning_flow_started: {
    description: 'A user begins their morning routine.',
    properties: [],
    status: 'planned'
  },
  morning_flow_completed: {
    description: 'A user completes their morning routine.',
    properties: [],
    status: 'planned'
  },
  evening_flow_started: {
    description: 'A user begins their evening wind-down.',
    properties: [],
    status: 'planned'
  },
  evening_flow_completed: {
    description: 'A user completes their evening wind-down.',
    properties: [],
    status: 'planned'
  },
  support_tool_opened: {
    description: 'A user opens a Support & Calm tool (grounding, panic mode, stress release, quiet breathing).',
    properties: ['tool'],
    status: 'planned'
  },
  subscription_upgrade_clicked: {
    description: 'A user taps "Upgrade to WakeWise Plus".',
    properties: ['interval'],
    status: 'planned'
  },
  subscription_checkout_completed: {
    description: 'A Stripe Checkout session completes successfully.',
    properties: ['interval'],
    status: 'planned'
  }
};

const DEBUG_LOG_KEY = 'wakewise_analytics_debug_log_v1';
const MAX_LOG_ENTRIES = 100;

export const trackEvent = (eventName, properties = {}) => {
  const entry = EVENT_CATALOGUE[eventName];
  if (!entry) {
    console.warn(`trackEvent: "${eventName}" is not in the analytics event catalogue`);
  }

  const record = { eventName, properties, timestamp: new Date().toISOString() };
  console.info('[analytics]', record);

  try {
    const raw = localStorage.getItem(DEBUG_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    const next = [record, ...log].slice(0, MAX_LOG_ENTRIES);
    localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — the console.info above is still emitted.
  }
};

export const getAnalyticsDebugLog = () => {
  try {
    const raw = localStorage.getItem(DEBUG_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
