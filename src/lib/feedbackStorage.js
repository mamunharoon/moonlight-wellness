// WakeWise — Closed Beta Preparation, Phase A — feedback local history.
//
// Feedback is DELIVERED via a mailto link (see pages/Feedback.jsx) —
// there is no backend table collecting it centrally this phase. Adding
// one would need a new Supabase table, which this phase's own rules
// say to stop and ask about before doing — a mailto keeps the whole
// flow local-storage-only with zero new infrastructure. What's stored
// here is only the user's own local copy of what they've sent, so they
// can see their own submission history on this device.

const FEEDBACK_KEY = 'wakewise_feedback_history_v1';
const MAX_ENTRIES = 50;

const readHistory = () => {
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const getFeedbackHistory = () => readHistory();

export const recordFeedbackSubmission = ({ category, message, reproSteps }) => {
  const history = readHistory();
  const entry = {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    category,
    message,
    reproSteps: reproSteps || null,
    submittedAt: new Date().toISOString()
  };
  const next = [entry, ...history].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — the mailto send still happened, only
    // the local history entry is lost.
  }
  return next;
};
