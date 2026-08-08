// WakeWise — Closed Beta Preparation, Phase A — onboarding checklist.
//
// A self-contained, device-local checklist a beta tester ticks off
// themselves. Deliberately NOT wired to auto-detect state from other
// modules (rhythm, session progress, etc.) — this stays additive and
// self-contained rather than reaching into session/flow logic, which
// this phase's own rules keep off-limits.

const CHECKLIST_KEY = 'wakewise_beta_checklist_v1';

export const CHECKLIST_ITEMS = [
  { id: 'explore-morning', label: 'Explore your morning routine' },
  { id: 'explore-evening', label: 'Explore your evening wind-down' },
  { id: 'try-support', label: 'Try a Support & Calm tool' },
  { id: 'set-rhythm', label: 'Set your daily rhythm in Onboarding' },
  { id: 'review-notifications', label: 'Review your notification settings' },
  { id: 'send-feedback', label: 'Send your first piece of feedback' }
];

const readCompleted = () => {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeCompleted = (ids) => {
  try {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(ids));
  } catch {
    // localStorage unavailable — checklist state simply won't persist.
  }
};

export const getCompletedChecklistItems = () => readCompleted();

export const toggleChecklistItem = (id) => {
  const completed = readCompleted();
  const next = completed.includes(id)
    ? completed.filter((existing) => existing !== id)
    : [...completed, id];
  writeCompleted(next);
  return next;
};
